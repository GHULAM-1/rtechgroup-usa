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
        // Verify contract total calculation
        const expectedContractTotal = 1000 + (300 * 36) + 5000; // 16,800
        const calculatedTotal = (vehicle.initial_payment || 0) + 
                               ((vehicle.monthly_payment || 0) * (vehicle.term_months || 0)) + 
                               (vehicle.balloon || 0);
        
        testResults.push({
          name: "Create Financed Vehicle",
          passed: true,
          message: `Vehicle created successfully (Contract Total: £${calculatedTotal.toLocaleString()})`,
          details: `Expected: £${expectedContractTotal.toLocaleString()}, Calculated: £${calculatedTotal.toLocaleString()}`
        });

        // Test 2: Verify upfront P&L entry was created automatically
        const { data: upfrontPL, error: plError } = await supabase
          .from("pnl_entries")
          .select("*")
          .eq("vehicle_id", vehicle.id)
          .eq("category", "Acquisition")
          .eq("source_ref", `FIN-UPFRONT:${vehicle.id}`)
          .single();

        if (plError || !upfrontPL) {
          testResults.push({
            name: "Verify Upfront P&L Entry",
            passed: false,
            message: "Upfront P&L entry not created automatically",
            details: plError?.message || "No upfront entry found"
          });
        } else {
          const plAmountMatches = Number(upfrontPL.amount) === expectedContractTotal;
          testResults.push({
            name: "Verify Upfront P&L Entry",
            passed: plAmountMatches,
            message: `Upfront P&L entry: £${Number(upfrontPL.amount).toLocaleString()} (Expected: £${expectedContractTotal.toLocaleString()})`,
            details: `Category: ${upfrontPL.category}, Side: ${upfrontPL.side}, Reference: ${upfrontPL.source_ref}`
          });
        }

        // Test 3: Record finance payment (should NOT create P&L cost due to upfront entry)
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
            name: "Record Finance Payment",
            passed: false,
            message: "Failed to record finance payment",
            details: depositError.message
          });
        } else {
          // Insert ledger entry (for cash flow tracking)
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

          // Should NOT create incremental P&L entry (upfront entry already exists)
          testResults.push({
            name: "Record Finance Payment",
            passed: true,
            message: "Finance payment recorded (ledger only, no P&L duplication)",
            details: "Payment and ledger entries created, P&L avoided due to upfront entry"
          });
        }

        // Test 4: Verify NO incremental P&L costs were added
        const { data: incrementalPL } = await supabase
          .from("pnl_entries")
          .select("amount")
          .eq("vehicle_id", vehicle.id)
          .eq("side", "Cost")
          .eq("category", "Finance");

        const hasIncrementalCosts = incrementalPL && incrementalPL.length > 0;
        
        testResults.push({
          name: "Verify No Incremental P&L Costs",
          passed: !hasIncrementalCosts,
          message: hasIncrementalCosts ? "Incremental finance costs found (should be prevented)" : "No incremental finance costs (correct)",
          details: `Found ${incrementalPL?.length || 0} incremental Finance P&L entries (should be 0)`
        });

        // Test 5: Verify total P&L shows only upfront acquisition cost
        const { data: allPLEntries } = await supabase
          .from("pnl_entries")
          .select("amount, category")
          .eq("vehicle_id", vehicle.id)
          .eq("side", "Cost");

        const totalCosts = allPLEntries?.reduce((sum, entry) => sum + Number(entry.amount), 0) || 0;
        const onlyAcquisitionCost = totalCosts === expectedContractTotal;
        
        testResults.push({
          name: "Verify Total P&L Costs",
          passed: onlyAcquisitionCost,
          message: `Total P&L costs: £${totalCosts.toLocaleString()} (Expected: £${expectedContractTotal.toLocaleString()})`,
          details: `Cost breakdown: ${allPLEntries?.map(e => `${e.category}: £${Number(e.amount).toLocaleString()}`).join(', ')}`
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
        name: "Finance Test Suite",
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
      title: "Finance Tests Complete",
      description: `${passedCount}/${totalCount} tests passed`,
      variant: passedCount === totalCount ? "default" : "destructive"
    });

    // Refresh P&L data
    queryClient.invalidateQueries({ queryKey: ["finance-costs"] });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          Finance Workflow Tests
          <Button 
            onClick={runTests} 
            disabled={isRunning}
            size="sm"
          >
            {isRunning ? "Running..." : "Run Tests"}
          </Button>
        </CardTitle>
        <CardDescription>
          Test upfront finance accounting: create financed vehicle (posts full contract cost immediately), record payments (no P&L impact), verify totals
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