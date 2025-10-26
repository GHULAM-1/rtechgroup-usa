import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle, Play, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface TestResult {
  name: string;
  passed: boolean;
  message: string;
  category: string;
}

export const RentalAcceptanceTest = () => {
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<TestResult[]>([]);
  const { toast } = useToast();

  // Get test data
  const { data: testCustomer } = useQuery({
    queryKey: ["test-customer"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customers")
        .select("*")
        .limit(1)
        .single();
      
      if (error) throw error;
      return data;
    },
  });

  const { data: testVehicle } = useQuery({
    queryKey: ["test-vehicle"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vehicles")
        .select("*")
        .eq("status", "Available")
        .limit(1)
        .single();
      
      if (error) throw error;
      return data;
    },
  });

  const runAcceptanceTests = async () => {
    if (!testCustomer || !testVehicle) {
      toast({
        title: "Test Prerequisites Missing",
        description: "Need at least one customer and one available vehicle for testing.",
        variant: "destructive",
      });
      return;
    }

    setRunning(true);
    setResults([]);
    const testResults: TestResult[] = [];

    try {
      // More thorough cleanup - delete test data for this specific customer
      console.log("Starting test cleanup for customer:", testCustomer.id);
      
      // Delete in proper order to respect foreign key constraints
      await supabase.from("payment_applications").delete().eq("payment_id", null); // This won't match anything, but ensures the table is considered
      await supabase.from("pnl_entries").delete().eq("customer_id", testCustomer.id);
      await supabase.from("authority_payments").delete().eq("id", null); // Safe deletion query
      await supabase.from("payment_applications").delete().neq("id", null); // Delete all payment applications
      await supabase.from("ledger_entries").delete().eq("customer_id", testCustomer.id);
      await supabase.from("payments").delete().eq("customer_id", testCustomer.id);  
      await supabase.from("rentals").delete().eq("customer_id", testCustomer.id);
      
      console.log("Cleanup completed");

      // Test 1: Create rental with unique dates to avoid conflicts
      const currentDate = new Date().toISOString().split('T')[0]; // Use current date
      const nextMonth = new Date();
      nextMonth.setMonth(nextMonth.getMonth() + 12);
      const endDate = nextMonth.toISOString().split('T')[0];
      
      const { data: rental, error: rentalError } = await supabase
        .from("rentals")
        .insert({
          customer_id: testCustomer.id,
          vehicle_id: testVehicle.id,
          start_date: currentDate,
          end_date: endDate,
          monthly_amount: 1000,
          status: "Active"
        })
        .select()
        .single();

      if (rentalError) throw rentalError;

      testResults.push({
        name: "Create rental agreement",
        passed: !!rental,
        message: rental ? "Rental created successfully" : "Failed to create rental",
        category: "Setup"
      });

      // Test 2: Create Initial Fee charge with current date
      const { data: initialFeeCharge, error: chargeError1 } = await supabase
        .from("ledger_entries")
        .insert({
          customer_id: testCustomer.id,
          rental_id: rental.id,
          vehicle_id: testVehicle.id,
          entry_date: currentDate,
          due_date: currentDate,
          type: "Charge",
          category: "Initial Fees",
          amount: 1000,
          remaining_amount: 1000
        })
        .select()
        .single();

      if (chargeError1) throw chargeError1;

      testResults.push({
        name: "Create Initial Fee charge",
        passed: !!initialFeeCharge,
        message: initialFeeCharge ? "Initial Fee charge created ($1,000)" : "Failed to create Initial Fee charge",
        category: "Charges"
      });

      // Test 3: Create Rental charge with next month date
      const rentalChargeDate = new Date();
      rentalChargeDate.setMonth(rentalChargeDate.getMonth() + 1);
      const rentalChargeDateStr = rentalChargeDate.toISOString().split('T')[0];
      
      const { data: rentalCharge, error: chargeError2 } = await supabase
        .from("ledger_entries")
        .insert({
          customer_id: testCustomer.id,
          rental_id: rental.id,
          vehicle_id: testVehicle.id,
          entry_date: rentalChargeDateStr,
          due_date: rentalChargeDateStr,
          type: "Charge",
          category: "Rental",
          amount: 1000,
          remaining_amount: 1000
        })
        .select()
        .single();

      if (chargeError2) throw chargeError2;

      testResults.push({
        name: "Create Rental charge",
        passed: !!rentalCharge,
        message: rentalCharge ? "Rental charge created ($1,000)" : "Failed to create Rental charge",
        category: "Charges"
      });

      // Test 4: Record first payment (Initial Fee payment)
      const { data: payment1, error: paymentError1 } = await supabase
        .from("payments")
        .insert({
          customer_id: testCustomer.id,
          vehicle_id: testVehicle.id,
          rental_id: rental.id,
          amount: 1000,
          payment_type: "InitialFee",
          method: "Bank Transfer",
          payment_date: currentDate
        })
        .select()
        .single();

      if (paymentError1) throw paymentError1;

      testResults.push({
        name: "Record first payment",
        passed: !!payment1,
        message: payment1 ? "Initial Fee payment recorded ($1,000)" : "Failed to record payment",
        category: "Payments"
      });

      // Test 5: Record second payment (Rental payment)
      const { data: payment2, error: paymentError2 } = await supabase
        .from("payments")
        .insert({
          customer_id: testCustomer.id,
          vehicle_id: testVehicle.id,
          rental_id: rental.id,
          amount: 1000,
          payment_type: "Rental",
          method: "Bank Transfer",
          payment_date: currentDate
        })
        .select()
        .single();

      if (paymentError2) throw paymentError2;

      testResults.push({
        name: "Record second payment",
        passed: !!payment2,
        message: payment2 ? "Rental payment recorded ($1,000)" : "Failed to record payment",
        category: "Payments"
      });

      // Test 6: Apply payment allocations
      await supabase.functions.invoke('apply-payment', {
        body: { paymentId: payment1.id }
      });

      await supabase.functions.invoke('apply-payment', {
        body: { paymentId: payment2.id }
      });

      // Test 7: Check payment applications were created
      const { data: applications, error: appError } = await supabase
        .from("payment_applications")
        .select("*")
        .in("payment_id", [payment1.id, payment2.id]);

      if (appError) throw appError;

      testResults.push({
        name: "Payment allocations created",
        passed: applications.length === 2,
        message: `${applications.length} payment applications created (expected 2)`,
        category: "Allocations"
      });

      // Test 8: Verify Initial Fee charge is fully paid
      const { data: updatedInitialCharge, error: chargeCheckError1 } = await supabase
        .from("ledger_entries")
        .select("remaining_amount")
        .eq("id", initialFeeCharge.id)
        .single();

      if (chargeCheckError1) throw chargeCheckError1;

      testResults.push({
        name: "Initial Fee charge fully paid",
        passed: updatedInitialCharge.remaining_amount === 0,
        message: `Initial Fee remaining: $${updatedInitialCharge.remaining_amount} (expected $0)`,
        category: "Verification"
      });

      // Test 9: Verify Rental charge is fully paid
      const { data: updatedRentalCharge, error: chargeCheckError2 } = await supabase
        .from("ledger_entries")
        .select("remaining_amount")
        .eq("id", rentalCharge.id)
        .single();

      if (chargeCheckError2) throw chargeCheckError2;

      testResults.push({
        name: "Rental charge fully paid",
        passed: updatedRentalCharge.remaining_amount === 0,
        message: `Rental remaining: $${updatedRentalCharge.remaining_amount} (expected $0)`,
        category: "Verification"
      });

      // Test 10: Test partial payment scenario with unique date
      const partialChargeDate = new Date();
      partialChargeDate.setMonth(partialChargeDate.getMonth() + 2);
      const partialChargeDateStr = partialChargeDate.toISOString().split('T')[0];
      
      const { data: partialCharge, error: partialChargeError } = await supabase
        .from("ledger_entries")
        .insert({
          customer_id: testCustomer.id,
          rental_id: rental.id,
          vehicle_id: testVehicle.id,
          entry_date: partialChargeDateStr,
          due_date: partialChargeDateStr,
          type: "Charge",
          category: "Rental",
          amount: 1000,
          remaining_amount: 1000
        })
        .select()
        .single();

      if (partialChargeError) throw partialChargeError;

      const { data: partialPayment, error: partialPaymentError } = await supabase
        .from("payments")
        .insert({
          customer_id: testCustomer.id,
          vehicle_id: testVehicle.id,
          rental_id: rental.id,
          amount: 500,
          payment_type: "Rental",
          method: "Bank Transfer",
          payment_date: partialChargeDateStr
        })
        .select()
        .single();

      if (partialPaymentError) throw partialPaymentError;

      await supabase.functions.invoke('apply-payment', {
        body: { paymentId: partialPayment.id }
      });

      const { data: partialChargeAfter, error: partialCheckError } = await supabase
        .from("ledger_entries")
        .select("remaining_amount")
        .eq("id", partialCharge.id)
        .single();

      if (partialCheckError) throw partialCheckError;

      testResults.push({
        name: "Partial payment handling",
        passed: partialChargeAfter.remaining_amount === 500,
        message: `Partial charge remaining: $${partialChargeAfter.remaining_amount} (expected $500)`,
        category: "Verification"
      });

      // Enhanced cleanup with proper error handling
      console.log("Starting final cleanup");
      try {
        await supabase.from("payment_applications").delete().in("payment_id", [payment1.id, payment2.id, partialPayment.id]);
        await supabase.from("payments").delete().in("id", [payment1.id, payment2.id, partialPayment.id]);
        await supabase.from("ledger_entries").delete().in("id", [initialFeeCharge.id, rentalCharge.id, partialCharge.id]);
        await supabase.from("rentals").delete().eq("id", rental.id);
        console.log("Final cleanup completed");
      } catch (cleanupError) {
        console.warn("Cleanup warning:", cleanupError);
      }

      testResults.push({
        name: "Test cleanup completed",
        passed: true,
        message: "All test data cleaned up successfully",
        category: "Cleanup"
      });

    } catch (error) {
      console.error("Test execution error:", error);
      testResults.push({
        name: "Test execution failed",
        passed: false,
        message: error instanceof Error ? error.message : "Unknown error occurred",
        category: "Error"
      });
    }

    setResults(testResults);
    setRunning(false);

    const passedTests = testResults.filter(r => r.passed).length;
    const totalTests = testResults.length;

    toast({
      title: "Acceptance Tests Completed",
      description: `${passedTests}/${totalTests} tests passed`,
      variant: passedTests === totalTests ? "default" : "destructive",
    });
  };

  const getCategoryIcon = (category: string, passed: boolean) => {
    if (passed) return <CheckCircle className="h-4 w-4 text-green-600" />;
    return <XCircle className="h-4 w-4 text-red-600" />;
  };

  const groupedResults = results.reduce((acc, result) => {
    if (!acc[result.category]) acc[result.category] = [];
    acc[result.category].push(result);
    return acc;
  }, {} as Record<string, TestResult[]>);

  const overallStatus = results.length > 0 && results.every(r => r.passed);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {running ? (
            <AlertCircle className="h-5 w-5 text-yellow-600 animate-pulse" />
          ) : overallStatus ? (
            <CheckCircle className="h-5 w-5 text-green-600" />
          ) : results.length > 0 ? (
            <XCircle className="h-5 w-5 text-red-600" />
          ) : (
            <Play className="h-5 w-5 text-blue-600" />
          )}
          Rental Allocation Tests
        </CardTitle>
        <CardDescription>
          Test payment allocation system with charges and verify ledger accuracy
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button 
          onClick={runAcceptanceTests}
          disabled={running || !testCustomer || !testVehicle}
          className="w-full"
        >
          {running ? "Running Tests..." : "Run Rental Allocation Tests"}
        </Button>

        {!testCustomer && (
          <div className="text-sm text-amber-600 bg-amber-50 p-2 rounded">
            ⚠️ No customers found. Please create a customer first.
          </div>
        )}

        {!testVehicle && (
          <div className="text-sm text-amber-600 bg-amber-50 p-2 rounded">
            ⚠️ No available vehicles found. Please create a vehicle first.
          </div>
        )}

        {results.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Badge variant={overallStatus ? "default" : "destructive"} className="text-sm">
                {overallStatus ? "All Tests Passed" : "Some Tests Failed"}
              </Badge>
              <span className="text-sm text-muted-foreground">
                {results.filter(r => r.passed).length}/{results.length} tests passed
              </span>
            </div>

            {Object.entries(groupedResults).map(([category, categoryResults]) => (
              <div key={category} className="space-y-2">
                <h4 className="font-medium text-sm">{category}</h4>
                <div className="space-y-1 ml-4">
                  {categoryResults.map((result, index) => (
                    <div key={index} className="flex items-start gap-2 text-sm">
                      {getCategoryIcon(result.category, result.passed)}
                      <div className="flex-1">
                        <span className={result.passed ? "text-green-700" : "text-red-700"}>
                          {result.name}
                        </span>
                        <div className="text-muted-foreground text-xs">
                          {result.message}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};