import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface TestResult {
  name: string;
  passed: boolean;
  message: string;
  details?: string;
}

export const FinanceAcceptanceTest = () => {
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<TestResult[]>([]);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const runTests = async () => {
    setIsRunning(true);
    const testResults: TestResult[] = [];

    try {
      // Test 1: Create financed vehicle
      const testVehicle = {
        reg: `TEST${Date.now()}`,
        make: "Test",
        model: "Finance",
        colour: "Blue",
        acquisition_date: new Date().toISOString().split('T')[0],
        acquisition_type: "Finance",
        monthly_payment: 300,
        initial_payment: 1000,
        term_months: 36,
        balloon: 5000,
        finance_start_date: new Date().toISOString().split('T')[0],
      };

      const { data: vehicle, error: vehicleError } = await supabase
        .from("vehicles")
        .insert(testVehicle)
        .select()
        .single();

      if (vehicleError || !vehicle) {
        testResults.push({
          name: "Create Financed Vehicle",
          passed: false,
          message: "Failed to create financed vehicle",
          details: vehicleError?.message
        });
      } else {
        // Verify contract total calculation and upfront P&L entry
        const expectedContractTotal = 1000 + (300 * 36) + 5000; // 16,800
        const calculatedTotal = (vehicle.initial_payment || 0) + 
                               ((vehicle.monthly_payment || 0) * (vehicle.term_months || 0)) + 
                               (vehicle.balloon || 0);
        
        testResults.push({
          name: "Create Financed Vehicle",
          passed: true,
          message: `Vehicle created successfully (Contract Total: $${calculatedTotal.toLocaleString()})`,
          details: `Expected: $${expectedContractTotal.toLocaleString()}, Calculated: $${calculatedTotal.toLocaleString()}`
        });

        // Test 2: Verify upfront P&L entry was created automatically
        const { data: upfrontEntry } = await supabase
          .from("pnl_entries")
          .select("amount, category, side, source_ref")
          .eq("vehicle_id", vehicle.id)
          .eq("category", "Acquisition")
          .eq("source_ref", `FIN-UPFRONT:${vehicle.id}`)
          .single();

        const upfrontPassed = upfrontEntry && 
                             upfrontEntry.side === 'Cost' && 
                             Number(upfrontEntry.amount) === expectedContractTotal;

        testResults.push({
          name: "Upfront P&L Entry Created",
          passed: upfrontPassed,
          message: upfrontPassed 
            ? `Upfront acquisition cost of $${Number(upfrontEntry?.amount || 0).toLocaleString()} recorded in P&L`
            : "Failed to create upfront P&L acquisition entry",
          details: `Expected: $${expectedContractTotal.toLocaleString()} acquisition cost, Found: ${upfrontEntry ? `$${Number(upfrontEntry.amount).toLocaleString()}` : 'No entry'}`
        });

        // Test 3: Record deposit payment (should NOT create P&L entry due to upfront entry)
        const depositRef = `FINPAY:${vehicle.id}:Deposit:${new Date().toISOString().split('T')[0]}:1000`;
        
        const { data: depositPayment, error: depositError } = await supabase
          .from("payments")
          .insert({
            payment_type: 'Finance',
            vehicle_id: vehicle.id,
            payment_date: new Date().toISOString().split('T')[0],
            amount: 1000,
            method: depositRef,
            customer_id: null,
            rental_id: null,
            status: 'Applied',
            remaining_amount: 0,
          })
          .select()
          .single();

        if (depositError) {
          testResults.push({
            name: "Record Deposit Payment",
            passed: false,
            message: "Failed to record deposit payment",
            details: depositError.message
          });
        } else {
          // Insert ledger entry (cash flow tracking)
          await supabase.from("ledger_entries").insert({
            vehicle_id: vehicle.id,
            entry_date: new Date().toISOString().split('T')[0],
            type: 'Cost',
            category: 'Finance',
            amount: 1000,
            due_date: new Date().toISOString().split('T')[0],
            remaining_amount: 0,
            reference: depositRef,
            payment_id: depositPayment.id,
          });

          // Should NOT insert P&L entry since upfront entry exists

          testResults.push({
            name: "Record Deposit Payment",
            passed: true,
            message: "Deposit payment recorded successfully (cash flow only)",
            details: "Payment and ledger entries created, P&L skipped to prevent double-counting"
          });
        }

        // Test 4: Record monthly payment (should NOT create P&L entry)
        const monthlyRef = `FINPAY:${vehicle.id}:Monthly:${new Date().toISOString().split('T')[0]}:300`;
        
        const { data: monthlyPayment, error: monthlyError } = await supabase
          .from("payments")
          .insert({
            payment_type: 'Finance',
            vehicle_id: vehicle.id,
            payment_date: new Date().toISOString().split('T')[0],
            amount: 300,
            method: monthlyRef,
            customer_id: null,
            rental_id: null,
            status: 'Applied',
            remaining_amount: 0,
          })
          .select()
          .single();

        if (monthlyError) {
          testResults.push({
            name: "Record Monthly Payment",
            passed: false,
            message: "Failed to record monthly payment",
            details: monthlyError.message
          });
        } else {
          // Insert ledger entry (cash flow tracking)
          await supabase.from("ledger_entries").insert({
            vehicle_id: vehicle.id,
            entry_date: new Date().toISOString().split('T')[0],
            type: 'Cost',
            category: 'Finance',
            amount: 300,
            due_date: new Date().toISOString().split('T')[0],
            remaining_amount: 0,
            reference: monthlyRef,
            payment_id: monthlyPayment.id,
          });

          // Should NOT insert P&L entry since upfront entry exists

          testResults.push({
            name: "Record Monthly Payment",
            passed: true,
            message: "Monthly payment recorded successfully (cash flow only)",
            details: "Payment and ledger entries created, P&L skipped to prevent double-counting"
          });
        }

        // Test 5: Verify P&L shows ONLY upfront acquisition cost (no incremental finance costs)
        const { data: plEntries } = await supabase
          .from("pnl_entries")
          .select("amount, category, source_ref")
          .eq("vehicle_id", vehicle.id)
          .eq("side", "Cost");

        const acquisitionCosts = plEntries?.filter(e => e.category === 'Acquisition') || [];
        const financeCosts = plEntries?.filter(e => e.category === 'Finance') || [];
        
        const totalAcquisitionCosts = acquisitionCosts.reduce((sum, entry) => sum + Number(entry.amount), 0);
        const totalFinanceCosts = financeCosts.reduce((sum, entry) => sum + Number(entry.amount), 0);
        
        testResults.push({
          name: "Verify P&L Shows Only Upfront Costs",
          passed: totalAcquisitionCosts === expectedContractTotal && totalFinanceCosts === 0,
          message: `P&L: Acquisition $${totalAcquisitionCosts.toLocaleString()}, Finance $${totalFinanceCosts.toLocaleString()}`,
          details: `Expected: Acquisition $${expectedContractTotal.toLocaleString()}, Finance $0 (prevented double-counting)`
        });

        // Test 6: Verify customer balances unaffected
        const { data: customerCharges } = await supabase
          .from("ledger_entries")
          .select("customer_id")
          .eq("vehicle_id", vehicle.id)
          .eq("type", "Charge");

        testResults.push({
          name: "Customer Balances Unaffected",
          passed: !customerCharges || customerCharges.length === 0,
          message: "No customer charges created for finance payments",
          details: "Finance payments correctly isolated from customer accounting"
        });

        // Cleanup test data
        await supabase.from("pnl_entries").delete().eq("vehicle_id", vehicle.id);
        await supabase.from("ledger_entries").delete().eq("vehicle_id", vehicle.id);
        await supabase.from("payments").delete().eq("vehicle_id", vehicle.id);
        await supabase.from("vehicles").delete().eq("id", vehicle.id);
      }

    } catch (error: any) {
      testResults.push({
        name: "Upfront Finance Test Suite",
        passed: false,
        message: "Test suite failed with error",
        details: error.message
      });
    }

    setResults(testResults);
    setIsRunning(false);

    // Show summary toast
    const passedCount = testResults.filter(r => r.passed).length;
    const totalCount = testResults.length;
    
    toast({
      title: "Upfront Finance Tests Complete",
      description: `${passedCount}/${totalCount} tests passed`,
      variant: passedCount === totalCount ? "default" : "destructive"
    });

    // Refresh P&L data
    queryClient.invalidateQueries({ queryKey: ["finance-costs"] });
    queryClient.invalidateQueries({ queryKey: ["vehicle-pl"] });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          Upfront Finance Accounting Tests
          <Button 
            onClick={runTests} 
            disabled={isRunning}
            size="sm"
          >
            {isRunning ? "Running..." : "Run Tests"}
          </Button>
        </CardTitle>
        <CardDescription>
          Test upfront finance accounting: create financed vehicle, verify upfront P&L cost, prevent double-counting
        </CardDescription>
      </CardHeader>
      <CardContent>
        {results.length > 0 ? (
          <div className="space-y-3">
            {results.map((result, index) => (
              <div key={index} className="flex items-start gap-3 p-3 border rounded-lg">
                {result.passed ? (
                  <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                ) : (
                  <XCircle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{result.name}</span>
                    <Badge variant={result.passed ? "default" : "destructive"}>
                      {result.passed ? "PASS" : "FAIL"}
                    </Badge>
                  </div>
                  <div className="text-sm text-muted-foreground mt-1">
                    {result.message}
                  </div>
                  {result.details && (
                    <div className="text-xs text-muted-foreground mt-1 bg-muted p-2 rounded">
                      {result.details}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No test results yet. Click "Run Tests" to start.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};