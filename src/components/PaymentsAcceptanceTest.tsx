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

      // Create a test rental first
      const { data: rental, error: rentalError } = await supabase
        .from("rentals")
        .insert([{
          customer_id: customer.id,
          vehicle_id: vehicle.id,
          start_date: new Date().toISOString().split('T')[0],
          monthly_amount: 1000,
          status: 'Active'
        }])
        .select()
        .single();

      if (rentalError) throw rentalError;

      // Test 1: Record Initial Fee Payment
      const { data: initialPayment, error: initialError } = await supabase
        .from("payments")
        .insert([{
          customer_id: customer.id,
          vehicle_id: vehicle.id,
          rental_id: rental.id,
          amount: 1000,
          payment_type: 'InitialFee',
          method: 'Cash',
          payment_date: new Date().toISOString().split('T')[0]
        }])
        .select()
        .single();

      if (initialError) throw initialError;

      // Apply payment
      const { data: applyResult1, error: applyError1 } = await supabase.functions.invoke('apply-payment', {
        body: { paymentId: initialPayment.id }
      });

      if (applyError1 || !applyResult1?.ok) {
        testResults.push({
          name: "Initial Fee Payment",
          passed: false,
          message: `Apply payment failed: ${applyError1?.message || applyResult1?.error || 'Unknown error'}`
        });
      } else {
        // Check ledger entry created
        const { data: ledgerEntry } = await supabase
          .from("ledger_entries")
          .select("*")
          .eq("payment_id", initialPayment.id)
          .single();

        // Check P&L entry created
        const { data: pnlEntry } = await supabase
          .from("pnl_entries")
          .select("*")
          .eq("reference", initialPayment.id)
          .single();

        testResults.push({
          name: "Initial Fee Payment",
          passed: !!ledgerEntry && !!pnlEntry,
          message: ledgerEntry && pnlEntry 
            ? `✓ Ledger: ${ledgerEntry.category} £${Math.abs(ledgerEntry.amount)}, P&L: ${pnlEntry.category} £${pnlEntry.amount}`
            : "❌ Missing ledger or P&L entry"
        });
      }

      // Test 2: Record Two Rental Payments
      const rentalPayments = [];
      for (let i = 0; i < 2; i++) {
        const { data: payment, error: paymentError } = await supabase
          .from("payments")
          .insert([{
            customer_id: customer.id,
            vehicle_id: vehicle.id,
            rental_id: rental.id,
            amount: 1000,
            payment_type: 'Rental',
            method: 'Cash',
            payment_date: new Date().toISOString().split('T')[0]
          }])
          .select()
          .single();

        if (paymentError) throw paymentError;
        rentalPayments.push(payment);

        // Apply payment
        const { data: applyResult, error: applyError } = await supabase.functions.invoke('apply-payment', {
          body: { paymentId: payment.id }
        });

        if (applyError || !applyResult?.ok) {
          testResults.push({
            name: `Rental Payment ${i + 1}`,
            passed: false,
            message: `Apply payment failed: ${applyError?.message || applyResult?.error || 'Unknown error'}`
          });
        }
      }

      // Check P&L totals
      const { data: pnlTotals } = await supabase
        .from("pnl_entries")
        .select("category, amount")
        .eq("vehicle_id", vehicle.id);

      const initialFees = pnlTotals?.filter(p => p.category === 'Initial Fees').reduce((sum, p) => sum + Number(p.amount), 0) || 0;
      const rentalRevenue = pnlTotals?.filter(p => p.category === 'Rental').reduce((sum, p) => sum + Number(p.amount), 0) || 0;

      testResults.push({
        name: "P&L Totals",
        passed: initialFees === 1000 && rentalRevenue === 2000,
        message: `Initial Fees: £${initialFees}, Rental Revenue: £${rentalRevenue}`
      });

      // Test 3: Customer Balance (should show In Credit if overpaid)
      const { data: ledgerEntries } = await supabase
        .from("ledger_entries")
        .select("amount")
        .eq("customer_id", customer.id);

      const balance = ledgerEntries?.reduce((sum, entry) => sum + Number(entry.amount), 0) || 0;
      
      testResults.push({
        name: "Customer Balance",
        passed: balance < 0, // Should be negative (In Credit) since payments > charges
        message: balance < 0 
          ? `✓ In Credit £${Math.abs(balance).toFixed(2)}` 
          : balance > 0 
          ? `In Debt £${balance.toFixed(2)}` 
          : "Settled"
      });

      // Test 4: Idempotency - Re-run same payment
      const { data: idempotentResult, error: idempotentError } = await supabase.functions.invoke('apply-payment', {
        body: { paymentId: initialPayment.id }
      });

      if (idempotentError || !idempotentResult?.ok) {
        testResults.push({
          name: "Idempotency Test",
          passed: false,
          message: `Re-apply failed: ${idempotentError?.message || idempotentResult?.error || 'Unknown error'}`
        });
      } else {
        // Check that no duplicates were created
        const { data: duplicateCheck } = await supabase
          .from("ledger_entries")
          .select("id")
          .eq("payment_id", initialPayment.id);

        testResults.push({
          name: "Idempotency Test",
          passed: duplicateCheck?.length === 1,
          message: duplicateCheck?.length === 1 
            ? "✓ No duplicates created"
            : `❌ Found ${duplicateCheck?.length || 0} entries`
        });
      }

      // Clean up test data
      await supabase.from("payments").delete().eq("rental_id", rental.id);
      await supabase.from("ledger_entries").delete().eq("rental_id", rental.id);
      await supabase.from("pnl_entries").delete().eq("rental_id", rental.id);
      await supabase.from("rentals").delete().eq("id", rental.id);

    } catch (error) {
      console.error('Test error:', error);
      testResults.push({
        name: "Test Setup",
        passed: false,
        message: `Setup failed: ${error.message}`
      });
    }

    setResults(testResults);
    setRunning(false);
    
    // Refresh data
    queryClient.invalidateQueries();
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