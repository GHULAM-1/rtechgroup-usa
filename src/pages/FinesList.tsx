import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertTriangle, Plus, Eye, Filter } from "lucide-react";

interface Fine {
  id: string;
  type: string;
  reference_no: string | null;
  issue_date: string;
  due_date: string;
  amount: number;
  liability: string;
  status: string;
  notes: string | null;
  customers: { name: string } | null;
  vehicles: { reg: string; make: string; model: string };
}

const FinesList = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const filter = searchParams.get('filter');

  const { data: fines, isLoading } = useQuery({
    queryKey: ["fines-list", filter],
    queryFn: async () => {
      let query = supabase
        .from("fines")
        .select(`
          *,
          customers(name),
          vehicles(reg, make, model)
        `)
        .order("issue_date", { ascending: false });

      // Apply filters
      if (filter === 'overdue') {
        query = query.lt('due_date', new Date().toISOString().split('T')[0])
                     .in('status', ['Open', 'Partially Paid']);
      } else if (filter === 'due-today') {
        const today = new Date().toISOString().split('T')[0];
        query = query.eq("due_date", today)
                     .in('status', ['Open', 'Partially Paid']);
      } else if (filter === 'upcoming') {
        const today = new Date();
        const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
        query = query
          .gte("due_date", today.toISOString().split('T')[0])
          .lte("due_date", nextWeek.toISOString().split('T')[0])
          .in('status', ['Open', 'Partially Paid']);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Fine[];
    },
  });

  const pcnFines = fines?.filter(fine => fine.type === 'PCN') || [];
  const speedingFines = fines?.filter(fine => fine.type === 'Speeding') || [];
  const otherFines = fines?.filter(fine => fine.type === 'Other') || [];

  const renderFinesTable = (finesData: Fine[]) => (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Reference</TableHead>
            <TableHead>Vehicle</TableHead>
            <TableHead>Customer</TableHead>
            <TableHead>Issue Date</TableHead>
            <TableHead>Due Date</TableHead>
            <TableHead>Liability</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Amount</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {finesData.map((fine) => (
            <TableRow key={fine.id} className="hover:bg-muted/50">
              <TableCell className="font-medium">
                {fine.reference_no || fine.id.slice(0, 8)}
              </TableCell>
              <TableCell>
                {fine.vehicles.reg} ({fine.vehicles.make} {fine.vehicles.model})
              </TableCell>
              <TableCell>{fine.customers?.name || '-'}</TableCell>
              <TableCell>{new Date(fine.issue_date).toLocaleDateString()}</TableCell>
              <TableCell className={`${new Date(fine.due_date) < new Date() && fine.status !== 'Paid' ? 'text-red-600 font-medium' : ''}`}>
                {new Date(fine.due_date).toLocaleDateString()}
              </TableCell>
              <TableCell>
                <Badge variant={fine.liability === 'Customer' ? 'default' : 'secondary'}>
                  {fine.liability}
                </Badge>
              </TableCell>
              <TableCell>
                <Badge 
                  variant={
                    fine.status === 'Paid' ? 'default' :
                    fine.status === 'Open' ? 'destructive' :
                    fine.status === 'Partially Paid' ? 'secondary' :
                    fine.status === 'Waived' ? 'outline' : 'secondary'
                  }
                >
                  {fine.status}
                </Badge>
              </TableCell>
              <TableCell className="text-right font-medium">
                £{Number(fine.amount).toLocaleString()}
              </TableCell>
              <TableCell className="text-right">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate(`/fines/${fine.id}`)}
                >
                  <Eye className="h-4 w-4 mr-1" />
                  View
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );

  if (isLoading) {
    return <div>Loading fines...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Fines Management</h1>
          <p className="text-muted-foreground">
            Track and manage traffic fines and penalties
            {filter && ` - ${filter.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}`}
          </p>
        </div>
        <div className="flex gap-2">
          {filter && (
            <Button variant="outline" onClick={() => navigate("/fines")}>
              <Filter className="h-4 w-4 mr-2" />
              Clear Filter
            </Button>
          )}
          <Button 
            onClick={() => navigate("/fines/new")}
            className="bg-gradient-primary"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Fine
          </Button>
        </div>
      </div>

      {/* Fines Tabs */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-primary" />
            Fines & Penalties
          </CardTitle>
          <CardDescription>
            View and manage fines by category
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="pcn" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="pcn">
                PCN ({pcnFines.length})
              </TabsTrigger>
              <TabsTrigger value="speeding">
                Speeding ({speedingFines.length})
              </TabsTrigger>
              <TabsTrigger value="other">
                Other ({otherFines.length})
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="pcn" className="mt-6">
              {pcnFines.length > 0 ? (
                renderFinesTable(pcnFines)
              ) : (
                <div className="text-center py-8">
                  <AlertTriangle className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium mb-2">No PCN fines</h3>
                  <p className="text-muted-foreground">No penalty charge notices found</p>
                </div>
              )}
            </TabsContent>
            
            <TabsContent value="speeding" className="mt-6">
              {speedingFines.length > 0 ? (
                renderFinesTable(speedingFines)
              ) : (
                <div className="text-center py-8">
                  <AlertTriangle className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium mb-2">No speeding fines</h3>
                  <p className="text-muted-foreground">No speeding violations found</p>
                </div>
              )}
            </TabsContent>
            
            <TabsContent value="other" className="mt-6">
              {otherFines.length > 0 ? (
                renderFinesTable(otherFines)
              ) : (
                <div className="text-center py-8">
                  <AlertTriangle className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium mb-2">No other fines</h3>
                  <p className="text-muted-foreground">No other violations found</p>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default FinesList;