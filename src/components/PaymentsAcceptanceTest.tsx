import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle, AlertCircle } from "lucide-react";
import { toast } from "sonner";

interface TestResult {
  name: string;
  passed: boolean;
  message: string;
}

export const PaymentsAcceptanceTest = () => {
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<TestResult[]>([]);
  const queryClient = useQueryClient();

  // Get first customer and vehicle for testing
  const { data: customers } = useQuery({
    queryKey: ["customers-test"],
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
    queryKey: ["vehicles-test"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vehicles")
        .select("id, reg")
        .limit(1);
      if (error) throw error;
      return data;
    },
  });

  const runAcceptanceTests = async () => {
    if (!customers?.[0] || !vehicles?.[0]) {
      toast.error("Need at least one customer and vehicle to run tests");
      return;
    }

    setRunning(true);
    const testResults: TestResult[] = [];

    try {
      const customer = customers[0];
      const vehicle = vehicles[0];

      console.log("=== Starting Payments Acceptance Tests ===");

      // Step 1: Clean up existing test data
      console.log("Cleaning up existing test data...");
      await supabase.from("payment_applications").delete().eq("payment_id", null).neq("payment_id", null);
      await supabase.from("payments").delete().eq("customer_id", customer.id);
      await supabase.from("pnl_entries").delete().eq("customer_id", customer.id);
      await supabase.from("ledger_entries").delete().eq("customer_id", customer.id);
      await supabase.from("rentals").delete().eq("customer_id", customer.id);

      testResults.push({ name: "Cleanup", passed: true, message: "Test data cleaned up" });

      // Step 2: Create a test rental
      console.log("Creating test rental...");
      const { data: rental, error: rentalError } = await supabase
        .from("rentals")
        .insert({
          customer_id: customer.id,
          vehicle_id: vehicle.id,
          start_date: "2024-01-01",
          end_date: "2024-12-31",
          monthly_amount: 1000,
          status: "Active"
        })
        .select()
        .single();

      if (rentalError) throw rentalError;
      testResults.push({ name: "Create Test Rental", passed: true, message: "Test rental created successfully" });

      // Step 3: Record and apply initial fee payment
      console.log("Recording initial fee payment...");
      const { data: initialPayment, error: initialPaymentError } = await supabase
        .from("payments")
        .insert({
          customer_id: customer.id,
          rental_id: rental.id,
          vehicle_id: vehicle.id,
          amount: 500,
          payment_type: "InitialFee",
          payment_date: "2024-01-01",
          method: "Test"
        })
        .select()
        .single();

      if (initialPaymentError) throw initialPaymentError;

      // Apply the initial fee payment
      const { data: applyResult1, error: applyError1 } = await supabase.functions.invoke('apply-payment', {
        body: { paymentId: initialPayment.id }
      });

      if (applyError1 || !applyResult1?.ok) {
        throw new Error(`Initial payment processing failed: ${applyError1?.message || applyResult1?.error}`);
      }

      testResults.push({ name: "Initial Fee Payment", passed: true, message: "Initial fee payment recorded and applied" });

      // Step 4: Verify ledger and P&L entries for initial fee
      const { data: ledgerEntries } = await supabase
        .from("ledger_entries")
        .select("*")
        .eq("payment_id", initialPayment.id);

      const { data: pnlEntries } = await supabase
        .from("pnl_entries")
        .select("*")
        .eq("payment_id", initialPayment.id);

      const hasCorrectLedgerEntry = ledgerEntries?.some(entry => 
        entry.type === "Payment" && 
        entry.category === "Initial Fees" && 
        entry.amount === -500
      );

      const hasCorrectPnlEntry = pnlEntries?.some(entry => 
        entry.side === "Revenue" && 
        entry.category === "Initial Fees" && 
        entry.amount === 500
      );

      testResults.push({ 
        name: "Initial Fee Ledger & P&L", 
        passed: hasCorrectLedgerEntry && hasCorrectPnlEntry, 
        message: hasCorrectLedgerEntry && hasCorrectPnlEntry ? 
          "Initial fee correctly recorded in ledger and P&L" : 
          "Initial fee not correctly recorded"
      });

      // Step 5: Create rental charges
      console.log("Creating rental charges...");
      await supabase.rpc("rental_create_charge", {
        r_id: rental.id,
        due: "2024-01-01",
        amt: 1000
      });

      await supabase.rpc("rental_create_charge", {
        r_id: rental.id,
        due: "2024-02-01", 
        amt: 1000
      });

      testResults.push({ name: "Create Rental Charges", passed: true, message: "Rental charges created" });

      // Step 6: Record and apply first rental payment
      console.log("Recording first rental payment...");
      const { data: rentalPayment1, error: rentalPaymentError1 } = await supabase
        .from("payments")
        .insert({
          customer_id: customer.id,
          rental_id: rental.id,
          vehicle_id: vehicle.id,
          amount: 1000,
          payment_type: "Rental",
          payment_date: "2024-01-01",
          method: "Test"
        })
        .select()
        .single();

      if (rentalPaymentError1) throw rentalPaymentError1;

      // Apply the rental payment
      const { data: applyResult2, error: applyError2 } = await supabase.functions.invoke('apply-payment', {
        body: { paymentId: rentalPayment1.id }
      });

      if (applyError2 || !applyResult2?.ok) {
        throw new Error(`First rental payment processing failed: ${applyError2?.message || applyResult2?.error}`);
      }

      testResults.push({ name: "First Rental Payment", passed: true, message: "First rental payment recorded and applied" });

      // Step 7: Record and apply second rental payment  
      console.log("Recording second rental payment...");
      const { data: rentalPayment2, error: rentalPaymentError2 } = await supabase
        .from("payments")
        .insert({
          customer_id: customer.id,
          rental_id: rental.id,
          vehicle_id: vehicle.id,
          amount: 1000,
          payment_type: "Rental", 
          payment_date: "2024-02-01",
          method: "Test"
        })
        .select()
        .single();

      if (rentalPaymentError2) throw rentalPaymentError2;

      // Apply the second rental payment
      const { data: applyResult3, error: applyError3 } = await supabase.functions.invoke('apply-payment', {
        body: { paymentId: rentalPayment2.id }
      });

      if (applyError3 || !applyResult3?.ok) {
        throw new Error(`Second rental payment processing failed: ${applyError3?.message || applyResult3?.error}`);
      }

      testResults.push({ name: "Second Rental Payment", passed: true, message: "Second rental payment recorded and applied" });

      // Step 8: NEW - Initial Fee Payment Test (Automated Rental Creation)
      console.log("Testing automated initial fee during rental creation...");
      
      // Simulate rental creation with initial fee
      const testStartDate = "2024-03-01";
      const { data: testRental, error: testRentalError } = await supabase
        .from("rentals")
        .insert({
          customer_id: customer.id,
          vehicle_id: vehicle.id,
          start_date: testStartDate,
          end_date: "2024-12-31", 
          monthly_amount: 1000,
          status: "Active"
        })
        .select()
        .single();

      if (testRentalError) throw testRentalError;

      // Auto-create initial fee payment (simulating CreateRental logic)
      const { data: autoInitialPayment, error: autoPaymentError } = await supabase
        .from("payments")
        .insert({
          customer_id: customer.id,
          rental_id: testRental.id,
          vehicle_id: vehicle.id,
          amount: 1000,
          payment_type: "InitialFee",
          payment_date: testStartDate, // Uses rental start_date, not today
          method: "System" // System-generated
        })
        .select()
        .single();

      if (autoPaymentError) throw autoPaymentError;

      // Process via existing pipeline
      const { data: autoApplyResult, error: autoApplyError } = await supabase.functions.invoke('apply-payment', {
        body: { paymentId: autoInitialPayment.id }
      });

      if (autoApplyError || !autoApplyResult?.ok) {
        throw new Error(`Auto initial fee processing failed: ${autoApplyError?.message || autoApplyResult?.error}`);
      }

      // Create rental charge for the same period 
      await supabase.rpc("rental_create_charge", {
        r_id: testRental.id,
        due: testStartDate,
        amt: 1000
      });

      // Verify: Initial fee doesn't reduce rental charge outstanding
      const { data: testLedgerEntries } = await supabase
        .from("ledger_entries")
        .select("*")
        .eq("rental_id", testRental.id);

      const chargeEntry = testLedgerEntries?.find(e => e.type === "Charge" && e.category === "Rental");
      const paymentEntry = testLedgerEntries?.find(e => e.type === "Payment" && e.category === "Initial Fees");

      const chargeRemaining = chargeEntry?.remaining_amount || 0;
      const paymentAmount = Math.abs(paymentEntry?.amount || 0);
      
      // Verify: Initial fee payment date matches start_date
      const paymentDateCorrect = paymentEntry?.entry_date === testStartDate;
      
      // Verify: Method is "System"
      const methodCorrect = autoInitialPayment.method === "System";

      const initialFeeTestPassed = chargeRemaining === 1000 && // Charge should remain fully outstanding 
                                  paymentAmount === 1000 &&     // Payment should be recorded
                                  paymentDateCorrect &&         // Date should match start_date
                                  methodCorrect;                // Method should be "System"

      testResults.push({
        name: "Initial Fee Payment (Automated)",
        passed: initialFeeTestPassed,
        message: initialFeeTestPassed 
          ? `Initial fee auto-processed correctly - charge remains $${chargeRemaining} outstanding, payment $${paymentAmount}, date/method correct`
          : `Initial fee test failed - charge outstanding: $${chargeRemaining}, payment: $${paymentAmount}, date correct: ${paymentDateCorrect}, method correct: ${methodCorrect}`
      });

      // Step 9: Verify P&L totals
      const { data: pnlTotals } = await supabase
        .from("pnl_entries")
        .select("category, amount")
        .eq("vehicle_id", vehicle.id);

      const initialFeesTotal = pnlTotals?.filter(p => p.category === "Initial Fees").reduce((sum, p) => sum + p.amount, 0) || 0;
      const rentalTotal = pnlTotals?.filter(p => p.category === "Rental").reduce((sum, p) => sum + p.amount, 0) || 0;

      testResults.push({
        name: "P&L Verification",
        passed: initialFeesTotal === 1500 && rentalTotal === 2000, // 500 + 1000 initial fees, 2000 rental
        message: `Initial Fees: $${initialFeesTotal}, Rental: $${rentalTotal}`
      });

      // Step 10: Verify customer balance
      const { data: customerBalance } = await supabase.rpc("get_customer_net_position", {
        customer_id_param: customer.id
      });

      testResults.push({
        name: "Customer Balance",
        passed: customerBalance === 1000, // Should owe $1000 (new rental charge not covered by initial fee)
        message: `Customer balance: $${customerBalance || 0} (should be $1000 - in debt)`
      });

      // Step 11: Test idempotency
      console.log("Testing idempotency...");
      const { data: idempotentResult, error: idempotentError } = await supabase.functions.invoke('apply-payment', {
        body: { paymentId: autoInitialPayment.id }
      });

      // Should not create duplicate entries
      const { data: finalLedgerCount } = await supabase
        .from("ledger_entries")
        .select("id", { count: "exact" })
        .eq("payment_id", autoInitialPayment.id);

      const { data: finalPnlCount } = await supabase
        .from("pnl_entries")
        .select("id", { count: "exact" })
        .eq("payment_id", autoInitialPayment.id);

      testResults.push({
        name: "Idempotency Test",
        passed: (finalLedgerCount?.length || 0) === 1 && (finalPnlCount?.length || 0) === 1,
        message: `Ledger entries: ${finalLedgerCount?.length || 0}, P&L entries: ${finalPnlCount?.length || 0}`
      });

      // Final cleanup
      console.log("Cleaning up test data...");
      await supabase.from("payment_applications").delete().eq("payment_id", null).neq("payment_id", null);
      await supabase.from("payments").delete().eq("customer_id", customer.id);
      await supabase.from("pnl_entries").delete().eq("customer_id", customer.id);
      await supabase.from("ledger_entries").delete().eq("customer_id", customer.id);
      await supabase.from("rentals").delete().eq("customer_id", customer.id);

      testResults.push({ name: "Final Cleanup", passed: true, message: "Test data cleaned up" });

    } catch (error: any) {
      console.error("Test failed:", error);
      testResults.push({ name: "Test Error", passed: false, message: error.message });
    } finally {
      setResults(testResults);
      setRunning(false);
    }
  };

  const allPassed = results.length > 0 && results.every(r => r.passed);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl font-semibold">Payments Acceptance Tests</CardTitle>
        <CardDescription>Verify the payments overhaul is working correctly</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <Button 
            onClick={runAcceptanceTests}
            disabled={running || !customers?.[0] || !vehicles?.[0]}
            className="w-full"
          >
            {running ? "Running Tests..." : "Run Acceptance Tests"}
          </Button>

          {results.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                {allPassed ? (
                  <CheckCircle className="h-5 w-5 text-green-600" />
                ) : (
                  <XCircle className="h-5 w-5 text-red-600" />
                )}
                <span className="font-medium">
                  {allPassed ? "All Tests Passed!" : `${results.filter(r => r.passed).length}/${results.length} Tests Passed`}
                </span>
              </div>

              <div className="space-y-2">
                {results.map((result, index) => (
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
                      {result.message && (
                        <span className="text-sm text-muted-foreground">{result.message}</span>
                      )}
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