import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatInTimeZone } from "date-fns-tz";

interface RentalLedgerProps {
  rentalId: string;
}

interface LedgerEntry {
  id: string;
  entry_date: string;
  type: 'Charge' | 'Payment';
  category: string;
  amount: number;
  due_date?: string;
  reference?: string;
}

const EntryTypeBadge = ({ type, category }: { type: string; category: string }) => {
  if (type === 'Payment') {
    return <Badge variant="default" className="bg-green-600 hover:bg-green-700">Payment</Badge>;
  }
  
  const getVariant = () => {
    switch (category) {
      case 'Initial Fees':
        return 'secondary';
      case 'Rental':
        return 'default';
      case 'Fines':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  return (
    <Badge variant={getVariant() as any}>
      {category === 'Initial Fees' ? 'Initial Fee' : `${category} Charge`}
    </Badge>
  );
};

export const RentalLedger = ({ rentalId }: RentalLedgerProps) => {
  const { data: entries, isLoading } = useQuery({
    queryKey: ["rental-ledger", rentalId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ledger_entries")
        .select("*")
        .eq("rental_id", rentalId)
        .order("entry_date", { ascending: false })
        .order("type", { ascending: false }); // Payments before charges on same date
      
      if (error) throw error;
      return data as LedgerEntry[];
    },
    enabled: !!rentalId,
  });

  if (isLoading) {
    return <div>Loading ledger...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl font-semibold">Rental Ledger</CardTitle>
        <CardDescription>All charges and payments for this rental</CardDescription>
      </CardHeader>
      <CardContent>
        {entries && entries.length > 0 ? (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((entry) => (
                  <TableRow key={entry.id} className="hover:bg-muted/50">
                    <TableCell className="font-medium">
                      {formatInTimeZone(new Date(entry.entry_date), 'Europe/London', "dd/MM/yyyy")}
                    </TableCell>
                    <TableCell>
                      <EntryTypeBadge type={entry.type} category={entry.category} />
                    </TableCell>
                    <TableCell>
                      {entry.due_date ? formatInTimeZone(new Date(entry.due_date), 'Europe/London', "dd/MM/yyyy") : '-'}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {entry.type === 'Payment' ? (
                        <span className="text-green-600">
                          +£{Math.abs(Number(entry.amount)).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      ) : (
                        <span>
                          £{Math.abs(Number(entry.amount)).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="text-center py-8">
            <h3 className="text-lg font-medium mb-2">No entries found</h3>
            <p className="text-muted-foreground">No charges or payments recorded for this rental</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};