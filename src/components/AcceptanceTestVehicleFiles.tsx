import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { CheckCircle, XCircle, Clock, Play } from 'lucide-react';
import { supabase } from "@/integrations/supabase/client";

type TestStatus = 'pending' | 'running' | 'passed' | 'failed';

interface TestResult {
  name: string;
  status: TestStatus;
  message: string;
  details?: string;
}

export const AcceptanceTestVehicleFiles = () => {
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  const updateTestResult = (name: string, status: TestStatus, message: string, details?: string) => {
    setTestResults(prev => {
      const existing = prev.find(t => t.name === name);
      if (existing) {
        existing.status = status;
        existing.message = message;
        existing.details = details;
        return [...prev];
      }
      return [...prev, { name, status, message, details }];
    });
  };

  const runTests = async () => {
    if (isRunning) return;
    
    setIsRunning(true);
    setTestResults([]);

    try {
      // Test 1: Get test vehicle
      updateTestResult('setup', 'running', 'Setting up test vehicle...');
      
      const { data: vehicles, error: vehicleError } = await supabase
        .from('vehicles')
        .select('id, reg')
        .limit(1);

      if (vehicleError || !vehicles || vehicles.length === 0) {
        updateTestResult('setup', 'failed', 'No test vehicle found', vehicleError?.message);
        return;
      }

      const testVehicle = vehicles[0];
      updateTestResult('setup', 'passed', `Using test vehicle: ${testVehicle.reg}`);

      // Test 2: Create test file blob
      updateTestResult('file-creation', 'running', 'Creating test file...');
      
      const testFileContent = 'This is a test file for vehicle files acceptance test';
      const testFile = new File([testFileContent], 'test-document.txt', { type: 'text/plain' });
      
      updateTestResult('file-creation', 'passed', `Created test file: ${testFile.name} (${testFile.size} bytes)`);

      // Test 3: Upload file to storage
      updateTestResult('storage-upload', 'running', 'Uploading file to storage...');
      
      const fileName = `${crypto.randomUUID()}.txt`;
      const filePath = `vehicle/${testVehicle.id}/${fileName}`;
      
      const { error: uploadError } = await supabase.storage
        .from('vehicle-files')
        .upload(filePath, testFile);

      if (uploadError) {
        updateTestResult('storage-upload', 'failed', 'Failed to upload to storage', uploadError.message);
        return;
      }
      
      updateTestResult('storage-upload', 'passed', 'File uploaded to storage successfully');

      // Test 4: Create database record
      updateTestResult('db-insert', 'running', 'Creating database record...');
      
      const { data: fileRecord, error: dbError } = await supabase
        .from('vehicle_files')
        .insert({
          vehicle_id: testVehicle.id,
          file_name: testFile.name,
          storage_path: filePath,
          content_type: testFile.type,
          size_bytes: testFile.size,
        })
        .select()
        .single();

      if (dbError || !fileRecord) {
        updateTestResult('db-insert', 'failed', 'Failed to create database record', dbError?.message);
        // Clean up storage
        await supabase.storage.from('vehicle-files').remove([filePath]);
        return;
      }
      
      updateTestResult('db-insert', 'passed', `Database record created with ID: ${fileRecord.id}`);

      // Test 5: Download via signed URL
      updateTestResult('signed-url-download', 'running', 'Testing signed URL download...');
      
      const { data: signedUrlData, error: signedUrlError } = await supabase.storage
        .from('vehicle-files')
        .createSignedUrl(filePath, 3600);

      if (signedUrlError || !signedUrlData?.signedUrl) {
        updateTestResult('signed-url-download', 'failed', 'Failed to create signed URL', signedUrlError?.message);
      } else {
        // Test that the URL is accessible
        try {
          const response = await fetch(signedUrlData.signedUrl);
          if (response.ok) {
            const downloadedContent = await response.text();
            if (downloadedContent === testFileContent) {
              updateTestResult('signed-url-download', 'passed', 'Signed URL download successful');
            } else {
              updateTestResult('signed-url-download', 'failed', 'Downloaded content mismatch');
            }
          } else {
            updateTestResult('signed-url-download', 'failed', `HTTP ${response.status}: ${response.statusText}`);
          }
        } catch (fetchError: any) {
          updateTestResult('signed-url-download', 'failed', 'Failed to fetch signed URL', fetchError.message);
        }
      }

      // Test 6: File list query
      updateTestResult('file-query', 'running', 'Testing file list query...');
      
      const { data: filesList, error: queryError } = await supabase
        .from('vehicle_files')
        .select('*')
        .eq('vehicle_id', testVehicle.id)
        .eq('id', fileRecord.id);

      if (queryError || !filesList || filesList.length === 0) {
        updateTestResult('file-query', 'failed', 'Failed to query file list', queryError?.message);
      } else {
        updateTestResult('file-query', 'passed', `Found ${filesList.length} file(s) for vehicle`);
      }

      // Test 7: Cleanup - Delete file
      updateTestResult('cleanup', 'running', 'Cleaning up test files...');
      
      // Delete from database
      const { error: deleteDbError } = await supabase
        .from('vehicle_files')
        .delete()
        .eq('id', fileRecord.id);

      if (deleteDbError) {
        updateTestResult('cleanup', 'failed', 'Failed to delete database record', deleteDbError.message);
        return;
      }

      // Delete from storage
      const { error: deleteStorageError } = await supabase.storage
        .from('vehicle-files')
        .remove([filePath]);

      if (deleteStorageError) {
        updateTestResult('cleanup', 'failed', 'Failed to delete storage file', deleteStorageError.message);
        return;
      }
      
      updateTestResult('cleanup', 'passed', 'Test files cleaned up successfully');

      // Test 8: Verify cleanup
      updateTestResult('verify-cleanup', 'running', 'Verifying cleanup...');
      
      const { data: remainingFiles } = await supabase
        .from('vehicle_files')
        .select('id')
        .eq('id', fileRecord.id);

      if (remainingFiles && remainingFiles.length > 0) {
        updateTestResult('verify-cleanup', 'failed', 'Database record still exists');
      } else {
        updateTestResult('verify-cleanup', 'passed', 'Cleanup verified - no database records remain');
      }

    } catch (error: any) {
      updateTestResult('error', 'failed', 'Unexpected error during testing', error.message);
    } finally {
      setIsRunning(false);
    }
  };

  const getStatusIcon = (status: TestStatus) => {
    switch (status) {
      case 'passed':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-600" />;
      case 'running':
        return <Clock className="h-4 w-4 text-blue-600 animate-spin" />;
      default:
        return <Clock className="h-4 w-4 text-gray-400" />;
    }
  };

  const getStatusBadge = (status: TestStatus) => {
    switch (status) {
      case 'passed':
        return <Badge variant="secondary" className="bg-green-100 text-green-800">Passed</Badge>;
      case 'failed':
        return <Badge variant="destructive">Failed</Badge>;
      case 'running':
        return <Badge variant="secondary" className="bg-blue-100 text-blue-800">Running</Badge>;
      default:
        return <Badge variant="outline">Pending</Badge>;
    }
  };

  const passedCount = testResults.filter(t => t.status === 'passed').length;
  const failedCount = testResults.filter(t => t.status === 'failed').length;
  const totalTests = testResults.length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Vehicle Files Tests</span>
          <Button 
            onClick={runTests} 
            disabled={isRunning}
            size="sm"
          >
            {isRunning ? (
              <>
                <Clock className="h-4 w-4 mr-2 animate-spin" />
                Running...
              </>
            ) : (
              <>
                <Play className="h-4 w-4 mr-2" />
                Run Tests
              </>
            )}
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {testResults.length > 0 && (
          <>
            <div className="flex gap-4 mb-4">
              <div className="text-sm">
                <span className="text-green-600 font-medium">{passedCount} passed</span>
                {failedCount > 0 && (
                  <>
                    <span className="mx-2">•</span>
                    <span className="text-red-600 font-medium">{failedCount} failed</span>
                  </>
                )}
                <span className="mx-2">•</span>
                <span className="text-muted-foreground">{totalTests} total</span>
              </div>
            </div>
            <Separator className="mb-4" />
          </>
        )}

        <div className="space-y-3">
          {testResults.map((result, index) => (
            <div key={index} className="flex items-start gap-3 p-3 rounded-lg border">
              {getStatusIcon(result.status)}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <p className="font-medium text-sm capitalize">
                    {result.name.replace('-', ' ')}
                  </p>
                  {getStatusBadge(result.status)}
                </div>
                <p className="text-sm text-muted-foreground">{result.message}</p>
                {result.details && (
                  <p className="text-xs text-red-600 mt-1 font-mono bg-red-50 p-2 rounded">
                    {result.details}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>

        {testResults.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <p>Click "Run Tests" to start the vehicle files acceptance tests.</p>
            <p className="text-sm mt-2">
              Tests: File upload → Storage + DB → Signed URL download → Cleanup
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};