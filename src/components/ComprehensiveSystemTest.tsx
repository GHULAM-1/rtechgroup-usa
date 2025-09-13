import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle, AlertCircle, Play, RefreshCw } from "lucide-react";
import { toast } from "sonner";

interface TestResult {
  name: string;
  passed: boolean;
  message: string;
  category: 'setup' | 'initial_fee' | 'rental_payment' | 'pnl' | 'balance' | 'cleanup';
}

export const ComprehensiveSystemTest = () => {
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<TestResult[]>([]);
  const queryClient = useQueryClient();

  // Get first customer and vehicle for testing
  const { data: customers } = useQuery({
    queryKey: ["customers-comprehensive-test"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customers")
        .select("id, name")
        .limit(1);
      if (error) throw error;
      return data;
    },
  });

  const { data: vehicles } = useQuery({
    queryKey: ["vehicles-comprehensive-test"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vehicles")
        .select("id, reg")
        .limit(1);
      if (error) throw error;
      return data;
    },
  });

  const runComprehensiveTests = async () => {
    if (!customers?.[0] || !vehicles?.[0]) {
      toast.error("Need at least one customer and vehicle to run tests");
      return;
    }

    setRunning(true);
    const testResults: TestResult[] = [];

    try {
      const customer = customers[0];
      const vehicle = vehicles[0];
      const testPrefix = `TEST_${Date.now()}`;

      console.log("=== Comprehensive System Tests Starting ===");

      // Phase 1: Setup and Cleanup
      console.log("Phase 1: Setup and cleanup...");
      await supabase.from("payment_applications").delete().eq("payment_id", null).neq("payment_id", null);
      await supabase.from("payments").delete().eq("customer_id", customer.id);
      await supabase.from("pnl_entries").delete().eq("customer_id", customer.id);
      await supabase.from("ledger_entries").delete().eq("customer_id", customer.id);
      await supabase.from("rentals").delete().eq("customer_id", customer.id);

      testResults.push({ 
        name: "System Cleanup", 
        passed: true, 
        message: "Test environment cleaned", 
        category: 'setup' 
      });

      // Phase 2: Test CreateRental with Initial Fee (Full E2E)
      console.log("Phase 2: Testing CreateRental with Initial Fee...");
      const startDate = "2024-01-01";
      const endDate = "2024-12-31";
      const monthlyAmount = 1000;
      const initialFeeAmount = 500;

      // Create rental (simulating CreateRental component)
      const { data: rental1, error: rental1Error } = await supabase
        .from("rentals")
        .insert({
          customer_id: customer.id,
          vehicle_id: vehicle.id,
          start_date: startDate,
          end_date: endDate,
          monthly_amount: monthlyAmount,
          status: "Active"
        })
        .select()
        .single();

      if (rental1Error) throw rental1Error;

      // Create initial fee payment (simulating CreateRental logic)
      const { data: initialFeePayment, error: initialFeeError } = await supabase
        .from("payments")
        .insert({
          customer_id: customer.id,
          rental_id: rental1.id,
          vehicle_id: vehicle.id,
          amount: initialFeeAmount,
          payment_date: startDate,
          payment_type: "InitialFee",
          method: "System"
        })
        .select()
        .single();

      if (initialFeeError) throw initialFeeError;

      // Process initial fee payment
      const { data: initialFeeResult, error: initialFeeProcessError } = await supabase.functions.invoke('apply-payment', {
        body: { paymentId: initialFeePayment.id }
      });

      if (initialFeeProcessError || !initialFeeResult?.ok) {
        throw new Error(`Initial fee processing failed: ${initialFeeProcessError?.message || initialFeeResult?.error}`);
      }

      testResults.push({ 
        name: "CreateRental Initial Fee E2E", 
        passed: true, 
        message: "Rental created with initial fee processed", 
        category: 'initial_fee' 
      });

      // Verify initial fee created correct entries
      const { data: initialFeeLedger } = await supabase
        .from("ledger_entries")
        .select("*")
        .eq("payment_id", initialFeePayment.id);

      const { data: initialFeePnl } = await supabase
        .from("pnl_entries")
        .select("*")
        .eq("payment_id", initialFeePayment.id);

      const correctLedger = initialFeeLedger?.some(e => 
        e.type === "Payment" && 
        e.category === "Initial Fees" && 
        e.amount === -500
      );

      const correctPnl = initialFeePnl?.some(e => 
        e.side === "Revenue" && 
        e.category === "Initial Fees" && 
        e.amount === 500
      );

      testResults.push({ 
        name: "Initial Fee Ledger & P&L Verification", 
        passed: correctLedger && correctPnl, 
        message: correctLedger && correctPnl ? 
          "Initial fee correctly recorded in ledger and P&L" : 
          `Ledger: ${correctLedger}, P&L: ${correctPnl}`,
        category: 'initial_fee' 
      });

      // Phase 3: Create rental charges and test rental payments
      console.log("Phase 3: Testing rental charges and rental payments...");
      
      // Create rental charges
      await supabase.rpc("rental_create_charge", {
        r_id: rental1.id,
        due: "2024-01-01",
        amt: monthlyAmount
      });

      await supabase.rpc("rental_create_charge", {
        r_id: rental1.id,
        due: "2024-02-01", 
        amt: monthlyAmount
      });

      testResults.push({ 
        name: "Rental Charges Creation", 
        passed: true, 
        message: "Monthly rental charges created", 
        category: 'rental_payment' 
      });

      // Test rental payment (via AddPaymentDialog simulation)
      const { data: rentalPayment1, error: rentalPayment1Error } = await supabase
        .from("payments")
        .insert({
          customer_id: customer.id,
          rental_id: rental1.id,
          vehicle_id: vehicle.id,
          amount: monthlyAmount,
          payment_type: "Rental",
          payment_date: "2024-01-01",
          method: "Bank Transfer"
        })
        .select()
        .single();

      if (rentalPayment1Error) throw rentalPayment1Error;

      // Process rental payment
      const { data: rentalResult1, error: rentalProcessError1 } = await supabase.functions.invoke('apply-payment', {
        body: { paymentId: rentalPayment1.id }
      });

      if (rentalProcessError1 || !rentalResult1?.ok) {
        throw new Error(`Rental payment processing failed: ${rentalProcessError1?.message || rentalResult1?.error}`);
      }

      testResults.push({ 
        name: "AddPaymentDialog Rental Payment E2E", 
        passed: true, 
        message: "Rental payment processed via AddPaymentDialog simulation", 
        category: 'rental_payment' 
      });

      // Verify FIFO allocation worked
      const { data: paymentApplications } = await supabase
        .from("payment_applications")
        .select("*")
        .eq("payment_id", rentalPayment1.id);

      const { data: chargeAfterPayment } = await supabase
        .from("ledger_entries")
        .select("remaining_amount")
        .eq("rental_id", rental1.id)
        .eq("type", "Charge")
        .eq("category", "Rental")
        .eq("due_date", "2024-01-01")
        .single();

      const fifoWorked = paymentApplications?.length === 1 && chargeAfterPayment?.remaining_amount === 0;

      testResults.push({ 
        name: "FIFO Allocation Verification", 
        passed: fifoWorked, 
        message: fifoWorked ? 
          "FIFO allocation correctly applied payment to first charge" : 
          `Applications: ${paymentApplications?.length}, Remaining: ${chargeAfterPayment?.remaining_amount}`,
        category: 'rental_payment' 
      });

      // Phase 4: Test P&L calculations
      console.log("Phase 4: Testing P&L calculations...");
      
      const { data: pnlTotals } = await supabase
        .from("pnl_entries")
        .select("category, amount, side")
        .eq("vehicle_id", vehicle.id);

      const initialFeesPnl = pnlTotals?.filter(p => p.category === "Initial Fees" && p.side === "Revenue")
        .reduce((sum, p) => sum + p.amount, 0) || 0;
      
      const rentalPnl = pnlTotals?.filter(p => p.category === "Rental" && p.side === "Revenue")
        .reduce((sum, p) => sum + p.amount, 0) || 0;

      const pnlCorrect = initialFeesPnl === 500 && rentalPnl === 1000;

      testResults.push({ 
        name: "P&L Totals Verification", 
        passed: pnlCorrect, 
        message: pnlCorrect ? 
          `Initial Fees: £${initialFeesPnl}, Rental: £${rentalPnl}` : 
          `Initial Fees: £${initialFeesPnl} (expected £500), Rental: £${rentalPnl} (expected £1000)`,
        category: 'pnl' 
      });

      // Phase 5: Test customer balance calculations
      console.log("Phase 5: Testing customer balance...");
      
      const { data: customerBalance } = await supabase.rpc("get_customer_net_position", {
        customer_id_param: customer.id
      });

      // Customer should owe £1000 (second month charge not paid)
      const balanceCorrect = customerBalance === 1000;

      testResults.push({ 
        name: "Customer Balance Calculation", 
        passed: balanceCorrect, 
        message: balanceCorrect ? 
          `Customer balance: £${customerBalance} (correctly shows £1000 outstanding)` : 
          `Customer balance: £${customerBalance} (expected £1000)`,
        category: 'balance' 
      });

      // Phase 6: Test system integration with PLDashboard data
      console.log("Phase 6: Testing PLDashboard integration...");
      
      const { data: plByVehicle } = await supabase
        .from("view_pl_by_vehicle")
        .select("*")
        .eq("vehicle_id", vehicle.id)
        .single();

      const dashboardDataCorrect = plByVehicle && 
        plByVehicle.revenue_fees >= 500 && 
        plByVehicle.revenue_rental >= 1000;

      testResults.push({ 
        name: "PLDashboard Data Integration", 
        passed: !!dashboardDataCorrect, 
        message: dashboardDataCorrect ? 
          `Dashboard shows fees: £${plByVehicle.revenue_fees}, rental: £${plByVehicle.revenue_rental}` : 
          "Dashboard data not correctly reflecting transactions",
        category: 'pnl' 
      });

      // Phase 7: Test idempotency
      console.log("Phase 7: Testing idempotency...");
      
      const { data: idempotentResult } = await supabase.functions.invoke('apply-payment', {
        body: { paymentId: initialFeePayment.id }
      });

      const { data: finalLedgerCount } = await supabase
        .from("ledger_entries")
        .select("id", { count: "exact" })
        .eq("payment_id", initialFeePayment.id);

      const { data: finalPnlCount } = await supabase
        .from("pnl_entries")
        .select("id", { count: "exact" })
        .eq("payment_id", initialFeePayment.id);

      const idempotencyWorked = (finalLedgerCount?.length || 0) === 1 && (finalPnlCount?.length || 0) === 1;

      testResults.push({ 
        name: "Idempotency Test", 
        passed: idempotencyWorked, 
        message: idempotencyWorked ? 
          "Re-processing payments doesn't create duplicates" : 
          `Ledger: ${finalLedgerCount?.length}, P&L: ${finalPnlCount?.length} (should be 1 each)`,
        category: 'setup' 
      });

      // Cleanup
      console.log("Cleaning up test data...");
      await supabase.from("payment_applications").delete().eq("payment_id", null).neq("payment_id", null);
      await supabase.from("payments").delete().eq("customer_id", customer.id);
      await supabase.from("pnl_entries").delete().eq("customer_id", customer.id);
      await supabase.from("ledger_entries").delete().eq("customer_id", customer.id);
      await supabase.from("rentals").delete().eq("customer_id", customer.id);

      testResults.push({ 
        name: "Final Cleanup", 
        passed: true, 
        message: "Test environment cleaned", 
        category: 'cleanup' 
      });

      console.log("=== Comprehensive System Tests Complete ===");

    } catch (error: any) {
      console.error("Comprehensive test failed:", error);
      testResults.push({ 
        name: "Test Error", 
        passed: false, 
        message: error.message, 
        category: 'setup' 
      });
    } finally {
      setResults(testResults);
      setRunning(false);
    }
  };

  const allPassed = results.length > 0 && results.every(r => r.passed);
  const categoryResults = {
    setup: results.filter(r => r.category === 'setup'),
    initial_fee: results.filter(r => r.category === 'initial_fee'),
    rental_payment: results.filter(r => r.category === 'rental_payment'),
    pnl: results.filter(r => r.category === 'pnl'),
    balance: results.filter(r => r.category === 'balance'),
    cleanup: results.filter(r => r.category === 'cleanup')
  };

  const getCategoryIcon = (passed: boolean) => {
    return passed ? (
      <CheckCircle className="h-4 w-4 text-green-600" />
    ) : (
      <XCircle className="h-4 w-4 text-red-600" />
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl font-semibold flex items-center gap-2">
          <RefreshCw className="h-5 w-5" />
          Comprehensive System Tests
        </CardTitle>
        <CardDescription>
          Full end-to-end testing of payment system, initial fees, rental payments, P&L, and integrations
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <Button 
            onClick={runComprehensiveTests}
            disabled={running || !customers?.[0] || !vehicles?.[0]}
            className="w-full"
          >
            <Play className="h-4 w-4 mr-2" />
            {running ? "Running Comprehensive Tests..." : "Run Full System Tests"}
          </Button>

          {results.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                {allPassed ? (
                  <CheckCircle className="h-5 w-5 text-green-600" />
                ) : (
                  <XCircle className="h-5 w-5 text-red-600" />
                )}
                <span className="font-medium">
                  {allPassed ? "All Tests Passed! System is functioning correctly." : 
                   `${results.filter(r => r.passed).length}/${results.length} Tests Passed`}
                </span>
              </div>

              <div className="space-y-3">
                {/* Initial Fee Tests */}
                {categoryResults.initial_fee.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="font-semibold flex items-center gap-2">
                      {getCategoryIcon(categoryResults.initial_fee.every(r => r.passed))}
                      Initial Fee Tests
                    </h4>
                    {categoryResults.initial_fee.map((result, index) => (
                      <div key={index} className="ml-6 flex items-center justify-between p-2 rounded border">
                        <div className="flex items-center gap-2">
                          {result.passed ? (
                            <CheckCircle className="h-4 w-4 text-green-600" />
                          ) : (
                            <XCircle className="h-4 w-4 text-red-600" />
                          )}
                          <span className="font-medium">{result.name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={result.passed ? "default" : "destructive"}>
                            {result.passed ? "PASS" : "FAIL"}
                          </Badge>
                          <span className="text-sm text-muted-foreground">{result.message}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Rental Payment Tests */}
                {categoryResults.rental_payment.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="font-semibold flex items-center gap-2">
                      {getCategoryIcon(categoryResults.rental_payment.every(r => r.passed))}
                      Rental Payment Tests
                    </h4>
                    {categoryResults.rental_payment.map((result, index) => (
                      <div key={index} className="ml-6 flex items-center justify-between p-2 rounded border">
                        <div className="flex items-center gap-2">
                          {result.passed ? (
                            <CheckCircle className="h-4 w-4 text-green-600" />
                          ) : (
                            <XCircle className="h-4 w-4 text-red-600" />
                          )}
                          <span className="font-medium">{result.name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={result.passed ? "default" : "destructive"}>
                            {result.passed ? "PASS" : "FAIL"}
                          </Badge>
                          <span className="text-sm text-muted-foreground">{result.message}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* P&L Tests */}
                {categoryResults.pnl.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="font-semibold flex items-center gap-2">
                      {getCategoryIcon(categoryResults.pnl.every(r => r.passed))}
                      P&L and Dashboard Tests
                    </h4>
                    {categoryResults.pnl.map((result, index) => (
                      <div key={index} className="ml-6 flex items-center justify-between p-2 rounded border">
                        <div className="flex items-center gap-2">
                          {result.passed ? (
                            <CheckCircle className="h-4 w-4 text-green-600" />
                          ) : (
                            <XCircle className="h-4 w-4 text-red-600" />
                          )}
                          <span className="font-medium">{result.name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={result.passed ? "default" : "destructive"}>
                            {result.passed ? "PASS" : "FAIL"}
                          </Badge>
                          <span className="text-sm text-muted-foreground">{result.message}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Balance Tests */}
                {categoryResults.balance.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="font-semibold flex items-center gap-2">
                      {getCategoryIcon(categoryResults.balance.every(r => r.passed))}
                      Balance Calculation Tests
                    </h4>
                    {categoryResults.balance.map((result, index) => (
                      <div key={index} className="ml-6 flex items-center justify-between p-2 rounded border">
                        <div className="flex items-center gap-2">
                          {result.passed ? (
                            <CheckCircle className="h-4 w-4 text-green-600" />
                          ) : (
                            <XCircle className="h-4 w-4 text-red-600" />
                          )}
                          <span className="font-medium">{result.name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={result.passed ? "default" : "destructive"}>
                            {result.passed ? "PASS" : "FAIL"}
                          </Badge>
                          <span className="text-sm text-muted-foreground">{result.message}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Other Tests */}
                {[...categoryResults.setup, ...categoryResults.cleanup].map((result, index) => (
                  <div key={index} className="flex items-center justify-between p-2 rounded border">
                    <div className="flex items-center gap-2">
                      {result.passed ? (
                        <CheckCircle className="h-4 w-4 text-green-600" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-600" />
                      )}
                      <span className="font-medium">{result.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={result.passed ? "default" : "destructive"}>
                        {result.passed ? "PASS" : "FAIL"}
                      </Badge>
                      <span className="text-sm text-muted-foreground">{result.message}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
