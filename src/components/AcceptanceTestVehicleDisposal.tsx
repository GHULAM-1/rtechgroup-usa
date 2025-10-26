import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export function AcceptanceTestVehicleDisposal() {
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const { toast } = useToast();

  const runTests = async () => {
    setIsRunning(true);
    setResults([]);
    const testResults: any[] = [];

    try {
      // Test 1: Create expense and verify P&L entry
      try {
        const testVehicleId = '82f45f1a-b69a-47db-aa13-413b5835509a'; // Use current vehicle
        
        // Add expense
        const { data: expense, error: expenseError } = await supabase
          .from('vehicle_expenses')
          .insert({
            vehicle_id: testVehicleId,
            category: 'Repair',
            amount: 500,
            expense_date: '2024-01-15',
            notes: 'Test expense for P&L verification'
          })
          .select()
          .single();

        if (expenseError) throw expenseError;

        // Check if P&L entry was created
        const { data: pnlEntry, error: pnlError } = await supabase
          .from('pnl_entries')
          .select('*')
          .eq('reference', expense.id.toString())
          .single();

        if (pnlError) throw pnlError;

        const expenseTestPassed = 
          pnlEntry.side === 'Cost' && 
          pnlEntry.category === 'Expenses' && 
          pnlEntry.amount === 500;

        testResults.push({
          name: 'Expense → P&L Cost Entry',
          passed: expenseTestPassed,
          details: expenseTestPassed ? 
            `✓ P&L cost entry created: $${pnlEntry.amount} in ${pnlEntry.category}` :
            `✗ P&L entry incorrect: ${JSON.stringify(pnlEntry)}`
        });

        // Cleanup
        await supabase.from('vehicle_expenses').delete().eq('id', expense.id);
        
      } catch (error) {
        testResults.push({
          name: 'Expense → P&L Cost Entry',
          passed: false,
          details: `✗ Error: ${error}`
        });
      }

      // Test 2: Disposal with gain (sale higher than book cost)
      try {
        // Create test vehicle
        const { data: testVehicle, error: vehicleError } = await supabase
          .from('vehicles')
          .insert({
            reg: 'TEST001',
            make: 'Test',
            model: 'Vehicle',
            acquisition_type: 'Purchase',
            purchase_price: 10000,
            status: 'Available'
          })
          .select()
          .single();

        if (vehicleError) throw vehicleError;

        // Dispose with gain
        const { data: disposalResult, error: disposalError } = await supabase
          .rpc('dispose_vehicle', {
            p_vehicle_id: testVehicle.id,
            p_disposal_date: '2024-01-20',
            p_sale_proceeds: 12000,
            p_buyer: 'Test Buyer'
          });

        if (disposalError) throw disposalError;

        // Check P&L entry for gain
        const { data: gainPnl, error: gainPnlError } = await supabase
          .from('pnl_entries')
          .select('*')
          .eq('reference', `dispose:${testVehicle.id}`)
          .single();

        if (gainPnlError) throw gainPnlError;

        const gainTestPassed = 
          gainPnl.side === 'Revenue' && 
          gainPnl.category === 'Disposal' && 
          gainPnl.amount === 2000;

        testResults.push({
          name: 'Disposal Gain → P&L Revenue',
          passed: gainTestPassed,
          details: gainTestPassed ? 
            `✓ P&L revenue entry: $${gainPnl.amount} gain posted` :
            `✗ P&L entry incorrect: ${JSON.stringify(gainPnl)}`
        });

        // Cleanup
        await supabase.from('vehicles').delete().eq('id', testVehicle.id);
        
      } catch (error) {
        testResults.push({
          name: 'Disposal Gain → P&L Revenue',
          passed: false,
          details: `✗ Error: ${error}`
        });
      }

      // Test 3: Disposal with loss (sale lower than book cost)
      try {
        // Create test vehicle
        const { data: testVehicle, error: vehicleError } = await supabase
          .from('vehicles')
          .insert({
            reg: 'TEST002',
            make: 'Test',
            model: 'Vehicle',
            acquisition_type: 'Purchase',
            purchase_price: 15000,
            status: 'Available'
          })
          .select()
          .single();

        if (vehicleError) throw vehicleError;

        // Dispose with loss
        const { data: disposalResult, error: disposalError } = await supabase
          .rpc('dispose_vehicle', {
            p_vehicle_id: testVehicle.id,
            p_disposal_date: '2024-01-20',
            p_sale_proceeds: 12000,
            p_buyer: 'Test Buyer'
          });

        if (disposalError) throw disposalError;

        // Check P&L entry for loss
        const { data: lossPnl, error: lossPnlError } = await supabase
          .from('pnl_entries')
          .select('*')
          .eq('reference', `dispose:${testVehicle.id}`)
          .single();

        if (lossPnlError) throw lossPnlError;

        const lossTestPassed = 
          lossPnl.side === 'Cost' && 
          lossPnl.category === 'Disposal' && 
          lossPnl.amount === 3000;

        testResults.push({
          name: 'Disposal Loss → P&L Cost',
          passed: lossTestPassed,
          details: lossTestPassed ? 
            `✓ P&L cost entry: $${lossPnl.amount} loss posted` :
            `✗ P&L entry incorrect: ${JSON.stringify(lossPnl)}`
        });

        // Cleanup
        await supabase.from('vehicles').delete().eq('id', testVehicle.id);
        
      } catch (error) {
        testResults.push({
          name: 'Disposal Loss → P&L Cost',
          passed: false,
          details: `✗ Error: ${error}`
        });
      }

      // Test 4: Idempotency test
      try {
        const { data: testVehicle, error: vehicleError } = await supabase
          .from('vehicles')
          .insert({
            reg: 'TEST003',
            make: 'Test',
            model: 'Vehicle',
            acquisition_type: 'Purchase',
            purchase_price: 10000,
            status: 'Available'
          })
          .select()
          .single();

        if (vehicleError) throw vehicleError;

        // Dispose twice with same data
        await supabase.rpc('dispose_vehicle', {
          p_vehicle_id: testVehicle.id,
          p_disposal_date: '2024-01-20',
          p_sale_proceeds: 12000
        });

        await supabase.rpc('dispose_vehicle', {
          p_vehicle_id: testVehicle.id,
          p_disposal_date: '2024-01-20',
          p_sale_proceeds: 12000
        });

        // Check only one P&L entry exists
        const { data: pnlEntries, error: pnlError } = await supabase
          .from('pnl_entries')
          .select('*')
          .eq('reference', `dispose:${testVehicle.id}`);

        if (pnlError) throw pnlError;

        const idempotencyTestPassed = pnlEntries.length === 1;

        testResults.push({
          name: 'P&L Idempotency',
          passed: idempotencyTestPassed,
          details: idempotencyTestPassed ? 
            '✓ Only one P&L entry created despite multiple disposals' :
            `✗ Multiple P&L entries found: ${pnlEntries.length}`
        });

        // Cleanup
        await supabase.from('vehicles').delete().eq('id', testVehicle.id);
        
      } catch (error) {
        testResults.push({
          name: 'P&L Idempotency',
          passed: false,
          details: `✗ Error: ${error}`
        });
      }

      setResults(testResults);
      
      const passedCount = testResults.filter(r => r.passed).length;
      toast({
        title: "Acceptance Tests Complete",
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
          Vehicle Disposal Acceptance Tests
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