import { useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  ArrowLeft,
  CreditCard,
  FileText,
  Plus,
  Upload,
  Car,
  AlertTriangle,
  Eye,
  Download,
  Edit,
  Trash2,
  User,
  Mail,
  Phone,
  CalendarPlus,
  DollarSign,
  FolderOpen,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useCustomerDocuments, useDeleteCustomerDocument, useDownloadDocument } from "@/hooks/useCustomerDocuments";
import { useCustomerBalanceWithStatus } from "@/hooks/useCustomerBalance";
import AddCustomerDocumentDialog from "@/components/AddCustomerDocumentDialog";
import { NextOfKinCard } from "@/components/NextOfKinCard";
import { format } from "date-fns";

interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string;
  type: string;
  customer_type?: "Individual" | "Company";
  status: string;
  whatsapp_opt_in: boolean;
  high_switcher?: boolean;
  nok_full_name?: string;
  nok_relationship?: string;
  nok_phone?: string;
  nok_email?: string;
  nok_address?: string;
}

interface Rental {
  id: string;
  start_date: string;
  end_date: string;
  monthly_amount: number;
  status: string;
  vehicles: { id: string; reg: string; make: string; model: string };
}

interface Payment {
  id: string;
  amount: number;
  entry_date: string;
  category: string;
  vehicles: { reg: string };
  payments: { method?: string };
}

interface Fine {
  id: string;
  reference_no: string;
  issue_date: string;
  due_date: string;
  amount: number;
  status: string;
  type: string;
  vehicles: { reg: string; make: string; model: string };
}

interface VehicleHistory {
  id: string;
  reg: string;
  make: string;
  model: string;
  colour: string;
  start_date: string;
  end_date?: string;
  status: string;
}

const CustomerDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [documentDialogOpen, setDocumentDialogOpen] = useState(false);
  const [editingDocumentId, setEditingDocumentId] = useState<string | undefined>();

  const { data: customer, isLoading } = useQuery({
    queryKey: ["customer", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customers")
        .select("*")
        .eq("id", id)
        .single();
      
      if (error) throw error;
      return data as Customer;
    },
    enabled: !!id,
  });

  const { data: rentals } = useQuery({
    queryKey: ["customer-rentals", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rentals")
        .select(`
          *,
          vehicles(id, reg, make, model)
        `)
        .eq("customer_id", id)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data as Rental[];
    },
    enabled: !!id,
  });

  const { data: payments } = useQuery({
    queryKey: ["customer-payments", id],
    queryFn: async () => {
      // Query payments table directly for accurate data
      const { data, error } = await supabase
        .from("payments")
        .select(`
          id,
          amount,
          payment_date,
          payment_type,
          method,
          vehicles(reg)
        `)
        .eq("customer_id", id)
        .order("payment_date", { ascending: false });
      
      if (error) throw error;
      
      // Transform to match expected interface
      return data.map(payment => ({
        id: payment.id,
        amount: payment.amount,
        entry_date: payment.payment_date,
        category: payment.payment_type,
        vehicles: payment.vehicles,
        payments: { method: payment.method }
      })) as Payment[];
    },
    enabled: !!id,
  });

  const { data: fines } = useQuery({
    queryKey: ["customer-fines", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fines")
        .select(`
          *,
          vehicles(reg, make, model)
        `)
        .eq("customer_id", id)
        .order("issue_date", { ascending: false });
      
      if (error) throw error;
      return data as Fine[];
    },
    enabled: !!id,
  });

  const { data: documents, isLoading: documentsLoading } = useCustomerDocuments(id!);
  const deleteDocumentMutation = useDeleteCustomerDocument();
  const downloadDocumentMutation = useDownloadDocument();

  const { data: vehicleHistory, isLoading: vehicleHistoryLoading } = useQuery({
    queryKey: ["customer-vehicle-history", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rentals")
        .select(`
          vehicles(id, reg, make, model, colour),
          start_date,
          end_date,
          status
        `)
        .eq("customer_id", id)
        .order("start_date", { ascending: false });
      
      if (error) throw error;
      
      // Transform data to show vehicle history
      const history = data?.map(rental => ({
        id: rental.vehicles?.id || '',
        reg: rental.vehicles?.reg || '',
        make: rental.vehicles?.make || '',
        model: rental.vehicles?.model || '',
        colour: rental.vehicles?.colour || '',
        start_date: rental.start_date,
        end_date: rental.end_date,
        status: rental.status,
      })) || [];
      
      return history as VehicleHistory[];
    },
    enabled: !!id,
  });

  // Use the enhanced customer balance hook with status
  const { data: customerBalanceData } = useCustomerBalanceWithStatus(id);

  if (isLoading) {
    return <div>Loading customer details...</div>;
  }

  if (!customer) {
    return <div>Customer not found</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" onClick={() => navigate("/customers")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Customers
          </Button>
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              {customer.name}
              {customer.high_switcher && (
                <Badge variant="secondary" className="text-sm">
                  High Switcher
                </Badge>
              )}
            </h1>
            <p className="text-muted-foreground">
              {customer.customer_type || customer.type} Customer
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate(`/rentals/new?customer=${id}`)}>
            <CalendarPlus className="h-4 w-4 mr-2" />
            Add Rental
          </Button>
          <Button variant="outline" onClick={() => navigate(`/payments?customer=${id}`)}>
            <DollarSign className="h-4 w-4 mr-2" />
            Add Payment
          </Button>
          <Button variant="outline" onClick={() => navigate(`/fines/new?customer=${id}`)}>
            <AlertTriangle className="h-4 w-4 mr-2" />
            Upload Fine
          </Button>
          <Button>
            <Edit className="h-4 w-4 mr-2" />
            Edit Customer
          </Button>
        </div>
      </div>

      {/* Customer Info Cards */}
      <div className="grid gap-6 md:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-4 w-4" />
              Contact Info
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {customer.email && (
              <div className="flex items-center gap-2 text-sm">
                <Mail className="h-4 w-4" />
                <a href={`mailto:${customer.email}`} className="hover:underline">
                  {customer.email}
                </a>
              </div>
            )}
            {customer.phone && (
              <div className="flex items-center gap-2 text-sm">
                <Phone className="h-4 w-4" />
                <a href={`tel:${customer.phone}`} className="hover:underline">
                  {customer.phone}
                </a>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Account Status</CardTitle>
          </CardHeader>
          <CardContent>
            {customerBalanceData ? (
              <div className="space-y-2">
                <Badge 
                  variant={
                    customerBalanceData.status === 'In Credit' ? 'default' : 
                    customerBalanceData.status === 'Settled' ? 'secondary' : 
                    'destructive'
                  }
                >
                  {customerBalanceData.status}
                </Badge>
                {customerBalanceData.balance > 0 && (
                  <p className="text-2xl font-bold">
                    £{customerBalanceData.balance.toLocaleString()}
                  </p>
                )}
              </div>
            ) : (
              <Badge variant="secondary">Loading...</Badge>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Quick Stats</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="text-2xl font-bold">{rentals?.length || 0}</div>
            <p className="text-xs text-muted-foreground">Active Rentals</p>
          </CardContent>
        </Card>

        <NextOfKinCard 
          nokFullName={customer.nok_full_name}
          nokRelationship={customer.nok_relationship}
          nokPhone={customer.nok_phone}
          nokEmail={customer.nok_email}
          nokAddress={customer.nok_address}
          onEdit={() => {/* Add edit handler */}}
        />
      </div>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5 text-primary" />
              Contact Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">{customer.email || 'No email'}</span>
            </div>
            <div className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">{customer.phone || 'No phone'}</span>
              {customer.whatsapp_opt_in && (
                <Badge variant="outline" className="ml-1">WhatsApp</Badge>
              )}
            </div>
            <div>
              <Badge variant={customer.status === 'Active' ? 'default' : 'secondary'}>
                {customer.status}
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Account Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div>
              {customerBalanceData ? (
                <Badge 
                  variant={
                    customerBalanceData.status === 'Settled' ? 'secondary' :
                    customerBalanceData.status === 'In Credit' ? 'default' : 'destructive'
                  }
                  className={
                    customerBalanceData.status === 'In Credit' 
                      ? "text-lg px-3 py-1 bg-green-600 hover:bg-green-700"
                      : "text-lg px-3 py-1"
                  }
                >
                  {customerBalanceData.status === 'Settled' && 'Settled'}
                  {customerBalanceData.status === 'In Credit' && `In Credit £${Math.abs(customerBalanceData.balance).toFixed(2)}`}
                  {customerBalanceData.status === 'In Debt' && `In Debt £${Math.abs(customerBalanceData.balance).toFixed(2)}`}
                </Badge>
              ) : (
                <Badge variant="secondary" className="text-lg px-3 py-1">
                  Loading...
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quick Stats</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Active Rentals</span>
              <span className="font-medium">
                {rentals?.filter(r => r.status === 'Active').length || 0}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Total Payments</span>
              <span className="font-medium">{payments?.length || 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Open Fines</span>
              <span className="font-medium">
                {fines?.filter(f => f.status === 'Open').length || 0}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Documents</span>
              <span className="font-medium">{documents?.length || 0}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="rentals">
        <div className="flex items-center justify-between mb-4">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="rentals">Rentals ({rentals?.length || 0})</TabsTrigger>
            <TabsTrigger value="payments">Payments ({payments?.length || 0})</TabsTrigger>
            <TabsTrigger value="fines">Fines ({fines?.length || 0})</TabsTrigger>
            <TabsTrigger value="vehicles">Vehicle History ({vehicleHistory?.length || 0})</TabsTrigger>
            <TabsTrigger value="documents">Documents & IDs ({documents?.length || 0})</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="rentals">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                Rental History
              </CardTitle>
              <CardDescription>All rentals for this customer</CardDescription>
            </CardHeader>
            <CardContent>
              {rentals && rentals.length > 0 ? (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Vehicle</TableHead>
                        <TableHead>Start Date</TableHead>
                        <TableHead>End Date</TableHead>
                        <TableHead className="text-right">Monthly Amount</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rentals.map((rental) => (
                        <TableRow key={rental.id}>
                          <TableCell className="font-medium">
                            {rental.vehicles?.reg} ({rental.vehicles?.make} {rental.vehicles?.model})
                          </TableCell>
                          <TableCell>{new Date(rental.start_date).toLocaleDateString()}</TableCell>
                          <TableCell>{rental.end_date ? new Date(rental.end_date).toLocaleDateString() : 'Ongoing'}</TableCell>
                          <TableCell className="text-right">£{Number(rental.monthly_amount).toLocaleString()}</TableCell>
                          <TableCell>
                            <Badge variant={rental.status === 'Active' ? 'default' : 'secondary'}>
                              {rental.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => navigate(`/rentals/${rental.id}`)}
                            >
                              View
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <p className="text-center py-8 text-muted-foreground">No rentals found</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payments">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-primary" />
                Payment History
              </CardTitle>
              <CardDescription>All payments made by this customer</CardDescription>
            </CardHeader>
            <CardContent>
              {payments && payments.length > 0 ? (
                <div className="rounded-md border">
                  <Table>
                     <TableHeader>
                        <TableRow>
                         <TableHead>Date</TableHead>
                         <TableHead>Vehicle</TableHead>
                         <TableHead>Type</TableHead>
                         <TableHead>Method</TableHead>
                         <TableHead className="text-right">Amount</TableHead>
                       </TableRow>
                    </TableHeader>
                    <TableBody>
                       {payments.map((payment) => (
                          <TableRow key={payment.id}>
                            <TableCell>{new Date(payment.entry_date).toLocaleDateString()}</TableCell>
                            <TableCell>{payment.vehicles?.reg}</TableCell>
                            <TableCell>
                               <Badge variant={payment.category === 'Rental' ? 'default' : payment.category === 'Initial Fees' ? 'secondary' : 'outline'}>
                                 {payment.category === 'Initial Fees' ? 'Initial Fee' : payment.category}
                               </Badge>
                            </TableCell>
                            <TableCell>{payment.payments?.method || 'Cash'}</TableCell>
                             <TableCell className="text-right font-medium">
                               £{Math.abs(Number(payment.amount)).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                             </TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <p className="text-center py-8 text-muted-foreground">No payments found</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="fines">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-primary" />
                Fines
              </CardTitle>
              <CardDescription>All fines assigned to this customer</CardDescription>
            </CardHeader>
            <CardContent>
              {fines && fines.length > 0 ? (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Reference</TableHead>
                        <TableHead>Vehicle</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Issue Date</TableHead>
                        <TableHead>Due Date</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {fines.map((fine) => (
                        <TableRow key={fine.id}>
                          <TableCell className="font-medium">{fine.reference_no}</TableCell>
                          <TableCell>
                            {fine.vehicles?.reg} ({fine.vehicles?.make} {fine.vehicles?.model})
                          </TableCell>
                          <TableCell>{fine.type}</TableCell>
                          <TableCell>{new Date(fine.issue_date).toLocaleDateString()}</TableCell>
                          <TableCell>{new Date(fine.due_date).toLocaleDateString()}</TableCell>
                          <TableCell className="text-right">£{Number(fine.amount).toFixed(2)}</TableCell>
                          <TableCell>
                            <Badge variant={fine.status === 'Open' ? 'destructive' : 'secondary'}>
                              {fine.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => navigate(`/fines/${fine.id}`)}
                            >
                              View
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <p className="text-center py-8 text-muted-foreground">No fines found</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Insurance is now handled through documents - removed tab */}

        <TabsContent value="vehicles">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Car className="h-5 w-5 text-primary" />
                Vehicle History
              </CardTitle>
              <CardDescription>All vehicles rented by this customer</CardDescription>
            </CardHeader>
            <CardContent>
              {vehicleHistoryLoading ? (
                <div className="text-center py-4">Loading vehicle history...</div>
              ) : vehicleHistory && vehicleHistory.length > 0 ? (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Vehicle</TableHead>
                        <TableHead>Registration</TableHead>
                        <TableHead>Color</TableHead>
                        <TableHead>Start Date</TableHead>
                        <TableHead>End Date</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {vehicleHistory.map((vehicle) => (
                        <TableRow key={`${vehicle.id}-${vehicle.start_date}`}>
                          <TableCell className="font-medium">
                            {vehicle.make} {vehicle.model}
                          </TableCell>
                          <TableCell>{vehicle.reg}</TableCell>
                          <TableCell>{vehicle.colour}</TableCell>
                          <TableCell>{new Date(vehicle.start_date).toLocaleDateString()}</TableCell>
                          <TableCell>
                            {vehicle.end_date ? new Date(vehicle.end_date).toLocaleDateString() : 'Ongoing'}
                          </TableCell>
                          <TableCell>
                            <Badge variant={vehicle.status === 'Active' ? 'default' : 'secondary'}>
                              {vehicle.status}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <p className="text-center py-8 text-muted-foreground">No vehicle history found</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="documents">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>Documents & IDs</CardTitle>
                <Button onClick={() => {
                  setEditingDocumentId(undefined);
                  setDocumentDialogOpen(true);
                }}>
                  <Upload className="mr-2 h-4 w-4" />
                  Add Document
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {documentsLoading ? (
                <div className="text-center py-4">Loading documents...</div>
              ) : !documents || documents.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No documents found for this customer.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Type</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Provider/Policy</TableHead>
                      <TableHead>Start</TableHead>
                      <TableHead>End (Expiry)</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>File</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {documents.map((document) => (
                      <TableRow key={document.id}>
                        <TableCell className="font-medium">
                          {document.document_type}
                        </TableCell>
                        <TableCell>{document.document_name}</TableCell>
                        <TableCell>
                          {document.insurance_provider ? (
                            <>
                              <div className="text-sm font-medium">
                                {document.insurance_provider}
                              </div>
                              {document.policy_number && (
                                <div className="text-xs text-muted-foreground">
                                  {document.policy_number}
                                </div>
                              )}
                            </>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {document.start_date ? format(new Date(document.start_date), "MMM dd, yyyy") : "-"}
                        </TableCell>
                        <TableCell>
                          {document.end_date ? format(new Date(document.end_date), "MMM dd, yyyy") : "-"}
                        </TableCell>
                        <TableCell>
                          <DocumentStatusBadge endDate={document.end_date} />
                        </TableCell>
                        <TableCell>
                          {document.file_url ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => downloadDocumentMutation.mutate(document)}
                              disabled={downloadDocumentMutation.isPending}
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                          ) : (
                            <span className="text-muted-foreground text-sm">No file</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setEditingDocumentId(document.id);
                                setDocumentDialogOpen(true);
                              }}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="sm">
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete Document</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to delete this document? This action cannot be undone.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => deleteDocumentMutation.mutate(document.id)}
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  >
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <AddCustomerDocumentDialog
        open={documentDialogOpen}
        onOpenChange={(open) => {
          setDocumentDialogOpen(open);
          if (!open) setEditingDocumentId(undefined);
        }}
        customerId={id!}
        documentId={editingDocumentId}
      />
    </div>
  );
};

export default CustomerDetail;