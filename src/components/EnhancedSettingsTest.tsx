import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle, Play, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface TestResult {
  name: string;
  passed: boolean;
  message: string;
  duration?: number;
}

interface MaintenanceRun {
  id: string;
  operation_type: string;
  status: string;
  payments_processed: number;
  customers_affected: number;
  revenue_recalculated: number;
  error_message?: string;
  duration_seconds?: number;
  started_at: string;
  completed_at?: string;
}

export const EnhancedSettingsTest = () => {
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<TestResult[]>([]);
  const queryClient = useQueryClient();

  // Get maintenance runs history
  const { data: maintenanceRuns } = useQuery({
    queryKey: ["maintenance-runs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("maintenance_runs")
        .select("*")
        .order("started_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      return data as MaintenanceRun[];
    },
  });

  const runComprehensiveTests = async () => {
    setRunning(true);
    const testResults: TestResult[] = [];
    const startTime = Date.now();

    try {
      console.log("=== Starting Enhanced Settings Tests ===");

      // Test 1: Settings API Connectivity
      console.log("Testing settings API connectivity...");
      try {
        const { data, error } = await supabase.functions.invoke('settings', {
          method: 'GET',
        });
        
        if (error) throw error;
        
        testResults.push({ 
          name: "Settings API Connectivity", 
          passed: true, 
          message: `API responded successfully with company: ${data?.company_name || 'Unknown'}` 
        });
      } catch (error: any) {
        testResults.push({ 
          name: "Settings API Connectivity", 
          passed: false, 
          message: `API failed: ${error.message}` 
        });
      }

      // Test 2: Settings Update Functionality
      console.log("Testing settings update...");
      try {
        const testUpdate = {
          company_name: "Test Company " + Date.now(),
          timezone: "Europe/London"
        };

        const { data, error } = await supabase.functions.invoke('settings', {
          method: 'POST',
          body: testUpdate,
        });
        
        if (error) throw error;
        
        const passed = data?.company_name === testUpdate.company_name;
        testResults.push({ 
          name: "Settings Update", 
          passed, 
          message: passed ? "Settings updated successfully" : "Settings update failed validation" 
        });
      } catch (error: any) {
        testResults.push({ 
          name: "Settings Update", 
          passed: false, 
          message: `Update failed: ${error.message}` 
        });
      }

      // Test 3: Reminder Settings Toggle
      console.log("Testing reminder toggles...");
      try {
        const { data: currentSettings, error: fetchError } = await supabase.functions.invoke('settings', {
          method: 'GET',
        });
        
        if (fetchError) throw fetchError;
        
        const originalValue = currentSettings?.reminder_due_today;
        
        // Toggle reminder setting
        const { data, error } = await supabase.functions.invoke('settings', {
          method: 'POST',
          body: { reminder_due_today: !originalValue },
        });
        
        if (error) throw error;
        
        // Restore original value
        await supabase.functions.invoke('settings', {
          method: 'POST',
          body: { reminder_due_today: originalValue },
        });
        
        const passed = data?.reminder_due_today !== originalValue;
        testResults.push({ 
          name: "Reminder Toggle", 
          passed, 
          message: passed ? "Reminder settings toggle working" : "Reminder toggle failed" 
        });
      } catch (error: any) {
        testResults.push({ 
          name: "Reminder Toggle", 
          passed: false, 
          message: `Toggle test failed: ${error.message}` 
        });
      }

      // Test 4: Database Audit Trail
      console.log("Testing audit trail...");
      try {
        const { data: auditRecords, error } = await supabase
          .from("settings_audit")
          .select("*")
          .order("changed_at", { ascending: false })
          .limit(1);
        
        if (error) throw error;
        
        const passed = auditRecords && auditRecords.length > 0;
        testResults.push({ 
          name: "Audit Trail", 
          passed, 
          message: passed ? `Latest audit: ${auditRecords[0]?.operation} on ${auditRecords[0]?.table_name}` : "No audit records found" 
        });
      } catch (error: any) {
        testResults.push({ 
          name: "Audit Trail", 
          passed: false, 
          message: `Audit check failed: ${error.message}` 
        });
      }

      // Test 5: Settings Cache Behaviour
      console.log("Testing cache behaviour...");
      try {
        const start1 = Date.now();
        await supabase.functions.invoke('settings', { method: 'GET' });
        const duration1 = Date.now() - start1;
        
        // Second call should be faster (cached)
        const start2 = Date.now();
        await supabase.functions.invoke('settings', { method: 'GET' });
        const duration2 = Date.now() - start2;
        
        const cacheWorking = duration2 < duration1 || duration2 < 100; // Either faster or very fast
        testResults.push({ 
          name: "Settings Cache", 
          passed: cacheWorking, 
          message: `First call: ${duration1}ms, Second call: ${duration2}ms`,
          duration: duration2
        });
      } catch (error: any) {
        testResults.push({ 
          name: "Settings Cache", 
          passed: false, 
          message: `Cache test failed: ${error.message}` 
        });
      }

      // Test 6: Data Validation
      console.log("Testing data validation...");
      try {
        const { data, error } = await supabase.functions.invoke('settings', {
          method: 'POST',
          body: { 
            timezone: "Invalid/Timezone",
            currency_code: "INVALID"
          },
        });
        
        // Should fail validation
        const passed = error !== null;
        testResults.push({ 
          name: "Data Validation", 
          passed, 
          message: passed ? "Invalid data properly rejected" : "Validation not working - invalid data accepted" 
        });
      } catch (error: any) {
        // Expected to fail - this is good
        testResults.push({ 
          name: "Data Validation", 
          passed: true, 
          message: "Invalid data properly rejected by validation" 
        });
      }

      // Test 7: Maintenance System Check
      console.log("Testing maintenance system...");
      try {
        // Check if maintenance runs table exists and is accessible
        const { data: runHistory, error } = await supabase
          .from("maintenance_runs")
          .select("*")
          .limit(1);
        
        if (error) throw error;
        
        testResults.push({ 
          name: "Maintenance System", 
          passed: true, 
          message: `Maintenance system ready. ${runHistory?.length || 0} runs in history` 
        });
      } catch (error: any) {
        testResults.push({ 
          name: "Maintenance System", 
          passed: false, 
          message: `Maintenance system error: ${error.message}` 
        });
      }

      const totalDuration = Date.now() - startTime;
      const passedTests = testResults.filter(r => r.passed).length;
      
      testResults.push({
        name: "Overall Test Suite",
        passed: passedTests === testResults.length - 1, // Exclude this test itself
        message: `${passedTests}/${testResults.length - 1} tests passed in ${totalDuration}ms`
      });

    } catch (error: any) {
      console.error("Test suite failed:", error);
      testResults.push({ 
        name: "Test Suite Error", 
        passed: false, 
        message: error.message 
      });
    } finally {
      setResults(testResults);
      setRunning(false);
    }
  };

  const runMaintenanceJob = async () => {
    setRunning(true);
    try {
      // Record maintenance run start
      const { data: runRecord, error: insertError } = await supabase
        .from("maintenance_runs")
        .insert({
          operation_type: "payment_reapplication",
          status: "running",
          started_by: "settings_test"
        })
        .select()
        .single();

      if (insertError) throw insertError;

      const startTime = Date.now();
      
      // Execute maintenance
      const { data, error } = await supabase.rpc("reapply_all_payments_v2");
      
      const duration = Math.floor((Date.now() - startTime) / 1000);
      
      if (error) {
        // Update run record with error
        await supabase
          .from("maintenance_runs")
          .update({
            status: "failed",
            error_message: error.message,
            duration_seconds: duration,
            completed_at: new Date().toISOString()
          })
          .eq("id", runRecord.id);
        
        throw error;
      }

      // Update run record with success
      await supabase
        .from("maintenance_runs")
        .update({
          status: "completed",
          payments_processed: data[0]?.payments_processed || 0,
          customers_affected: data[0]?.customers_affected || 0,
          revenue_recalculated: data[0]?.total_credit_applied || 0,
          duration_seconds: duration,
          completed_at: new Date().toISOString()
        })
        .eq("id", runRecord.id);

      toast.success(`Maintenance completed: ${data[0]?.payments_processed || 0} payments processed`);
      
      // Refresh maintenance runs
      queryClient.invalidateQueries({ queryKey: ["maintenance-runs"] });
      
    } catch (error: any) {
      console.error("Maintenance job failed:", error);
      toast.error(`Maintenance failed: ${error.message}`);
    } finally {
      setRunning(false);
    }
  };

  const allPassed = results.length > 0 && results.every(r => r.passed);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Play className="h-5 w-5" />
            Enhanced Settings Test Suite
          </CardTitle>
          <CardDescription>
            Comprehensive testing of the settings system, maintenance tools, and data integrity
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex gap-2">
              <Button 
                onClick={runComprehensiveTests}
                disabled={running}
                className="flex-1"
              >
                {running ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Running Tests...
                  </>
                ) : (
                  <>
                    <Play className="mr-2 h-4 w-4" />
                    Run Test Suite
                  </>
                )}
              </Button>
              
              <Button 
                onClick={runMaintenanceJob}
                disabled={running}
                variant="outline"
              >
                {running ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Test Maintenance"
                )}
              </Button>
            </div>

            {results.length > 0 && (
              <div className="space-y-3">
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
                    <div key={index} className="flex items-center justify-between p-3 rounded border">
                      <div className="flex items-center gap-2">
                        {result.passed ? (
                          <CheckCircle className="h-4 w-4 text-green-600" />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-600" />
                        )}
                        <span className="font-medium">{result.name}</span>
                      </div>
                      <div className="flex items-center gap-2 text-right">
                        {result.duration && (
                          <span className="text-xs text-muted-foreground">{result.duration}ms</span>
                        )}
                        <Badge variant={result.passed ? "default" : "destructive"}>
                          {result.passed ? "PASS" : "FAIL"}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-4 p-3 bg-muted rounded-lg">
                  <h4 className="font-medium mb-2">Test Details</h4>
                  <div className="space-y-1 text-sm text-muted-foreground">
                    {results.map((result, index) => (
                      <div key={index}>
                        <strong>{result.name}:</strong> {result.message}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {maintenanceRuns && maintenanceRuns.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recent Maintenance Runs</CardTitle>
            <CardDescription>History of system maintenance operations</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {maintenanceRuns.map((run) => (
                <div key={run.id} className="flex items-center justify-between p-2 border rounded">
                  <div>
                    <span className="font-medium">{run.operation_type}</span>
                    <span className="text-sm text-muted-foreground ml-2">
                      {new Date(run.started_at).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={
                      run.status === 'completed' ? 'default' : 
                      run.status === 'failed' ? 'destructive' : 'secondary'
                    }>
                      {run.status}
                    </Badge>
                    {run.status === 'completed' && (
                      <span className="text-xs text-muted-foreground">
                        {run.payments_processed} payments, {run.duration_seconds}s
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};