import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CreditCard, Filter, Calendar, AlertTriangle } from "lucide-react";

interface Charge {
  id: string;
  entry_date: string;
  type: string;
  category: string;
  amount: number;
  remaining_amount: number;
  due_date: string | null;
  customer_id: string;
  rental_id: string | null;
  vehicle_id: string | null;
  customers: { name: string } | null;
  vehicles: { reg: string; make: string; model: string } | null;
  rentals: { id: string } | null;
}

const ChargesList = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const filter = searchParams.get('filter');

  const { data: charges, isLoading } = useQuery({
    queryKey: ["charges-list", filter],
    queryFn: async () => {
      let query = supabase
        .from("ledger_entries")
        .select(`
          *,
          customers(name),
          vehicles(reg, make, model),
          rentals(id)
        `)
        .eq("type", "Charge")
        .gt("remaining_amount", 0)
        .order("due_date", { ascending: true });

      const today = new Date().toISOString().split('T')[0];

      // Apply filters based on dashboard navigation
      if (filter === 'overdue') {
        query = query.lt("due_date", today);
      } else if (filter === 'due-today') {
        query = query.eq("due_date", today);
      } else if (filter === 'upcoming') {
        const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        query = query
          .gte("due_date", tomorrow)
          .lte("due_date", nextWeek);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Charge[];
    },
  });

  const getStatusBadge = (charge: Charge) => {
    if (!charge.due_date) return null;
    
    const today = new Date().toISOString().split('T')[0];
    const dueDate = charge.due_date;
    
    if (dueDate < today) {
      return <Badge variant="destructive">Overdue</Badge>;
    } else if (dueDate === today) {
      return <Badge variant="default">Due Today</Badge>;
    } else {
      return <Badge variant="secondary">Upcoming</Badge>;
    }
  };

  const getFilterTitle = () => {
    switch (filter) {
      case 'overdue': return 'Overdue Charges';
      case 'due-today': return 'Charges Due Today';
      case 'upcoming': return 'Upcoming Charges (7 days)';
      default: return 'Outstanding Charges';
    }
  };

  if (isLoading) {
    return <div>Loading charges...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{getFilterTitle()}</h1>
          <p className="text-muted-foreground">
            Outstanding charges that require payment
            {filter && ` - ${filter.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}`}
          </p>
        </div>
        <div className="flex gap-2">
          {filter && (
            <Button variant="outline" onClick={() => navigate("/charges")}>
              <Filter className="h-4 w-4 mr-2" />
              Clear Filter
            </Button>
          )}
        </div>
      </div>

      {/* Summary Stats */}
      {charges && charges.length > 0 && (
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Total Charges</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{charges.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Total Amount</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                ${charges.reduce((sum, charge) => sum + Number(charge.remaining_amount), 0).toLocaleString()}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Average Amount</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                ${charges.length > 0 ? Math.round(charges.reduce((sum, charge) => sum + Number(charge.remaining_amount), 0) / charges.length) : 0}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Charges Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-primary" />
            Outstanding Charges
          </CardTitle>
          <CardDescription>
            Charges that require customer payment
          </CardDescription>
        </CardHeader>
        <CardContent>
          {charges && charges.length > 0 ? (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Due Date</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Vehicle</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="text-right">Remaining</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {charges.map((charge) => (
                    <TableRow key={charge.id} className="hover:bg-muted/50">
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {charge.due_date ? (
                            <>
                              {charge.due_date < new Date().toISOString().split('T')[0] && (
                                <AlertTriangle className="h-4 w-4 text-red-500" />
                              )}
                              {charge.due_date === new Date().toISOString().split('T')[0] && (
                                <Calendar className="h-4 w-4 text-yellow-500" />
                              )}
                              {new Date(charge.due_date).toLocaleDateString()}
                            </>
                          ) : (
                            'No due date'
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="link"
                          className="p-0 h-auto font-normal"
                          onClick={() => navigate(`/customers/${charge.customer_id}`)}
                        >
                          {charge.customers?.name || 'Unknown'}
                        </Button>
                      </TableCell>
                      <TableCell>
                        {charge.vehicles ? (
                          <Button
                            variant="link"
                            className="p-0 h-auto font-normal"
                            onClick={() => navigate(`/vehicles/${charge.vehicle_id}`)}
                          >
                            {charge.vehicles.reg}
                          </Button>
                        ) : (
                          '-'
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant={
                            charge.category === 'Rental' ? 'default' :
                            charge.category === 'InitialFee' ? 'secondary' :
                            charge.category === 'Fine' ? 'destructive' : 'outline'
                          }
                        >
                          {charge.category === 'InitialFee' ? 'Initial Fee' : charge.category}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(charge)}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        ${Number(charge.amount).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        ${Number(charge.remaining_amount).toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-8">
              <CreditCard className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No charges found</h3>
              <p className="text-muted-foreground mb-4">
                {filter ? "No charges match the current filter" : "No outstanding charges"}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ChargesList;