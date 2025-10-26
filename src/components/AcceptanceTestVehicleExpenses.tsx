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
      // Test 1: Service expense maps to Service P&L category
      try {
        const testVehicleId = '82f45f1a-b69a-47db-aa13-413b5835509a';
        
        const { data: expense, error: expenseError } = await supabase
          .from('vehicle_expenses')
          .insert({
            vehicle_id: testVehicleId,
            category: 'Service',
            amount: 300,
            expense_date: '2024-01-15',
            notes: 'Test service expense'
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

        const serviceTestPassed = 
          pnlEntry.side === 'Cost' && 
          pnlEntry.category === 'Service' && 
          pnlEntry.amount === 300;

        testResults.push({
          name: 'Service Expense → Service P&L Category',
          passed: serviceTestPassed,
          details: serviceTestPassed ? 
            `✓ Service expense correctly categorized in P&L: $${pnlEntry.amount}` :
            `✗ P&L entry incorrect: ${JSON.stringify(pnlEntry)}`
        });

        await supabase.from('vehicle_expenses').delete().eq('id', expense.id);
        
      } catch (error) {
        testResults.push({
          name: 'Service Expense → Service P&L Category',
          passed: false,
          details: `✗ Error: ${error}`
        });
      }

      // Test 2: Non-service expense maps to Expenses P&L category
      try {
        const testVehicleId = '82f45f1a-b69a-47db-aa13-413b5835509a';
        
        const { data: expense, error: expenseError } = await supabase
          .from('vehicle_expenses')
          .insert({
            vehicle_id: testVehicleId,
            category: 'Repair',
            amount: 750,
            expense_date: '2024-01-16',
            notes: 'Test repair expense'
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

        const repairTestPassed = 
          pnlEntry.side === 'Cost' && 
          pnlEntry.category === 'Expenses' && 
          pnlEntry.amount === 750;

        testResults.push({
          name: 'Repair Expense → Expenses P&L Category',
          passed: repairTestPassed,
          details: repairTestPassed ? 
            `✓ Repair expense correctly categorized as Expenses: $${pnlEntry.amount}` :
            `✗ P&L entry incorrect: ${JSON.stringify(pnlEntry)}`
        });

        await supabase.from('vehicle_expenses').delete().eq('id', expense.id);
        
      } catch (error) {
        testResults.push({
          name: 'Repair Expense → Expenses P&L Category',
          passed: false,
          details: `✗ Error: ${error}`
        });
      }

      // Test 3: Multiple expense categories map to Expenses
      try {
        const testVehicleId = '82f45f1a-b69a-47db-aa13-413b5835509a';
        const expenseCategories = ['Tyres', 'Valet', 'Accessory'];
        const expenseIds: string[] = [];
        
        // Create expenses of different categories
        for (const category of expenseCategories) {
          const { data: expense, error: expenseError } = await supabase
            .from('vehicle_expenses')
            .insert({
              vehicle_id: testVehicleId,
              category: category as any,
              amount: 100,
              expense_date: '2024-01-17',
              notes: `Test ${category} expense`
            })
            .select()
            .single();

          if (expenseError) throw expenseError;
          expenseIds.push(expense.id);
        }

        // Check P&L entries
        const { data: pnlEntries, error: pnlError } = await supabase
          .from('pnl_entries')
          .select('*')
          .in('reference', expenseIds.map(id => `vexp:${id}`));

        if (pnlError) throw pnlError;

        const allCategorizedCorrectly = pnlEntries.every(entry => 
          entry.side === 'Cost' && 
          entry.category === 'Expenses' && 
          entry.amount === 100
        );

        testResults.push({
          name: 'Multiple Categories → Expenses Mapping',
          passed: allCategorizedCorrectly,
          details: allCategorizedCorrectly ? 
            `✓ All ${expenseCategories.length} expense types correctly map to Expenses category` :
            `✗ Some entries incorrectly categorized: ${JSON.stringify(pnlEntries)}`
        });

        // Cleanup
        for (const id of expenseIds) {
          await supabase.from('vehicle_expenses').delete().eq('id', id);
        }
        
      } catch (error) {
        testResults.push({
          name: 'Multiple Categories → Expenses Mapping',
          passed: false,
          details: `✗ Error: ${error}`
        });
      }

      // Test 4: P&L Reference Format Test
      try {
        const testVehicleId = '82f45f1a-b69a-47db-aa13-413b5835509a';
        
        const { data: expense, error: expenseError } = await supabase
          .from('vehicle_expenses')
          .insert({
            vehicle_id: testVehicleId,
            category: 'Other',
            amount: 200,
            expense_date: '2024-01-18',
            notes: 'Test reference format'
          })
          .select()
          .single();

        if (expenseError) throw expenseError;

        const expectedReference = `vexp:${expense.id}`;
        const { data: pnlEntry, error: pnlError } = await supabase
          .from('pnl_entries')
          .select('*')
          .eq('reference', expectedReference)
          .single();

        if (pnlError) throw pnlError;

        const referenceTestPassed = 
          pnlEntry.reference === expectedReference &&
          pnlEntry.side === 'Cost' && 
          pnlEntry.category === 'Expenses';

        testResults.push({
          name: 'P&L Reference Format',
          passed: referenceTestPassed,
          details: referenceTestPassed ? 
            `✓ P&L reference format correct: ${pnlEntry.reference}` :
            `✗ Reference format incorrect: expected ${expectedReference}, got ${pnlEntry.reference}`
        });

        await supabase.from('vehicle_expenses').delete().eq('id', expense.id);
        
      } catch (error) {
        testResults.push({
          name: 'P&L Reference Format',
          passed: false,
          details: `✗ Error: ${error}`
        });
      }

      // Test 5: Vehicle Event Creation Test
      try {
        const testVehicleId = '82f45f1a-b69a-47db-aa13-413b5835509a';
        
        const { data: expense, error: expenseError } = await supabase
          .from('vehicle_expenses')
          .insert({
            vehicle_id: testVehicleId,
            category: 'Tyres',
            amount: 400,
            expense_date: '2024-01-19',
            notes: 'Test event creation'
          })
          .select()
          .single();

        if (expenseError) throw expenseError;

        // Check vehicle event was created
        const { data: vehicleEvent, error: eventError } = await supabase
          .from('vehicle_events')
          .select('*')
          .eq('reference_id', expense.id)
          .eq('event_type', 'expense_added')
          .single();

        if (eventError) throw eventError;

        const eventTestPassed = 
          vehicleEvent.vehicle_id === testVehicleId &&
          vehicleEvent.summary.includes('Tyres') &&
          vehicleEvent.summary.includes('$400');

        testResults.push({
          name: 'Vehicle Event Creation',
          passed: eventTestPassed,
          details: eventTestPassed ? 
            `✓ Vehicle event created: ${vehicleEvent.summary}` :
            `✗ Event not created or incorrect: ${JSON.stringify(vehicleEvent)}`
        });

        await supabase.from('vehicle_expenses').delete().eq('id', expense.id);
        
      } catch (error) {
        testResults.push({
          name: 'Vehicle Event Creation',
          passed: false,
          details: `✗ Error: ${error}`
        });
      }

      setResults(testResults);
      
      const passedCount = testResults.filter(r => r.passed).length;
      toast({
        title: "Expense Tests Complete",
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