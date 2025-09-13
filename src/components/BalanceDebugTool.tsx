import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface BalanceDebugToolProps {
  customerId: string;
  customerName: string;
}

export const BalanceDebugTool: React.FC<BalanceDebugToolProps> = ({ customerId, customerName }) => {
  const { data: ledgerEntries } = useQuery({
    queryKey: ['balance-debug', customerId],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      
      const { data, error } = await supabase
        .from('ledger_entries')
        .select('*')
        .eq('customer_id', customerId)
        .order('due_date', { ascending: true });
      
      if (error) throw error;
      return data;
    },
  });

  if (!ledgerEntries) return null;

  const today = new Date().toISOString().split('T')[0];
  
  // Calculate different balance types
  const rentalChargesDue = ledgerEntries
    .filter(e => e.type === 'Charge' && e.category === 'Rental' && e.due_date <= today && e.remaining_amount > 0)
    .reduce((sum, e) => sum + Number(e.remaining_amount), 0);
    
  const totalRentalCharges = ledgerEntries
    .filter(e => e.type === 'Charge' && e.category === 'Rental')
    .reduce((sum, e) => sum + Number(e.amount), 0);
    
  const initialFeePayments = ledgerEntries
    .filter(e => e.type === 'Payment' && e.category === 'Initial Fees')
    .reduce((sum, e) => sum + Math.abs(Number(e.amount)), 0);

  return (
    <Card className="mt-4 border-yellow-200 bg-yellow-50">
      <CardHeader>
        <CardTitle className="text-sm">Balance Debug: {customerName}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Badge variant="outline">Rental Charges Due</Badge>
            <div className="font-mono">£{rentalChargesDue.toFixed(2)}</div>
          </div>
          <div>
            <Badge variant="outline">Total Rental Charges</Badge>
            <div className="font-mono">£{totalRentalCharges.toFixed(2)}</div>
          </div>
          <div>
            <Badge variant="outline">Initial Fee Payments</Badge>
            <div className="font-mono">£{initialFeePayments.toFixed(2)}</div>
          </div>
        </div>
        
        <div className="mt-4">
          <Badge variant="secondary">Ledger Entries</Badge>
          <div className="text-xs space-y-1 mt-1 max-h-32 overflow-y-auto">
            {ledgerEntries.map((entry) => (
              <div key={entry.id} className="flex justify-between font-mono">
                <span className={entry.due_date <= today ? 'font-bold' : 'opacity-60'}>
                  {entry.type} ({entry.category}) - {entry.due_date}
                </span>
                <span>
                  £{Number(entry.amount).toFixed(2)} 
                  {entry.remaining_amount > 0 && ` (£${Number(entry.remaining_amount).toFixed(2)} remaining)`}
                </span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};