import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertTriangle, ArrowLeft, FileText, DollarSign, CheckCircle, XCircle, Scale, CreditCard, Clock, Ban } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { FineAppealDialog } from "@/components/FineAppealDialog";
import { FineStatusBadge } from "@/components/FineStatusBadge";

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
  customer_id: string | null;
  vehicle_id: string;
  customers: { name: string } | null;
  vehicles: { reg: string; make: string; model: string };
}

interface FineFile {
  id: string;
  file_name: string;
  file_url: string;
  uploaded_at: string;
}

interface LedgerEntry {
  id: string;
  entry_date: string;
  due_date: string | null;
  amount: number;
  remaining_amount: number;
  type: string;
  category: string;
}

const FineDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showAppealDialog, setShowAppealDialog] = useState(false);

  const { data: fine, isLoading } = useQuery({
    queryKey: ["fine", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fines")
        .select(`
          *,
          customers(name),
          vehicles(reg, make, model)
        `)
        .eq("id", id)
        .single();
      
      if (error) throw error;
      return data as Fine;
    },
    enabled: !!id,
  });

  const { data: fineFiles } = useQuery({
    queryKey: ["fine-files", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fine_files")
        .select("*")
        .eq("fine_id", id)
        .order("uploaded_at", { ascending: false });
      
      if (error) throw error;
      return data as FineFile[];
    },
    enabled: !!id,
  });

  const { data: ledgerEntries } = useQuery({
    queryKey: ["fine-ledger", id],
    queryFn: async () => {
      if (!fine?.customer_id) return [];
      
      const { data, error } = await supabase
        .from("ledger_entries")
        .select("*")
        .eq("customer_id", fine.customer_id)
        .eq("category", "Fine")
        .order("entry_date", { ascending: true });
      
      if (error) throw error;
      return data as LedgerEntry[];
    },
    enabled: !!fine?.customer_id,
  });

  const { data: pnlEntries } = useQuery({
    queryKey: ["fine-pnl", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pnl_entries")
        .select("*")
        .eq("vehicle_id", fine?.vehicle_id)
        .eq("category", "Fines")
        .eq("source_ref", id);
      
      if (error) throw error;
      return data;
    },
    enabled: !!fine?.vehicle_id && fine?.liability === "Business",
  });

  const appealSuccessfulMutation = useMutation({
    mutationFn: async () => {
      if (!fine) throw new Error("Fine not found");

      // Call the void charge function
      const { error: voidError } = await supabase.rpc('fine_void_charge', {
        f_id: fine.id
      });
      if (voidError) throw voidError;

      // Update fine status
      const { error: updateError } = await supabase
        .from("fines")
        .update({ status: "Appeal Successful" })
        .eq("id", fine.id);
      if (updateError) throw updateError;
    },
    onSuccess: () => {
      toast({
        title: "Appeal Successful",
        description: "Fine has been successfully appealed and charges voided.",
      });
      queryClient.invalidateQueries({ queryKey: ["fine", id] });
      queryClient.invalidateQueries({ queryKey: ["fine-ledger", id] });
    },
    onError: (error) => {
      console.error("Error processing appeal:", error);
      toast({
        title: "Error",
        description: "Failed to process appeal. Please try again.",
        variant: "destructive",
      });
    },
  });

  // New admin-controlled fine actions using the apply-fine edge function
  const chargeFineToAccount = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('apply-fine', {
        body: { fineId: id, action: 'charge' }
      });
      if (error) throw error;
      if (!data.success) throw new Error(data.error || 'Failed to charge fine');
      return data;
    },
    onSuccess: (data) => {
      toast({
        title: "Fine Charged",
        description: `Fine has been charged to customer account. Status: ${data.status}`,
      });
      queryClient.invalidateQueries({ queryKey: ["fine", id] });
      queryClient.invalidateQueries({ queryKey: ["fine-ledger", id] });
      queryClient.invalidateQueries({ queryKey: ["customers"] });
    },
    onError: (error: any) => {
      console.error("Error charging fine:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to charge fine to account. Please try again.",
        variant: "destructive",
      });
    },
  });

  const waiveFine = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('apply-fine', {
        body: { fineId: id, action: 'waive' }
      });
      if (error) throw error;
      if (!data.success) throw new Error(data.error || 'Failed to waive fine');
      return data;
    },
    onSuccess: () => {
      toast({
        title: "Fine Waived",
        description: "Fine has been waived and will not be charged.",
      });
      queryClient.invalidateQueries({ queryKey: ["fine", id] });
      queryClient.invalidateQueries({ queryKey: ["fine-ledger", id] });
    },
    onError: (error: any) => {
      console.error("Error waiving fine:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to waive fine. Please try again.",
        variant: "destructive",
      });
    },
  });

  const markAsAppealed = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('apply-fine', {
        body: { fineId: id, action: 'appeal' }
      });
      if (error) throw error;
      if (!data.success) throw new Error(data.error || 'Failed to mark as appealed');
      return data;
    },
    onSuccess: () => {
      toast({
        title: "Fine Appealed",
        description: "Fine has been marked as appealed.",
      });
      queryClient.invalidateQueries({ queryKey: ["fine", id] });
    },
    onError: (error: any) => {
      console.error("Error marking fine as appealed:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to mark fine as appealed. Please try again.",
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return <div>Loading fine details...</div>;
  }

  if (!fine) {
    return <div>Fine not found</div>;
  }

  const totalCharges = ledgerEntries?.filter(e => e.type === 'Charge').reduce((sum, e) => sum + Number(e.amount), 0) || 0;
  const totalPayments = ledgerEntries?.filter(e => e.type === 'Payment').reduce((sum, e) => sum + Number(e.amount), 0) || 0;
  const outstandingAmount = ledgerEntries?.filter(e => e.type === 'Charge').reduce((sum, e) => sum + Number(e.remaining_amount), 0) || 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" onClick={() => navigate("/fines")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Fines
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Fine Details</h1>
            <p className="text-muted-foreground">
              {fine.reference_no || fine.id.slice(0, 8)} • {fine.vehicles.reg}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {/* Admin Actions for Customer Liability Fines */}
          {fine.liability === 'Customer' && (
            <>
              {(fine.status === 'Open' || fine.status === 'Appealed') && (
                <Button
                  onClick={() => chargeFineToAccount.mutate()}
                  disabled={chargeFineToAccount.isPending}
                  className="bg-red-600 hover:bg-red-700"
                >
                  <CreditCard className="h-4 w-4 mr-2" />
                  {chargeFineToAccount.isPending ? 'Charging...' : 'Charge to Account'}
                </Button>
              )}
              
              {fine.status === 'Open' && (
                <>
                  <Button
                    variant="outline"
                    onClick={() => markAsAppealed.mutate()}
                    disabled={markAsAppealed.isPending}
                  >
                    <Scale className="h-4 w-4 mr-2" />
                    {markAsAppealed.isPending ? 'Processing...' : 'Mark as Appealed'}
                  </Button>
                  
                  <Button
                    variant="outline"
                    onClick={() => waiveFine.mutate()}
                    disabled={waiveFine.isPending}
                  >
                    <Ban className="h-4 w-4 mr-2" />
                    {waiveFine.isPending ? 'Waiving...' : 'Waive Fine'}
                  </Button>
                </>
              )}
              
              {fine.status === 'Appealed' && (
                <Button
                  variant="outline"
                  onClick={() => waiveFine.mutate()}
                  disabled={waiveFine.isPending}
                >
                  <Ban className="h-4 w-4 mr-2" />
                  {waiveFine.isPending ? 'Waiving...' : 'Resolve Appeal - Waive'}
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Fine Summary */}
      <div className="grid gap-6 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Fine Amount</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              £{Number(fine.amount).toLocaleString()}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Status</CardTitle>
          </CardHeader>
          <CardContent>
            <FineStatusBadge 
              status={fine.status}
              dueDate={fine.due_date}
              remainingAmount={outstandingAmount}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Liability</CardTitle>
          </CardHeader>
          <CardContent>
            <Badge variant={fine.liability === 'Customer' ? 'default' : 'secondary'} className="text-lg px-3 py-1">
              {fine.liability}
            </Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Days Until Due</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${new Date(fine.due_date) < new Date() ? 'text-red-600' : 'text-gray-600'}`}>
              {Math.ceil((new Date(fine.due_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="evidence">Evidence</TabsTrigger>
          <TabsTrigger value="accounting">Accounting</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-primary" />
                Fine Information
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Type</p>
                  <p className="font-medium">{fine.type}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Reference</p>
                  <p className="font-medium">{fine.reference_no || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Vehicle</p>
                  <p className="font-medium">
                    {fine.vehicles.reg} ({fine.vehicles.make} {fine.vehicles.model})
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Customer</p>
                  <p className="font-medium">{fine.customers?.name || 'No customer assigned'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Issue Date</p>
                  <p className="font-medium">{new Date(fine.issue_date).toLocaleDateString()}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Due Date</p>
                  <p className="font-medium">{new Date(fine.due_date).toLocaleDateString()}</p>
                </div>
              </div>
              {fine.notes && (
                <div className="mt-4">
                  <p className="text-sm text-muted-foreground">Notes</p>
                  <p className="font-medium">{fine.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="evidence" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                Evidence Files
              </CardTitle>
              <CardDescription>
                Supporting documents and evidence for this fine
              </CardDescription>
            </CardHeader>
            <CardContent>
              {fineFiles && fineFiles.length > 0 ? (
                <div className="grid gap-4">
                  {fineFiles.map((file) => (
                    <div key={file.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div>
                        <p className="font-medium">{file.file_name}</p>
                        <p className="text-sm text-muted-foreground">
                          Uploaded {new Date(file.uploaded_at).toLocaleDateString()}
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        onClick={() => window.open(file.file_url, '_blank')}
                      >
                        View File
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <FileText className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium mb-2">No evidence files</h3>
                  <p className="text-muted-foreground">No evidence has been uploaded for this fine</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="accounting" className="space-y-6">
          {fine.liability === "Customer" && fine.customers ? (
            <>
              {/* Customer Accounting Summary */}
              <div className="grid gap-6 md:grid-cols-3">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg">Total Charges</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-red-600">
                      £{totalCharges.toLocaleString()}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg">Total Payments</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-green-600">
                      £{totalPayments.toLocaleString()}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg">Outstanding</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className={`text-2xl font-bold ${outstandingAmount > 0 ? 'text-red-600' : 'text-green-600'}`}>
                      £{outstandingAmount.toLocaleString()}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Ledger Entries */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <DollarSign className="h-5 w-5 text-primary" />
                    Customer Ledger (Fine Charges & Payments)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {ledgerEntries && ledgerEntries.length > 0 ? (
                    <div className="rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead>Due Date</TableHead>
                            <TableHead className="text-right">Amount</TableHead>
                            <TableHead className="text-right">Remaining</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {ledgerEntries.map((entry) => (
                            <TableRow key={entry.id}>
                              <TableCell>{new Date(entry.entry_date).toLocaleDateString()}</TableCell>
                              <TableCell>
                                <Badge variant={entry.type === 'Charge' ? 'destructive' : 'default'}>
                                  {entry.type}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                {entry.due_date ? new Date(entry.due_date).toLocaleDateString() : '-'}
                              </TableCell>
                              <TableCell className={`text-right ${entry.type === 'Charge' ? 'text-red-600' : 'text-green-600'}`}>
                                {entry.type === 'Charge' ? '+' : '-'}£{Number(entry.amount).toLocaleString()}
                              </TableCell>
                              <TableCell className="text-right">
                                £{Number(entry.remaining_amount).toLocaleString()}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <p className="text-center py-8 text-muted-foreground">No ledger entries found</p>
                  )}
                </CardContent>
              </Card>
            </>
          ) : (
            /* Business Liability P&L */
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-primary" />
                  Business P&L Impact
                </CardTitle>
                <CardDescription>
                  This fine is a business liability and recorded as a cost
                </CardDescription>
              </CardHeader>
              <CardContent>
                {pnlEntries && pnlEntries.length > 0 ? (
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Category</TableHead>
                          <TableHead>Side</TableHead>
                          <TableHead className="text-right">Amount</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {pnlEntries.map((entry) => (
                          <TableRow key={entry.id}>
                            <TableCell>{new Date(entry.entry_date).toLocaleDateString()}</TableCell>
                            <TableCell>{entry.category}</TableCell>
                            <TableCell>
                              <Badge variant="destructive">{entry.side}</Badge>
                            </TableCell>
                            <TableCell className="text-right text-red-600">
                              £{Number(entry.amount).toLocaleString()}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <p className="text-center py-8 text-muted-foreground">No P&L entries found</p>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Appeal Dialog */}
      <FineAppealDialog
        open={showAppealDialog}
        onOpenChange={setShowAppealDialog}
        fineId={fine.id}
        fineAmount={fine.amount}
        customerId={fine.customer_id || undefined}
      />
    </div>
  );
};

export default FineDetail;