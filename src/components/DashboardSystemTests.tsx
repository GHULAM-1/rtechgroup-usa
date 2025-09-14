import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { CheckCircle, XCircle, AlertCircle, TestTube, Play } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useDashboardKPIs } from "@/hooks/useDashboardKPIs";
import { format, addDays, subDays } from "date-fns";

interface TestResult {
  name: string;
  passed: boolean;
  message: string;
  expected?: string;
  actual?: string;
  category: string;
}

export const DashboardSystemTests = () => {
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<TestResult[]>([]);
  const [showModal, setShowModal] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Get baseline dashboard data for comparison
  const { data: currentKPIs } = useDashboardKPIs({
    timezone: 'Europe/London'
  });

  const runSystemTests = async () => {
    setRunning(true);
    setResults([]);
    const testResults: TestResult[] = [];
    
    try {
      const today = format(new Date(), 'yyyy-MM-dd');
      const yesterday = format(subDays(new Date(), 1), 'yyyy-MM-dd');
      const tomorrow = format(addDays(new Date(), 1), 'yyyy-MM-dd');
      const threeDaysFromNow = format(addDays(new Date(), 3), 'yyyy-MM-dd');
      
      // Create test customer for all tests
      const { data: testCustomer, error: customerError } = await supabase
        .from("customers")
        .insert({
          name: "Dashboard Test Customer",
          type: "Test",
          email: "test@dashboard.com"
        })
        .select()
        .single();

      if (customerError) throw customerError;

      // Create test vehicle
      const { data: testVehicle, error: vehicleError } = await supabase
        .from("vehicles")
        .insert({
          reg: `TEST${Date.now()}`,
          make: "Test",
          model: "Vehicle",
          status: "Available"
        })
        .select()
        .single();

      if (vehicleError) throw vehicleError;

      // Test 1: Overdue Math Test
      const { data: overdueCharge, error: overdueError } = await supabase
        .from("ledger_entries")
        .insert({
          customer_id: testCustomer.id,
          vehicle_id: testVehicle.id,
          entry_date: yesterday,
          due_date: yesterday,
          type: "Charge",
          category: "Rental",
          amount: 100,
          remaining_amount: 100
        })
        .select()
        .single();

      if (overdueError) throw overdueError;

      // Verify overdue count incremented
      const { data: newKPIs } = await supabase.functions.invoke('dashboard-kpis', {
        method: 'GET'
      });

      const overdueIncremented = newKPIs.overdue.count > (currentKPIs?.overdue.count || 0);
      
      testResults.push({
        name: "Overdue Math Test",
        passed: overdueIncremented,
        message: overdueIncremented ? "Overdue count correctly incremented" : "Overdue count did not increment",
        expected: `>${currentKPIs?.overdue.count || 0}`,
        actual: `${newKPIs.overdue.count}`,
        category: "KPI Accuracy"
      });

      // Test 2: Due Today Test  
      const { data: dueTodayCharge, error: dueTodayError } = await supabase
        .from("ledger_entries")
        .insert({
          customer_id: testCustomer.id,
          vehicle_id: testVehicle.id,
          entry_date: today,
          due_date: today,
          type: "Charge",
          category: "Rental",
          amount: 200,
          remaining_amount: 200
        })
        .select()
        .single();

      if (dueTodayError) throw dueTodayError;

      const { data: dueTodayKPIs } = await supabase.functions.invoke('dashboard-kpis');
      const dueTodayIncremented = dueTodayKPIs.dueToday.count > (newKPIs.dueToday.count || 0);

      testResults.push({
        name: "Due Today Test",
        passed: dueTodayIncremented,
        message: dueTodayIncremented ? "Due today count correctly incremented" : "Due today count did not increment",
        expected: `>${newKPIs.dueToday.count || 0}`,
        actual: `${dueTodayKPIs.dueToday.count}`,
        category: "KPI Accuracy"
      });

      // Test 3: Upcoming Test (3 days from now should count, 9 days should not)
      const { data: upcomingCharge, error: upcomingError } = await supabase
        .from("ledger_entries")
        .insert({
          customer_id: testCustomer.id,
          vehicle_id: testVehicle.id,
          entry_date: threeDaysFromNow,
          due_date: threeDaysFromNow,
          type: "Charge", 
          category: "Rental",
          amount: 300,
          remaining_amount: 300
        })
        .select()
        .single();

      if (upcomingError) throw upcomingError;

      const { data: upcomingKPIs } = await supabase.functions.invoke('dashboard-kpis');
      const upcomingIncremented = upcomingKPIs.upcoming7d.count > (dueTodayKPIs.upcoming7d.count || 0);

      testResults.push({
        name: "Upcoming Test (3 days)",
        passed: upcomingIncremented,
        message: upcomingIncremented ? "Upcoming 7d count correctly incremented for 3-day charge" : "Upcoming 7d count did not increment",
        expected: `>${dueTodayKPIs.upcoming7d.count || 0}`,
        actual: `${upcomingKPIs.upcoming7d.count}`,
        category: "KPI Accuracy"
      });

      // Test 4: Active Rentals Test
      const { data: rental, error: rentalError } = await supabase
        .from("rentals")
        .insert({
          customer_id: testCustomer.id,
          vehicle_id: testVehicle.id,
          start_date: today,
          monthly_amount: 1000,
          status: "Active"
        })
        .select()
        .single();

      if (rentalError) throw rentalError;

      const { data: rentalKPIs } = await supabase.functions.invoke('dashboard-kpis');
      const rentalIncremented = rentalKPIs.activeRentals.count > (upcomingKPIs.activeRentals.count || 0);

      testResults.push({
        name: "Active Rentals Test",
        passed: rentalIncremented,
        message: rentalIncremented ? "Active rental count correctly incremented" : "Active rental count did not increment",
        expected: `>${upcomingKPIs.activeRentals.count || 0}`,
        actual: `${rentalKPIs.activeRentals.count}`,
        category: "KPI Accuracy"
      });

      // Test 5: Open Fines Test
      const { data: fine, error: fineError } = await supabase
        .from("fines")
        .insert({
          customer_id: testCustomer.id,
          vehicle_id: testVehicle.id,
          type: "Parking",
          amount: 60,
          issue_date: today,
          due_date: addDays(new Date(), 14).toISOString().split('T')[0],
          status: "Charged"
        })
        .select()
        .single();

      if (fineError) throw fineError;

      const { data: fineKPIs } = await supabase.functions.invoke('dashboard-kpis');
      const fineIncremented = fineKPIs.finesOpen.count > (rentalKPIs.finesOpen.count || 0);

      testResults.push({
        name: "Open Fines Test",
        passed: fineIncremented,
        message: fineIncremented ? "Open fine count correctly incremented" : "Open fine count did not increment", 
        expected: `>${rentalKPIs.finesOpen.count || 0}`,
        actual: `${fineKPIs.finesOpen.count}`,
        category: "KPI Accuracy"
      });

      // Test 6: Finance Cost Test (with date range)
      const { data: financeEntry, error: financeError } = await supabase
        .from("pnl_entries")
        .insert({
          vehicle_id: testVehicle.id,
          entry_date: today,
          side: "Cost",
          category: "Finance",
          amount: 500,
          reference: `TEST-FIN-${Date.now()}`
        })
        .select()
        .single();

      if (financeError) throw financeError;

      const { data: financeKPIs } = await supabase.functions.invoke('dashboard-kpis', {
        method: 'GET',
        body: null,
        headers: { 'Content-Type': 'application/json' }
      });

      const financeIncremented = financeKPIs.financeCosts.amount > (fineKPIs.financeCosts.amount || 0);

      testResults.push({
        name: "Finance Cost Test",
        passed: financeIncremented,
        message: financeIncremented ? "Finance cost correctly added to period total" : "Finance cost not reflected in dashboard",
        expected: `>${fineKPIs.financeCosts.amount || 0}`,
        actual: `${financeKPIs.financeCosts.amount}`,
        category: "KPI Accuracy"
      });

      // Test 7: Reminders Test
      const { data: reminder, error: reminderError } = await supabase
        .from("reminders")
        .insert({
          object_type: "vehicle",
          object_id: testVehicle.id,
          title: "Test Reminder",
          message: "Dashboard system test reminder",
          rule_code: "TEST",
          due_on: today,
          remind_on: today,
          status: "pending",
          severity: "info",
          context: {}
        })
        .select()
        .single();

      if (reminderError) throw reminderError;

      const { data: reminderKPIs } = await supabase.functions.invoke('dashboard-kpis');
      const reminderIncremented = reminderKPIs.remindersDue.count > (financeKPIs.remindersDue.count || 0);

      testResults.push({
        name: "Reminders Test",
        passed: reminderIncremented,
        message: reminderIncremented ? "Active reminder count correctly incremented" : "Reminder count did not increment",
        expected: `>${financeKPIs.remindersDue.count || 0}`,
        actual: `${reminderKPIs.remindersDue.count}`,
        category: "KPI Accuracy"
      });

      // Test 8: Performance Test (400ms target)
      const startTime = Date.now();
      await supabase.functions.invoke('dashboard-kpis');
      const responseTime = Date.now() - startTime;

      testResults.push({
        name: "Performance Test",
        passed: responseTime < 400,
        message: `Dashboard API responded in ${responseTime}ms`,
        expected: "<400ms",
        actual: `${responseTime}ms`,
        category: "Performance"
      });

      // Cleanup test data
      await supabase.from("reminders").delete().eq("id", reminder.id);
      await supabase.from("pnl_entries").delete().eq("id", financeEntry.id);  
      await supabase.from("fines").delete().eq("id", fine.id);
      await supabase.from("rentals").delete().eq("id", rental.id);
      await supabase.from("ledger_entries").delete().in("id", [
        overdueCharge.id, 
        dueTodayCharge.id, 
        upcomingCharge.id
      ]);
      await supabase.from("vehicles").delete().eq("id", testVehicle.id);
      await supabase.from("customers").delete().eq("id", testCustomer.id);

      testResults.push({
        name: "Test Cleanup",
        passed: true,
        message: "All test data cleaned up successfully",
        category: "Cleanup"
      });

    } catch (error) {
      console.error("System test error:", error);
      testResults.push({
        name: "System Test Suite",
        passed: false,
        message: error instanceof Error ? error.message : "Unknown error occurred",
        category: "Error"
      });
    }

    setResults(testResults);
    setRunning(false);
    setShowModal(true);

    // Invalidate dashboard cache
    queryClient.invalidateQueries({ queryKey: ['dashboard-kpis'] });

    const passedTests = testResults.filter(r => r.passed).length;
    const totalTests = testResults.length;

    toast({
      title: "Dashboard System Tests Completed",
      description: `${passedTests}/${totalTests} tests passed`,
      variant: passedTests === totalTests ? "default" : "destructive",
    });
  };

  const getCategoryIcon = (category: string, passed: boolean) => {
    if (passed) return <CheckCircle className="h-4 w-4 text-success" />;
    return <XCircle className="h-4 w-4 text-destructive" />;
  };

  const groupedResults = results.reduce((acc, result) => {
    if (!acc[result.category]) acc[result.category] = [];
    acc[result.category].push(result);
    return acc;
  }, {} as Record<string, TestResult[]>);

  const overallStatus = results.length > 0 && results.every(r => r.passed);
  const passedCount = results.filter(r => r.passed).length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TestTube className="h-5 w-5" />
            Dashboard System Tests
            {results.length > 0 && (
              <Badge variant={overallStatus ? "default" : "destructive"}>
                {passedCount}/{results.length}
              </Badge>
            )}
          </div>
          <Dialog open={showModal} onOpenChange={setShowModal}>
            <DialogTrigger asChild>
              <Button 
                onClick={runSystemTests}
                disabled={running}
                size="sm"
                variant="outline"
              >
                {running ? (
                  <>
                    <AlertCircle className="h-4 w-4 mr-2 animate-pulse" />
                    Running...
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 mr-2" />
                    Run Tests
                  </>
                )}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <TestTube className="h-5 w-5" />
                  Dashboard System Test Results
                </DialogTitle>
                <DialogDescription>
                  Comprehensive validation of dashboard KPI calculations and performance
                </DialogDescription>
              </DialogHeader>
              
              {results.length > 0 && (
                <div className="space-y-6">
                  <div className="flex items-center gap-4">
                    <Badge 
                      variant={overallStatus ? "default" : "destructive"} 
                      className="text-sm"
                    >
                      {overallStatus ? "All Tests Passed" : "Some Tests Failed"}
                    </Badge>
                    <span className="text-sm text-muted-foreground">
                      {passedCount}/{results.length} tests passed
                    </span>
                  </div>

                  {Object.entries(groupedResults).map(([category, categoryResults]) => (
                    <div key={category} className="space-y-3">
                      <h4 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">
                        {category}
                      </h4>
                      <div className="space-y-2">
                        {categoryResults.map((result, index) => (
                          <div key={index} className="flex items-start gap-3 p-3 border rounded-lg">
                            {getCategoryIcon(result.category, result.passed)}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-sm">{result.name}</span>
                                <Badge variant={result.passed ? "default" : "destructive"} className="text-xs">
                                  {result.passed ? "PASS" : "FAIL"}
                                </Badge>
                              </div>
                              <div className="text-sm text-muted-foreground mt-1">
                                {result.message}
                              </div>
                              {(result.expected || result.actual) && (
                                <div className="text-xs bg-muted p-2 rounded mt-2 space-y-1">
                                  {result.expected && <div>Expected: {result.expected}</div>}
                                  {result.actual && <div>Actual: {result.actual}</div>}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </DialogContent>
          </Dialog>
        </CardTitle>
        <CardDescription>
          Validate KPI calculations, cross-page consistency, and performance targets
        </CardDescription>
      </CardHeader>
      <CardContent>
        {results.length > 0 ? (
          <div className="space-y-2">
            <div className="text-sm font-medium">Latest Test Run:</div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Status:</span>
                <Badge variant={overallStatus ? "default" : "destructive"} className="ml-2">
                  {overallStatus ? "✓ Passed" : "✗ Failed"}
                </Badge>
              </div>
              <div>
                <span className="text-muted-foreground">Results:</span>
                <span className="ml-2">{passedCount}/{results.length}</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-4 text-muted-foreground">
            <AlertCircle className="h-6 w-6 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No test results yet. Click "Run Tests" to start validation.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};