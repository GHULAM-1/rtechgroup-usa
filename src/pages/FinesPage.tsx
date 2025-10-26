import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, AlertCircle, Car, Clock, MoreHorizontal } from "lucide-react";
import { format } from "date-fns";
import { AddFineDialog } from "@/components/AddFineDialog";
import { FineStatusBadge } from "@/components/FineStatusBadge";
import { FineAppealDialog } from "@/components/FineAppealDialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Fine {
  id: string;
  type: string;
  vehicle_id: string;
  customer_id: string | null;
  reference_no: string | null;
  issue_date: string;
  due_date: string;
  amount: number;
  liability: string;
  status: string;
  notes: string | null;
  created_at: string;
  vehicles: {
    reg: string;
    make: string;
    model: string;
  };
  customers: {
    name: string;
  } | null;
}

export default function FinesPage() {
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showAppealDialog, setShowAppealDialog] = useState(false);
  const [selectedFineId, setSelectedFineId] = useState<string | null>(null);

  const { data: fines, isLoading } = useQuery({
    queryKey: ["fines"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fines")
        .select(`
          *,
          vehicles(reg, make, model),
          customers(name)
        `)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data as Fine[];
    },
  });

  // Calculate counts
  const pcnFines = fines?.filter(fine => fine.type === 'PCN') || [];
  const speedingFines = fines?.filter(fine => fine.type === 'Speeding') || [];
  const openFines = fines?.filter(fine => !['Paid', 'Appeal Successful', 'Waived'].includes(fine.status)) || [];
  const overdueFines = fines?.filter(fine => {
    const due = new Date(fine.due_date);
    const today = new Date();
    return due < today && !['Paid', 'Appeal Successful', 'Waived'].includes(fine.status);
  }) || [];

  const getRemainingAmount = (fine: Fine): number => {
    // For simplicity, we'll assume the full amount is remaining unless status is Paid
    // In a real implementation, this would check the ledger_entries for remaining amounts
    if (fine.status === 'Paid' || fine.status === 'Appeal Successful' || fine.status === 'Waived') {
      return 0;
    }
    return fine.amount;
  };

  const FineRow = ({ fine }: { fine: Fine }) => (
    <TableRow key={fine.id} className="hover:bg-muted/50">
      <TableCell>
        <div className="flex items-center space-x-2">
          <Badge variant="outline">{fine.type}</Badge>
          {fine.reference_no && (
            <span className="text-sm text-muted-foreground">{fine.reference_no}</span>
          )}
        </div>
      </TableCell>
      <TableCell>
        <div className="flex items-center space-x-2">
          <Car className="h-4 w-4 text-muted-foreground" />
          <div>
            <div className="font-medium">{fine.vehicles.reg}</div>
            <div className="text-sm text-muted-foreground">
              {fine.vehicles.make} {fine.vehicles.model}
            </div>
          </div>
        </div>
      </TableCell>
      <TableCell>
        {fine.customers ? (
          <div className="font-medium">{fine.customers.name}</div>
        ) : (
          <Badge variant="outline">Unassigned</Badge>
        )}
      </TableCell>
      <TableCell>
        <div className="space-y-1">
          <div className="text-sm">
            <strong>Issue:</strong> {format(new Date(fine.issue_date), "MM/dd/yyyy")}
          </div>
          <div className="text-sm">
            <strong>Due:</strong> {format(new Date(fine.due_date), "MM/dd/yyyy")}
          </div>
        </div>
      </TableCell>
      <TableCell className="text-right">
        <div className="space-y-1">
          <div className="font-medium">${fine.amount.toFixed(2)}</div>
          {getRemainingAmount(fine) > 0 && (
            <div className="text-sm text-muted-foreground">
              ${getRemainingAmount(fine).toFixed(2)} remaining
            </div>
          )}
        </div>
      </TableCell>
      <TableCell>
        <div className="space-y-2">
          <FineStatusBadge 
            status={fine.status} 
            dueDate={fine.due_date} 
            remainingAmount={getRemainingAmount(fine)} 
          />
          {fine.liability === 'Business' && (
            <Badge variant="secondary">Business Liability</Badge>
          )}
        </div>
      </TableCell>
      <TableCell>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => {
              setSelectedFineId(fine.id);
              setShowAppealDialog(true);
            }}>
              Update Status
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  );

  if (isLoading) {
    return <div>Loading fines...</div>;
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Fines Management</h1>
          <p className="text-muted-foreground">Manage parking tickets, speeding fines, and penalties</p>
        </div>
        <Button onClick={() => setShowAddDialog(true)} className="bg-gradient-primary hover:opacity-90">
          <Plus className="h-4 w-4 mr-2" />
          Upload Fine
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Open Fines</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{openFines.length}</div>
            <p className="text-xs text-muted-foreground">
              ${openFines.reduce((sum, fine) => sum + getRemainingAmount(fine), 0).toFixed(2)} outstanding
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Overdue Fines</CardTitle>
            <Clock className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{overdueFines.length}</div>
            <p className="text-xs text-muted-foreground">
              ${overdueFines.reduce((sum, fine) => sum + getRemainingAmount(fine), 0).toFixed(2)} overdue
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">PCN Fines</CardTitle>
            <Car className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pcnFines.length}</div>
            <p className="text-xs text-muted-foreground">Parking tickets</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Speeding Fines</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{speedingFines.length}</div>
            <p className="text-xs text-muted-foreground">Speed violations</p>
          </CardContent>
        </Card>
      </div>

      {/* Fines Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Fines</CardTitle>
          <CardDescription>View and manage all parking and speeding fines</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="all" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="all">All ({fines?.length || 0})</TabsTrigger>
              <TabsTrigger value="pcn">PCN ({pcnFines.length})</TabsTrigger>
              <TabsTrigger value="speeding">Speeding ({speedingFines.length})</TabsTrigger>
              <TabsTrigger value="overdue">Overdue ({overdueFines.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="all" className="mt-4">
              {fines && fines.length > 0 ? (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Type & Reference</TableHead>
                        <TableHead>Vehicle</TableHead>
                        <TableHead>Customer</TableHead>
                        <TableHead>Dates</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {fines.map(fine => <FineRow key={fine.id} fine={fine} />)}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-8">
                  <AlertCircle className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium mb-2">No fines found</h3>
                  <p className="text-muted-foreground mb-4">Start by uploading your first fine</p>
                  <Button onClick={() => setShowAddDialog(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Upload Fine
                  </Button>
                </div>
              )}
            </TabsContent>

            <TabsContent value="pcn" className="mt-4">
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Type & Reference</TableHead>
                      <TableHead>Vehicle</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Dates</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pcnFines.map(fine => <FineRow key={fine.id} fine={fine} />)}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            <TabsContent value="speeding" className="mt-4">
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Type & Reference</TableHead>
                      <TableHead>Vehicle</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Dates</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {speedingFines.map(fine => <FineRow key={fine.id} fine={fine} />)}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            <TabsContent value="overdue" className="mt-4">
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Type & Reference</TableHead>
                      <TableHead>Vehicle</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Dates</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {overdueFines.map(fine => <FineRow key={fine.id} fine={fine} />)}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <AddFineDialog open={showAddDialog} onOpenChange={setShowAddDialog} />
      <FineAppealDialog 
        open={showAppealDialog} 
        onOpenChange={setShowAppealDialog}
        fineId={selectedFineId || ""}
        fineAmount={0}
        customerId={undefined}
      />
    </div>
  );
}