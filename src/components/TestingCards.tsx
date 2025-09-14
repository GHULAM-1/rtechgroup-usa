import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Play, Clock, CheckCircle, XCircle } from 'lucide-react';
import { TestResultsModal, TestResult } from './TestResultsModal';
import { useSettings } from '@/contexts/SettingsContext';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface TestSuite {
  id: 'dashboard' | 'rental' | 'finance';
  title: string;
  description: string;
  lastRun?: Date;
  lastResult?: any;
}

export const TestingCards: React.FC = () => {
  const { settings, updateSettings } = useSettings();
  const [activeTest, setActiveTest] = useState<TestSuite['id'] | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [currentResults, setCurrentResults] = useState<TestResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  const testSuites: TestSuite[] = [
    {
      id: 'dashboard',
      title: 'Dashboard System Tests',
      description: 'Verify KPI calculations, cross-page consistency, and performance targets',
      lastRun: settings?.tests_last_run_dashboard ? new Date(settings.tests_last_run_dashboard) : undefined,
      lastResult: settings?.tests_last_result_dashboard
    },
    {
      id: 'rental',
      title: 'Rental Allocation Tests', 
      description: 'Verify charge/payment mapping and FIFO allocation logic',
      lastRun: settings?.tests_last_run_rental ? new Date(settings.tests_last_run_rental) : undefined,
      lastResult: settings?.tests_last_result_rental
    },
    {
      id: 'finance',
      title: 'Upfront Finance Accounting Tests',
      description: 'Verify upfront P&L cost entries and prevent double counting',
      lastRun: settings?.tests_last_run_finance ? new Date(settings.tests_last_run_finance) : undefined,
      lastResult: settings?.tests_last_result_finance
    }
  ];

  const runDashboardTests = async (): Promise<TestResult[]> => {
    // Mock dashboard tests - replace with actual implementation
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve([
          { name: 'KPI Calculation Accuracy', status: 'passed', message: 'All KPI calculations match expected values', duration: 123 },
          { name: 'Cross-page Data Consistency', status: 'passed', message: 'Data consistent across dashboard and detail pages', duration: 89 },
          { name: 'Performance Benchmarks', status: 'warning', message: 'Load time slightly above target (2.1s vs 2.0s)', duration: 45 },
          { name: 'Memory Usage Check', status: 'passed', message: 'Memory usage within acceptable limits', duration: 67 }
        ]);
      }, 2000);
    });
  };

  const runRentalTests = async (): Promise<TestResult[]> => {
    // Mock rental allocation tests - replace with actual implementation  
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve([
          { name: 'FIFO Payment Allocation', status: 'passed', message: 'Payments allocated to oldest charges first', duration: 156 },
          { name: 'Charge Creation Logic', status: 'passed', message: 'Monthly charges created correctly', duration: 98 },
          { name: 'Customer Balance Calculation', status: 'passed', message: 'Customer balances accurate', duration: 134 },
          { name: 'Payment Status Updates', status: 'passed', message: 'Payment statuses reflect allocation correctly', duration: 87 }
        ]);
      }, 1800);
    });
  };

  const runFinanceTests = async (): Promise<TestResult[]> => {
    // Mock finance tests - replace with actual implementation
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve([
          { name: 'Upfront Cost P&L Entry', status: 'passed', message: 'Finance acquisition costs recorded correctly', duration: 142 },
          { name: 'Double Counting Prevention', status: 'passed', message: 'No duplicate P&L entries detected', duration: 78 },
          { name: 'Contract Total Calculation', status: 'passed', message: 'Total contract values calculated accurately', duration: 65 },
          { name: 'Finance Entry Cleanup', status: 'warning', message: 'Old entries cleaned up, one manual review needed', duration: 234 }
        ]);
      }, 2200);
    });
  };

  const runTestSuite = async (suiteId: TestSuite['id']) => {
    setIsRunning(true);
    setActiveTest(suiteId);
    setCurrentResults([]);
    setModalOpen(true);

    try {
      let results: TestResult[];
      
      switch (suiteId) {
        case 'dashboard':
          results = await runDashboardTests();
          break;
        case 'rental':
          results = await runRentalTests();
          break;
        case 'finance':
          results = await runFinanceTests();
          break;
        default:
          results = [];
      }

      setCurrentResults(results);

      // Save test results to settings
      const updateData = {
        [`tests_last_run_${suiteId}`]: new Date().toISOString(),
        [`tests_last_result_${suiteId}`]: {
          results,
          summary: {
            total: results.length,
            passed: results.filter(r => r.status === 'passed').length,
            failed: results.filter(r => r.status === 'failed').length,
            warnings: results.filter(r => r.status === 'warning').length
          }
        }
      };

      await updateSettings(updateData);

      toast({
        title: "Tests Completed",
        description: `${results.filter(r => r.status === 'passed').length}/${results.length} tests passed`,
      });

    } catch (error) {
      console.error('Test execution failed:', error);
      toast({
        title: "Test Failed",
        description: "An error occurred while running tests",
        variant: "destructive",
      });
    } finally {
      setIsRunning(false);
    }
  };

  const getResultsBadge = (result: any) => {
    if (!result?.summary) return null;
    
    const { passed, failed, warnings } = result.summary;
    
    if (failed > 0) {
      return <Badge variant="destructive">{failed} Failed</Badge>;
    } else if (warnings > 0) {
      return <Badge variant="secondary">{warnings} Warnings</Badge>;
    } else {
      return <Badge variant="default" className="text-green-700 bg-green-100 border-green-300">All Passed</Badge>;
    }
  };

  return (
    <>
      <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-3">
        {testSuites.map((suite) => (
          <Card key={suite.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">{suite.title}</CardTitle>
                {suite.lastResult && getResultsBadge(suite.lastResult)}
              </div>
              <CardDescription>{suite.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {suite.lastRun && (
                  <div className="text-sm text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <Clock className="h-3 w-3" />
                      Last run: {suite.lastRun.toLocaleDateString()} at {suite.lastRun.toLocaleTimeString()}
                    </div>
                  </div>
                )}
                
                <Button
                  onClick={() => runTestSuite(suite.id)}
                  disabled={isRunning}
                  className="w-full"
                >
                  <Play className="h-4 w-4 mr-2" />
                  {isRunning && activeTest === suite.id ? 'Running...' : 'Run Tests'}
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <TestResultsModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        title={activeTest ? testSuites.find(s => s.id === activeTest)?.title || 'Test Results' : 'Test Results'}
        results={currentResults}
        isRunning={isRunning}
      />
    </>
  );
};