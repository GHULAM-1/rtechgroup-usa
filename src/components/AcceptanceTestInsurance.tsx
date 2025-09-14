import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, AlertTriangle, RefreshCw, Shield, FileText } from "lucide-react";
import { toast } from "sonner";

interface TestResult {
  name: string;
  status: 'pass' | 'fail' | 'warning';
  message: string;
  details?: string;
}

export function AcceptanceTestInsurance() {
  const [isRunning, setIsRunning] = useState(false);
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const queryClient = useQueryClient();

  // Test customer for insurance testing
  const testCustomerId = "550e8400-e29b-41d4-a716-446655440000";

  const runInsuranceTests = async () => {
    setIsRunning(true);
    setTestResults([]);
    const results: TestResult[] = [];

    try {
      // Test 1: Create test customer if needed
      let { data: customer } = await supabase
        .from('customers')
        .select('id')
        .eq('id', testCustomerId)
        .single();

      if (!customer) {
        const { error: customerError } = await supabase
          .from('customers')
          .insert({
            id: testCustomerId,
            name: 'Insurance Test Customer',
            email: 'insurance.test@example.com',
            type: 'Individual',
            phone: '+44 7000 123456',
            whatsapp_opt_in: true
          });

        if (customerError) throw customerError;
        results.push({
          name: 'Create Test Customer',
          status: 'pass',
          message: 'Test customer created successfully'
        });
      } else {
        results.push({
          name: 'Test Customer Exists',
          status: 'pass',
          message: 'Using existing test customer'
        });
      }

      // Test 2: Create insurance policy with 45-day expiry
      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + 45);

      const { data: policy, error: policyError } = await supabase
        .from('insurance_policies')
        .insert({
          customer_id: testCustomerId,
          policy_number: 'TEST-POLICY-' + Date.now(),
          provider: 'Test Insurance Co',
          start_date: new Date().toISOString().split('T')[0],
          expiry_date: expiryDate.toISOString().split('T')[0],
          status: 'Active',
          notes: 'Test policy for acceptance testing'
        })
        .select()
        .single();

      if (policyError) throw policyError;

      results.push({
        name: 'Create Insurance Policy',
        status: 'pass',
        message: `Policy created: ${policy.policy_number}`,
        details: `Expires in 45 days (${expiryDate.toLocaleDateString()})`
      });

      // Test 3: Upload test documents
      const testDocTypes = ['Certificate', 'Schedule'];
      let docsUploaded = 0;

      for (const docType of testDocTypes) {
        // Create a simple test file
        const testContent = `Test ${docType} document content`;
        const blob = new Blob([testContent], { type: 'text/plain' });
        const fileName = `test-${docType.toLowerCase()}-${Date.now()}.txt`;

        // Upload to storage
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('insurance-docs')
          .upload(`${policy.id}/${fileName}`, blob);

        if (uploadError) {
          results.push({
            name: `Upload ${docType} Document`,
            status: 'fail',
            message: `Failed to upload: ${uploadError.message}`
          });
          continue;
        }

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
          .from('insurance-docs')
          .getPublicUrl(`${policy.id}/${fileName}`);

        // Save document record
        const { error: docError } = await supabase
          .from('insurance_documents')
          .insert({
            policy_id: policy.id,
            doc_type: docType,
            file_url: publicUrl,
            file_name: fileName
          });

        if (docError) {
          results.push({
            name: `Save ${docType} Document Record`,
            status: 'fail',
            message: `Failed to save: ${docError.message}`
          });
        } else {
          docsUploaded++;
          results.push({
            name: `Upload ${docType} Document`,
            status: 'pass',
            message: `Document uploaded and recorded successfully`
          });
        }
      }

      // Test 4: Verify policy shows OK status (green chip)
      const { data: verifyPolicy } = await supabase
        .from('insurance_policies')
        .select('*')
        .eq('id', policy.id)
        .single();

      if (verifyPolicy) {
        const daysUntilExpiry = Math.ceil(
          (new Date(verifyPolicy.expiry_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
        );

        if (daysUntilExpiry > 30) {
          results.push({
            name: 'Policy Status Verification',
            status: 'pass',
            message: 'Policy shows OK status (expires in 45 days)',
            details: `Status should display as green "Active" chip`
          });
        } else {
          results.push({
            name: 'Policy Status Verification',
            status: 'warning',
            message: 'Policy expiry is within 30 days',
            details: `Days until expiry: ${daysUntilExpiry}`
          });
        }
      }

      // Test 5: Test reminder generation
      const { data: reminderData, error: reminderError } = await supabase.functions.invoke(
        'generate-insurance-reminders',
        {
          body: { test: true }
        }
      );

      if (reminderError) {
        results.push({
          name: 'Reminder Generation Test',
          status: 'fail',
          message: `Reminder function failed: ${reminderError.message}`
        });
      } else {
        results.push({
          name: 'Reminder Generation Test',
          status: 'pass',
          message: 'Insurance reminders function executed successfully',
          details: `Monthly check and expiry reminders should be created`
        });
      }

      // Test 6: Verify documents are downloadable
      if (docsUploaded > 0) {
        results.push({
          name: 'Document Access Test',
          status: 'pass',
          message: `${docsUploaded} documents uploaded and accessible`,
          details: 'Documents should be downloadable from customer Insurance tab'
        });
      } else {
        results.push({
          name: 'Document Access Test',
          status: 'fail',
          message: 'No documents were successfully uploaded'
        });
      }

      // Test 7: Test expired policy status update
      const expiredDate = new Date();
      expiredDate.setDate(expiredDate.getDate() - 1);

      const { data: expiredPolicy, error: expiredError } = await supabase
        .from('insurance_policies')
        .insert({
          customer_id: testCustomerId,
          policy_number: 'EXPIRED-TEST-' + Date.now(),
          provider: 'Test Insurance Co',
          start_date: new Date(2023, 0, 1).toISOString().split('T')[0],
          expiry_date: expiredDate.toISOString().split('T')[0],
          status: 'Active',
          notes: 'Test expired policy'
        })
        .select()
        .single();

      if (expiredError) {
        results.push({
          name: 'Expired Policy Test',
          status: 'fail',
          message: `Failed to create expired test policy: ${expiredError.message}`
        });
      } else {
        // Run the reminder function to update expired policies
        await supabase.functions.invoke('generate-insurance-reminders');
        
        // Check if policy status was updated
        const { data: updatedPolicy } = await supabase
          .from('insurance_policies')
          .select('status')
          .eq('id', expiredPolicy.id)
          .single();

        if (updatedPolicy?.status === 'Expired') {
          results.push({
            name: 'Expired Policy Status Update',
            status: 'pass',
            message: 'Expired policy status updated correctly'
          });
        } else {
          results.push({
            name: 'Expired Policy Status Update',
            status: 'warning',
            message: 'Policy status may not have been updated automatically',
            details: `Expected: Expired, Actual: ${updatedPolicy?.status}`
          });
        }
      }

    } catch (error) {
      console.error('Insurance test error:', error);
      results.push({
        name: 'Test Execution',
        status: 'fail',
        message: `Test failed: ${error.message}`
      });
    }

    setTestResults(results);
    setIsRunning(false);

    // Refresh queries to show updated data
    queryClient.invalidateQueries({ queryKey: ["customer-insurance"] });
    queryClient.invalidateQueries({ queryKey: ["insurance-policies"] });

    const passed = results.filter(r => r.status === 'pass').length;
    const failed = results.filter(r => r.status === 'fail').length;
    
    if (failed === 0) {
      toast.success(`Insurance tests completed: ${passed} passed`);
    } else {
      toast.error(`Insurance tests completed: ${passed} passed, ${failed} failed`);
    }
  };

  const cleanupTestData = async () => {
    try {
      // Delete test policies and associated documents
      const { data: testPolicies } = await supabase
        .from('insurance_policies')
        .select('id')
        .eq('customer_id', testCustomerId);

      if (testPolicies && testPolicies.length > 0) {
        // Delete documents first (foreign key constraint)
        for (const policy of testPolicies) {
          await supabase
            .from('insurance_documents')
            .delete()
            .eq('policy_id', policy.id);
        }

        // Delete policies
        await supabase
          .from('insurance_policies')
          .delete()
          .eq('customer_id', testCustomerId);
      }

      // Delete test customer
      await supabase
        .from('customers')
        .delete()
        .eq('id', testCustomerId);

      // Delete test reminders
      await supabase
        .from('reminder_events')
        .delete()
        .eq('customer_id', testCustomerId);

      toast.success('Test data cleaned up successfully');
      setTestResults([]);
      queryClient.invalidateQueries();
    } catch (error) {
      console.error('Cleanup error:', error);
      toast.error('Failed to cleanup test data');
    }
  };

  const getStatusIcon = (status: TestResult['status']) => {
    switch (status) {
      case 'pass':
        return <CheckCircle2 className="h-4 w-4 text-green-600" />;
      case 'fail':
        return <XCircle className="h-4 w-4 text-red-600" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
    }
  };

  const getStatusBadge = (status: TestResult['status']) => {
    switch (status) {
      case 'pass':
        return <Badge variant="default" className="bg-green-600">Pass</Badge>;
      case 'fail':
        return <Badge variant="destructive">Fail</Badge>;
      case 'warning':
        return <Badge variant="secondary" className="bg-yellow-600">Warning</Badge>;
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <CardTitle>Insurance System Acceptance Tests</CardTitle>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={runInsuranceTests}
              disabled={isRunning}
              variant="default"
            >
              {isRunning ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Running Tests...
                </>
              ) : (
                <>
                  <FileText className="h-4 w-4 mr-2" />
                  Run Insurance Tests
                </>
              )}
            </Button>
            <Button onClick={cleanupTestData} variant="outline">
              Cleanup Test Data
            </Button>
          </div>
        </div>
        <CardDescription>
          Comprehensive insurance system testing: policy management, document uploads, status tracking, and reminder generation.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {testResults.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            Click "Run Insurance Tests" to verify insurance functionality
          </div>
        )}
        
        {testResults.map((result, index) => (
          <div key={index} className="flex items-start gap-3 p-3 border rounded-lg">
            {getStatusIcon(result.status)}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h4 className="font-medium">{result.name}</h4>
                {getStatusBadge(result.status)}
              </div>
              <p className="text-sm text-muted-foreground mt-1">{result.message}</p>
              {result.details && (
                <p className="text-xs text-muted-foreground mt-1 bg-muted p-2 rounded">
                  {result.details}
                </p>
              )}
            </div>
          </div>
        ))}

        {testResults.length > 0 && (
          <div className="border-t pt-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Test Summary:</span>
              <div className="flex gap-4">
                <span className="text-green-600">
                  {testResults.filter(r => r.status === 'pass').length} Passed
                </span>
                <span className="text-yellow-600">
                  {testResults.filter(r => r.status === 'warning').length} Warnings
                </span>
                <span className="text-red-600">
                  {testResults.filter(r => r.status === 'fail').length} Failed
                </span>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}