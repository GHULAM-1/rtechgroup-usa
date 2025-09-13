import { useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { User, ArrowLeft, Edit, Mail, Phone, FileText, CreditCard, Plus, Car, AlertTriangle, FolderOpen, CalendarPlus, DollarSign } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { AddCustomerDocumentDialog } from "@/components/AddCustomerDocumentDialog";
import { PaymentStatusBadge } from "@/components/PaymentStatusBadge";
import { useCustomerBalance } from "@/hooks/useCustomerBalance";

interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string;
  type: string;
  status: string;
  whatsapp_opt_in: boolean;
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
  payment_date: string;
  payment_type: string;
  method?: string;
  remaining?: number;
  vehicles: { reg: string };
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

interface CustomerDocument {
  id: string;
  document_type: string;
  document_name: string;
  insurance_provider?: string;
  policy_number?: string;
  policy_start_date?: string;
  policy_end_date?: string;
  notes?: string;
  uploaded_at: string;
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
  const [showDocumentDialog, setShowDocumentDialog] = useState(false);

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
      const { data, error } = await supabase
        .from("payments")
        .select(`
          *,
          vehicles(reg)
        `)
        .eq("customer_id", id)
        .order("payment_date", { ascending: false });
      
      if (error) throw error;

      // Get payment applications for each payment to calculate applied/remaining amounts
      const paymentsWithStatus = await Promise.all(
        (data || []).map(async (payment) => {
          const { data: applications } = await supabase
            .from("payment_applications")
            .select("amount_applied")
            .eq("payment_id", payment.id);
          
          const applied = applications?.reduce((sum, app) => sum + Number(app.amount_applied), 0) || 0;
          const remaining = Number(payment.amount) - applied;
          
          return {
            ...payment,
            applied,
            remaining
          };
        })
      );
      
      return paymentsWithStatus as (Payment & { applied: number; remaining: number })[];
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

  const { data: documents } = useQuery({
    queryKey: ["customer-documents", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customer_documents")
        .select("*")
        .eq("customer_id", id)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data as CustomerDocument[];
    },
    enabled: !!id,
  });

  const { data: vehicleHistory } = useQuery({
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

  // Use the new customer balance hook
  const { data: customerBalance } = useCustomerBalance(id);

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
            <h1 className="text-3xl font-bold">{customer.name}</h1>
            <p className="text-muted-foreground">{customer.type} Customer</p>
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
      <div className="grid gap-6 md:grid-cols-3">
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
              {(customerBalance ?? 0) === 0 ? (
                <Badge variant="secondary" className="text-lg px-3 py-1">
                  Settled
                </Badge>
              ) : (customerBalance ?? 0) > 0 ? (
                <Badge variant="destructive" className="text-lg px-3 py-1">
                  In Debt £{Math.abs(customerBalance || 0).toFixed(2)}
                </Badge>
              ) : (
                <Badge variant="default" className="text-lg px-3 py-1 bg-green-600 hover:bg-green-700">
                  In Credit £{Math.abs(customerBalance || 0).toFixed(2)}
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
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="rentals">
        <TabsList>
          <TabsTrigger value="rentals">Rentals</TabsTrigger>
          <TabsTrigger value="payments">Payments</TabsTrigger>
          <TabsTrigger value="fines">Fines</TabsTrigger>
          <TabsTrigger value="vehicle-history">Vehicle History</TabsTrigger>
          <TabsTrigger value="documents">Documents & IDs</TabsTrigger>
        </TabsList>

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
                         <TableHead className="text-right">Amount & Status</TableHead>
                       </TableRow>
                    </TableHeader>
                    <TableBody>
                      {payments.map((payment) => (
                         <TableRow key={payment.id}>
                           <TableCell>{new Date(payment.payment_date).toLocaleDateString()}</TableCell>
                           <TableCell>{payment.vehicles?.reg}</TableCell>
                           <TableCell>
                              <Badge variant={payment.payment_type === 'Rental' ? 'default' : payment.payment_type === 'InitialFee' ? 'secondary' : 'outline'}>
                                {payment.payment_type === 'InitialFee' ? 'Initial Fee' : payment.payment_type}
                              </Badge>
                           </TableCell>
                           <TableCell>{payment.method || 'Cash'}</TableCell>
                           <TableCell>
                             <div className="text-right">
                               <div className="font-medium">
                                 £{Number(payment.amount).toLocaleString()}
                               </div>
                               <div className="text-xs text-muted-foreground">
                                 Applied: £{(payment.applied || 0).toLocaleString()} | 
                                 Remaining: £{(payment.remaining || 0).toLocaleString()}
                               </div>
                               <PaymentStatusBadge 
                                 applied={payment.applied || 0} 
                                 amount={Number(payment.amount)}
                               />
                             </div>
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
                          <TableCell className="text-right">£{Number(fine.amount).toLocaleString()}</TableCell>
                          <TableCell>
                            <Badge variant={fine.status === 'Paid' ? 'default' : 'destructive'}>
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

        <TabsContent value="vehicle-history">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Car className="h-5 w-5 text-primary" />
                Vehicle History
              </CardTitle>
              <CardDescription>All vehicles rented by this customer</CardDescription>
            </CardHeader>
            <CardContent>
              {vehicleHistory && vehicleHistory.length > 0 ? (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Registration</TableHead>
                        <TableHead>Vehicle</TableHead>
                        <TableHead>Colour</TableHead>
                        <TableHead>Start Date</TableHead>
                        <TableHead>End Date</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {vehicleHistory.map((vehicle) => (
                        <TableRow key={vehicle.id + vehicle.start_date}>
                          <TableCell className="font-medium">{vehicle.reg}</TableCell>
                          <TableCell>{vehicle.make} {vehicle.model}</TableCell>
                          <TableCell>{vehicle.colour}</TableCell>
                          <TableCell>{new Date(vehicle.start_date).toLocaleDateString()}</TableCell>
                          <TableCell>{vehicle.end_date ? new Date(vehicle.end_date).toLocaleDateString() : 'Ongoing'}</TableCell>
                          <TableCell>
                            <Badge variant={vehicle.status === 'Active' ? 'default' : 'secondary'}>
                              {vehicle.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => navigate(`/vehicles/${vehicle.id}`)}
                            >
                              View Vehicle
                            </Button>
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
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <FolderOpen className="h-5 w-5 text-primary" />
                    Documents & IDs
                  </CardTitle>
                  <CardDescription>
                    National Insurance, Driving Licence, Insurance certificates, Address proof, and other documents
                  </CardDescription>
                </div>
                <Button onClick={() => setShowDocumentDialog(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Document
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {documents && documents.length > 0 ? (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Document Type</TableHead>
                        <TableHead>Name/Description</TableHead>
                        <TableHead>Details</TableHead>
                        <TableHead>Upload Date</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {documents.map((doc) => (
                        <TableRow key={doc.id}>
                          <TableCell>
                            <Badge variant="outline">{doc.document_type}</Badge>
                          </TableCell>
                          <TableCell className="font-medium">{doc.document_name}</TableCell>
                          <TableCell>
                            {doc.document_type === 'Insurance Certificate' && (
                              <div className="text-sm text-muted-foreground">
                                {doc.insurance_provider && <div>Provider: {doc.insurance_provider}</div>}
                                {doc.policy_number && <div>Policy: {doc.policy_number}</div>}
                                {doc.policy_start_date && doc.policy_end_date && (
                                  <div>
                                    Valid: {new Date(doc.policy_start_date).toLocaleDateString()} - {new Date(doc.policy_end_date).toLocaleDateString()}
                                  </div>
                                )}
                              </div>
                            )}
                            {doc.notes && <div className="text-sm text-muted-foreground">{doc.notes}</div>}
                          </TableCell>
                          <TableCell>{new Date(doc.uploaded_at).toLocaleDateString()}</TableCell>
                          <TableCell>
                            <Button variant="outline" size="sm">
                              View
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-8">
                  <FolderOpen className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium mb-2">No documents uploaded</h3>
                  <p className="text-muted-foreground mb-4">Upload customer documents and IDs to get started</p>
                  <Button onClick={() => setShowDocumentDialog(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Document
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <AddCustomerDocumentDialog
        open={showDocumentDialog}
        onOpenChange={setShowDocumentDialog}
        customerId={id!}
      />
    </div>
  );
};

export default CustomerDetail;