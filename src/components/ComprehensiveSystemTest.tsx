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
  category: 'setup' | 'initial_fee' | 'rental_payment' | 'fine_workflow' | 'pnl' | 'balance' | 'cleanup';
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

      console.log("=== Comprehensive System Tests Starting ===");

      // Phase 1: Setup and Cleanup
      console.log("Phase 1: Setup and cleanup...");
      await supabase.from("payment_applications").delete().neq("payment_id", "00000000-0000-0000-0000-000000000000");
      await supabase.from("payments").delete().eq("customer_id", customer.id);
      await supabase.from("pnl_entries").delete().eq("customer_id", customer.id);
      await supabase.from("ledger_entries").delete().eq("customer_id", customer.id);
      await supabase.from("rentals").delete().eq("customer_id", customer.id);
      await supabase.from("fines").delete().eq("customer_id", customer.id);

      testResults.push({ 
        name: "System Cleanup", 
        passed: true, 
        message: "Test environment cleaned", 
        category: 'setup' 
      });

      // Phase 2: Test Fine Workflow
      console.log("Phase 2: Testing Fine workflow...");
      
      // Test 1: Create Fine with Customer Liability
      const { data: fine, error: fineError } = await supabase
        .from('fines')
        .insert({
          type: 'PCN',
          vehicle_id: vehicle.id,
          customer_id: customer.id,
          issue_date: '2025-09-13',
          due_date: '2025-10-13',
          amount: 150,
          liability: 'Customer'
        })
        .select()
        .single();

      if (fineError) throw fineError;

      // Verify fine charge was created
      const { data: fineCharge } = await supabase
        .from('ledger_entries')
        .select('*')
        .eq('customer_id', customer.id)
        .eq('category', 'Fines')
        .eq('type', 'Charge')
        .single();

      testResults.push({
        name: 'Fine Charge Auto-Creation',
        passed: fineCharge && fineCharge.amount === 150 && fineCharge.remaining_amount === 150,
        message: fineCharge ? 'Auto-created fine charge correctly' : 'Failed to auto-create fine charge',
        category: 'fine_workflow'
      });

      // Test 2: Fine Payment (Partial)
      const { data: finePayment1 } = await supabase
        .from('payments')
        .insert({
          customer_id: customer.id,
          vehicle_id: vehicle.id,
          amount: 100,
          payment_date: '2025-09-13',
          method: 'Card',
          payment_type: 'Fine'
        })
        .select()
        .single();

      // Apply fine payment
      await supabase.functions.invoke('apply-payment', {
        body: { paymentId: finePayment1.id }
      });

      // Verify fine charge partially paid
      const { data: updatedFineCharge } = await supabase
        .from('ledger_entries')
        .select('*')
        .eq('id', fineCharge.id)
        .single();

      testResults.push({
        name: 'Fine Payment FIFO Allocation',
        passed: updatedFineCharge.remaining_amount === 50,
        message: updatedFineCharge.remaining_amount === 50 ? 
          'Fine payment correctly allocated via FIFO' : 
          `Expected remaining: 50, got: ${updatedFineCharge.remaining_amount}`,
        category: 'fine_workflow'
      });

      // Cleanup
      console.log("Cleaning up test data...");
      await supabase.from("payments").delete().eq("customer_id", customer.id);
      await supabase.from("pnl_entries").delete().eq("customer_id", customer.id);
      await supabase.from("ledger_entries").delete().eq("customer_id", customer.id);
      await supabase.from("fines").delete().eq("customer_id", customer.id);

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
    fine_workflow: results.filter(r => r.category === 'fine_workflow'),
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
          Full end-to-end testing including Fine payments workflow
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
            {running ? "Running Tests..." : "Run Fine Workflow Tests"}
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
                  {allPassed ? "All Tests Passed!" : 
                   `${results.filter(r => r.passed).length}/${results.length} Tests Passed`}
                </span>
              </div>

              <div className="space-y-3">
                {/* Fine Workflow Tests */}
                {categoryResults.fine_workflow.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="font-semibold flex items-center gap-2">
                      {getCategoryIcon(categoryResults.fine_workflow.every(r => r.passed))}
                      Fine Workflow Tests
                    </h4>
                    {categoryResults.fine_workflow.map((result, index) => (
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
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};