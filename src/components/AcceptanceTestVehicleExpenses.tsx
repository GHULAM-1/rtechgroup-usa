import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export function AcceptanceTestVehicleExpenses() {
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const { toast } = useToast();

  const runTests = async () => {
    setIsRunning(true);
    setResults([]);
    const testResults: any[] = [];

    try {
      // Test 1: Service category expense → Service P&L category
      try {
        const testVehicleId = '82f45f1a-b69a-47db-aa13-413b5835509a';
        
        const { data: expense, error: expenseError } = await supabase
          .from('vehicle_expenses')
          .insert({
            vehicle_id: testVehicleId,
            category: 'Service' as any,
            amount: 300,
            expense_date: '2024-01-15',
            notes: 'Service expense P&L test'
          })
          .select()
          .single();

        if (expenseError) throw expenseError;

        // Check P&L entry with proper reference format
        const { data: pnlEntry, error: pnlError } = await supabase
          .from('pnl_entries')
          .select('*')
          .eq('reference', `vexp:${expense.id}`)
          .single();

        if (pnlError) throw pnlError;

        const serviceTestPassed = 
          pnlEntry.side === 'Cost' && 
          pnlEntry.category === 'Service' && 
          pnlEntry.amount === 300;

        testResults.push({
          name: 'Service Expense → Service P&L Category',
          passed: serviceTestPassed,
          details: serviceTestPassed ? 
            `✓ P&L entry: £${pnlEntry.amount} in ${pnlEntry.category}` :
            `✗ Expected Service category, got: ${JSON.stringify(pnlEntry)}`
        });

        // Cleanup
        await supabase.from('vehicle_expenses').delete().eq('id', expense.id);
        
      } catch (error) {
        testResults.push({
          name: 'Service Expense → Service P&L Category',
          passed: false,
          details: `✗ Error: ${error}`
        });
      }

      // Test 2: Non-Service expense → Expenses P&L category
      try {
        const testVehicleId = '82f45f1a-b69a-47db-aa13-413b5835509a';
        
        const { data: expense, error: expenseError } = await supabase
          .from('vehicle_expenses')
          .insert({
            vehicle_id: testVehicleId,
            category: 'Repair' as any,
            amount: 750,
            expense_date: '2024-01-15',
            notes: 'Repair expense P&L test'
          })
          .select()
          .single();

        if (expenseError) throw expenseError;

        // Check P&L entry
        const { data: pnlEntry, error: pnlError } = await supabase
          .from('pnl_entries')
          .select('*')
          .eq('reference', `vexp:${expense.id}`)
          .single();

        if (pnlError) throw pnlError;

        const repairTestPassed = 
          pnlEntry.side === 'Cost' && 
          pnlEntry.category === 'Expenses' && 
          pnlEntry.amount === 750;

        testResults.push({
          name: 'Repair Expense → Expenses P&L Category',
          passed: repairTestPassed,
          details: repairTestPassed ? 
            `✓ P&L entry: £${pnlEntry.amount} in ${pnlEntry.category}` :
            `✗ Expected Expenses category, got: ${JSON.stringify(pnlEntry)}`
        });

        // Cleanup
        await supabase.from('vehicle_expenses').delete().eq('id', expense.id);
        
      } catch (error) {
        testResults.push({
          name: 'Repair Expense → Expenses P&L Category',
          passed: false,
          details: `✗ Error: ${error}`
        });
      }

      // Test 3: Multiple expense categories → Correct P&L mapping
      try {
        const testVehicleId = '82f45f1a-b69a-47db-aa13-413b5835509a';
        const expenseCategories = [
          { category: 'Tyres', expected_pnl: 'Expenses' },
          { category: 'Valet', expected_pnl: 'Expenses' },
          { category: 'Accessory', expected_pnl: 'Expenses' },
          { category: 'Other', expected_pnl: 'Expenses' }
        ];

        let allPassed = true;
        const createdExpenses = [];

        for (const expenseTest of expenseCategories) {
          const { data: expense, error: expenseError } = await supabase
            .from('vehicle_expenses')
            .insert({
              vehicle_id: testVehicleId,
              category: expenseTest.category as any,
              amount: 100,
              expense_date: '2024-01-15',
              notes: `${expenseTest.category} P&L mapping test`
            })
            .select()
            .single();

          if (expenseError) {
            allPassed = false;
            break;
          }

          createdExpenses.push(expense.id);

          const { data: pnlEntry, error: pnlError } = await supabase
            .from('pnl_entries')
            .select('*')
            .eq('reference', `vexp:${expense.id}`)
            .single();

          if (pnlError || pnlEntry.category !== expenseTest.expected_pnl) {
            allPassed = false;
            break;
          }
        }

        testResults.push({
          name: 'Multiple Categories → Correct P&L Mapping',
          passed: allPassed,
          details: allPassed ? 
            '✓ All expense categories mapped to correct P&L categories' :
            '✗ Some categories mapped incorrectly'
        });

        // Cleanup
        for (const expenseId of createdExpenses) {
          await supabase.from('vehicle_expenses').delete().eq('id', expenseId);
        }
        
      } catch (error) {
        testResults.push({
          name: 'Multiple Categories → Correct P&L Mapping',
          passed: false,
          details: `✗ Error: ${error}`
        });
      }

      // Test 4: Delete expense removes P&L entry
      try {
        const testVehicleId = '82f45f1a-b69a-47db-aa13-413b5835509a';
        
        // Create expense
        const { data: expense, error: expenseError } = await supabase
          .from('vehicle_expenses')
          .insert({
            vehicle_id: testVehicleId,
            category: 'Service' as any,
            amount: 200,
            expense_date: '2024-01-15',
            notes: 'Delete test expense'
          })
          .select()
          .single();

        if (expenseError) throw expenseError;

        // Verify P&L entry exists
        const { data: pnlBefore } = await supabase
          .from('pnl_entries')
          .select('*')
          .eq('reference', `vexp:${expense.id}`)
          .single();

        // Delete expense
        const { error: deleteError } = await supabase
          .from('vehicle_expenses')
          .delete()
          .eq('id', expense.id);

        if (deleteError) throw deleteError;

        // Verify P&L entry is removed
        const { data: pnlAfter, error: pnlAfterError } = await supabase
          .from('pnl_entries')
          .select('*')
          .eq('reference', `vexp:${expense.id}`)
          .maybeSingle();

        const deleteTestPassed = pnlBefore && !pnlAfter && !pnlAfterError;

        testResults.push({
          name: 'Delete Expense → Remove P&L Entry',
          passed: deleteTestPassed,
          details: deleteTestPassed ? 
            '✓ P&L entry removed when expense deleted' :
            '✗ P&L entry not properly cleaned up'
        });
        
      } catch (error) {
        testResults.push({
          name: 'Delete Expense → Remove P&L Entry',
          passed: false,
          details: `✗ Error: ${error}`
        });
      }

      // Test 5: Reference format consistency
      try {
        const testVehicleId = '82f45f1a-b69a-47db-aa13-413b5835509a';
        
        const { data: expense, error: expenseError } = await supabase
          .from('vehicle_expenses')
          .insert({
            vehicle_id: testVehicleId,
            category: 'Other' as any,
            amount: 50,
            expense_date: '2024-01-15',
            notes: 'Reference format test'
          })
          .select()
          .single();

        if (expenseError) throw expenseError;

        const { data: pnlEntry, error: pnlError } = await supabase
          .from('pnl_entries')
          .select('*')
          .eq('reference', `vexp:${expense.id}`)
          .single();

        if (pnlError) throw pnlError;

        const referenceTestPassed = pnlEntry.reference === `vexp:${expense.id}`;

        testResults.push({
          name: 'Reference Format Consistency',
          passed: referenceTestPassed,
          details: referenceTestPassed ? 
            `✓ Correct reference format: ${pnlEntry.reference}` :
            `✗ Wrong reference format: ${pnlEntry.reference}`
        });

        // Cleanup
        await supabase.from('vehicle_expenses').delete().eq('id', expense.id);
        
      } catch (error) {
        testResults.push({
          name: 'Reference Format Consistency',
          passed: false,
          details: `✗ Error: ${error}`
        });
      }

      setResults(testResults);
      
      const passedCount = testResults.filter(r => r.passed).length;
      toast({
        title: "Vehicle Expenses Tests Complete",
        description: `${passedCount}/${testResults.length} tests passed`,
        variant: passedCount === testResults.length ? "default" : "destructive"
      });
      
    } catch (error) {
      toast({
        title: "Test Error", 
        description: `Failed to run tests: ${error}`,
        variant: "destructive"
      });
    }

    setIsRunning(false);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          Vehicle Expenses & P&L Tests
          <Button onClick={runTests} disabled={isRunning}>
            {isRunning ? "Running..." : "Run Tests"}
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {results.map((result, index) => (
            <div key={index}>
              <div className="flex items-center justify-between">
                <span className="font-medium">{result.name}</span>
                <Badge variant={result.passed ? "default" : "destructive"}>
                  {result.passed ? "PASS" : "FAIL"}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                {result.details}
              </p>
              {index < results.length - 1 && <Separator className="mt-3" />}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}