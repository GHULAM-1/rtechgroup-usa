import { useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, CreditCard, FileText, Plus, Upload, Car, AlertTriangle, Eye, Download, Edit, Trash2, User, Mail, Phone, CalendarPlus, DollarSign, FolderOpen } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useCustomerDocuments, useDeleteCustomerDocument, useDownloadDocument } from "@/hooks/useCustomerDocuments";
import { useCustomerBalanceWithStatus } from "@/hooks/useCustomerBalance";
import { useCustomerActiveRentals } from "@/hooks/useCustomerActiveRentals";
import { useCustomerRentals } from "@/hooks/useCustomerRentals";
import { useCustomerPayments, useCustomerPaymentStats } from "@/hooks/useCustomerPayments";
import { useCustomerFines, useCustomerFineStats } from "@/hooks/useCustomerFines";
import { useCustomerVehicleHistory } from "@/hooks/useCustomerVehicleHistory";
import AddCustomerDocumentDialog from "@/components/AddCustomerDocumentDialog";
import { AddPaymentDialog } from "@/components/AddPaymentDialog";
import { AddFineDialog } from "@/components/AddFineDialog";
import { CustomerFormModal } from "@/components/CustomerFormModal";
import DocumentStatusBadge from "@/components/DocumentStatusBadge";
import { NextOfKinCard } from "@/components/NextOfKinCard";
import { PaymentStatusBadge } from "@/components/PaymentStatusBadge";
import { FineStatusBadge } from "@/components/FineStatusBadge";
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

const CustomerDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [documentDialogOpen, setDocumentDialogOpen] = useState(false);
  const [editingDocumentId, setEditingDocumentId] = useState<string | undefined>();
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [fineDialogOpen, setFineDialogOpen] = useState(false);
  const [editCustomerOpen, setEditCustomerOpen] = useState(false);

  const { data: customer, isLoading } = useQuery({
    queryKey: ["customer", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customers")
        .select(`
          id, name, email, phone, type, customer_type, status, whatsapp_opt_in, high_switcher,
          nok_full_name, nok_relationship, nok_phone, nok_email, nok_address
        `)
        .eq("id", id)
        .single();
      
      if (error) throw error;
      return data as Customer;
    },
    enabled: !!id,
  });

  // Use the enhanced customer balance hook with status
  const { data: customerBalanceData } = useCustomerBalanceWithStatus(id);
  
  // Fetch customer data
  const { data: activeRentalsCount } = useCustomerActiveRentals(id!);
  const { data: rentals } = useCustomerRentals(id!);
  const { data: payments } = useCustomerPayments(id!);
  const { data: paymentStats } = useCustomerPaymentStats(id!);
  const { data: fines } = useCustomerFines(id!);
  const { data: fineStats } = useCustomerFineStats(id!);
  const { data: vehicleHistory } = useCustomerVehicleHistory(id!);
  const { data: documents } = useCustomerDocuments(id!);

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
        <div className="flex items-center gap-2">
          <Button onClick={() => navigate(`/rentals/new?customer=${id}`)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Rental
          </Button>
          <Button variant="outline" onClick={() => setPaymentDialogOpen(true)}>
            <DollarSign className="h-4 w-4 mr-2" />
            Add Payment
          </Button>
          <Button variant="outline" onClick={() => setFineDialogOpen(true)}>
            <AlertTriangle className="h-4 w-4 mr-2" />
            Upload Fine
          </Button>
          <Button variant="outline" onClick={() => setEditCustomerOpen(true)}>
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
            <CardTitle className="text-sm font-medium">Active Rentals</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="text-2xl font-bold">{activeRentalsCount || 0}</div>
            <p className="text-xs text-muted-foreground">Current Active</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Payment Stats</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="text-2xl font-bold">{paymentStats?.paymentCount || 0}</div>
            <p className="text-xs text-muted-foreground">Total Payments</p>
            {paymentStats?.totalPayments && paymentStats.totalPayments > 0 && (
              <p className="text-sm text-muted-foreground">
                £{paymentStats.totalPayments.toLocaleString()}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Fine Stats</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="text-2xl font-bold">{fineStats?.openFines || 0}</div>
            <p className="text-xs text-muted-foreground">Open Fines</p>
            {fineStats?.openFineAmount && fineStats.openFineAmount > 0 && (
              <p className="text-sm text-destructive">
                £{fineStats.openFineAmount.toLocaleString()}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Documents</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="text-2xl font-bold">{documents?.length || 0}</div>
            <p className="text-xs text-muted-foreground">Total Documents</p>
          </CardContent>
        </Card>

        <NextOfKinCard 
          nokFullName={customer.nok_full_name}
          nokRelationship={customer.nok_relationship}
          nokPhone={customer.nok_phone}
          nokEmail={customer.nok_email}
          nokAddress={customer.nok_address}
          onEdit={() => setEditCustomerOpen(true)}
        />
      </div>

      {/* Complete Tabbed Interface */}
      <Tabs defaultValue="rentals">
        <TabsList>
          <TabsTrigger value="rentals">Rentals</TabsTrigger>
          <TabsTrigger value="payments">Payments</TabsTrigger>
          <TabsTrigger value="fines">Fines</TabsTrigger>
          <TabsTrigger value="vehicles">Vehicle History</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
        </TabsList>

        <TabsContent value="rentals">
          <Card>
            <CardHeader>
              <CardTitle>Customer Rentals</CardTitle>
              <CardDescription>All rental agreements for this customer</CardDescription>
            </CardHeader>
            <CardContent>
              {rentals && rentals.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Vehicle</TableHead>
                      <TableHead>Start Date</TableHead>
                      <TableHead>End Date</TableHead>
                      <TableHead>Monthly Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rentals.map((rental) => (
                      <TableRow key={rental.id}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{rental.vehicle.reg}</div>
                            <div className="text-sm text-muted-foreground">
                              {rental.vehicle.make} {rental.vehicle.model}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>{format(new Date(rental.start_date), "dd/MM/yyyy")}</TableCell>
                        <TableCell>
                          {rental.end_date ? format(new Date(rental.end_date), "dd/MM/yyyy") : "Ongoing"}
                        </TableCell>
                        <TableCell>£{rental.monthly_amount.toLocaleString()}</TableCell>
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
                            <Eye className="h-4 w-4 mr-1" />
                            View
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No rentals found for this customer
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payments">
          <Card>
            <CardHeader>
              <CardTitle>Payment History</CardTitle>
              <CardDescription>All payments made by this customer</CardDescription>
            </CardHeader>
            <CardContent>
              {payments && payments.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Method</TableHead>
                      <TableHead>Vehicle</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Remaining</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payments.map((payment) => (
                      <TableRow key={payment.id}>
                        <TableCell>{format(new Date(payment.payment_date), "dd/MM/yyyy")}</TableCell>
                        <TableCell>£{payment.amount.toLocaleString()}</TableCell>
                        <TableCell>{payment.method}</TableCell>
                        <TableCell>{payment.vehicle?.reg || "-"}</TableCell>
                        <TableCell>
                          <PaymentStatusBadge 
                            applied={payment.amount - payment.remaining_amount} 
                            amount={payment.amount} 
                          />
                        </TableCell>
                        <TableCell>
                          {payment.remaining_amount > 0 ? (
                            <span className="text-orange-600">£{payment.remaining_amount.toLocaleString()}</span>
                          ) : (
                            <span className="text-green-600">Fully Applied</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No payments found for this customer
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="fines">
          <Card>
            <CardHeader>
              <CardTitle>Customer Fines</CardTitle>
              <CardDescription>All fines associated with this customer</CardDescription>
            </CardHeader>
            <CardContent>
              {fines && fines.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Type</TableHead>
                      <TableHead>Reference</TableHead>
                      <TableHead>Vehicle</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Issue Date</TableHead>
                      <TableHead>Due Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Liability</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {fines.map((fine) => (
                      <TableRow key={fine.id}>
                        <TableCell>{fine.type}</TableCell>
                        <TableCell>{fine.reference_no || "-"}</TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">{fine.vehicle.reg}</div>
                            <div className="text-sm text-muted-foreground">
                              {fine.vehicle.make} {fine.vehicle.model}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>£{fine.amount.toLocaleString()}</TableCell>
                        <TableCell>{format(new Date(fine.issue_date), "dd/MM/yyyy")}</TableCell>
                        <TableCell>{format(new Date(fine.due_date), "dd/MM/yyyy")}</TableCell>
                        <TableCell>
                          <FineStatusBadge 
                            status={fine.status}
                            dueDate={fine.due_date}
                            remainingAmount={fine.amount}
                          />
                        </TableCell>
                        <TableCell>
                          <Badge variant={fine.liability === 'Customer' ? 'default' : 'secondary'}>
                            {fine.liability}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No fines found for this customer
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="vehicles">
          <Card>
            <CardHeader>
              <CardTitle>Vehicle History</CardTitle>
              <CardDescription>All vehicles this customer has rented</CardDescription>
            </CardHeader>
            <CardContent>
              {vehicleHistory && vehicleHistory.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Vehicle</TableHead>
                      <TableHead>Start Date</TableHead>
                      <TableHead>End Date</TableHead>
                      <TableHead>Monthly Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {vehicleHistory.map((history) => (
                      <TableRow key={history.rental_id}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{history.vehicle_reg}</div>
                            <div className="text-sm text-muted-foreground">
                              {history.vehicle_make} {history.vehicle_model}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>{format(new Date(history.start_date), "dd/MM/yyyy")}</TableCell>
                        <TableCell>
                          {history.end_date ? format(new Date(history.end_date), "dd/MM/yyyy") : "Ongoing"}
                        </TableCell>
                        <TableCell>£{history.monthly_amount.toLocaleString()}</TableCell>
                        <TableCell>
                          <Badge variant={history.status === 'Active' ? 'default' : 'secondary'}>
                            {history.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => navigate(`/vehicles/${history.vehicle_id}`)}
                          >
                            <Car className="h-4 w-4 mr-1" />
                            View Vehicle
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No vehicle history found for this customer
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="documents">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Customer Documents</span>
                <Button onClick={() => setDocumentDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Document
                </Button>
              </CardTitle>
              <CardDescription>All documents uploaded for this customer</CardDescription>
            </CardHeader>
            <CardContent>
              {documents && documents.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Document</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Uploaded</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {documents.map((doc) => (
                      <TableRow key={doc.id}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{doc.document_name}</div>
                            {doc.file_name && (
                              <div className="text-sm text-muted-foreground">{doc.file_name}</div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{doc.document_type}</TableCell>
                        <TableCell>
                          <DocumentStatusBadge endDate={doc.end_date} />
                        </TableCell>
                        <TableCell>{format(new Date(doc.created_at), "dd/MM/yyyy")}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Button variant="outline" size="sm">
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button variant="outline" size="sm">
                              <Download className="h-4 w-4" />
                            </Button>
                            <Button variant="outline" size="sm">
                              <Edit className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No documents found for this customer
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <AddPaymentDialog
        open={paymentDialogOpen}
        onOpenChange={setPaymentDialogOpen}
        customer_id={id}
      />
      
      <AddFineDialog
        open={fineDialogOpen}
        onOpenChange={setFineDialogOpen}
      />
      
      <CustomerFormModal
        open={editCustomerOpen}
        onOpenChange={setEditCustomerOpen}
        customer={customer}
      />
      
      <AddCustomerDocumentDialog
        open={documentDialogOpen}
        onOpenChange={setDocumentDialogOpen}
        customerId={id!}
      />
    </div>
  );
};

export default CustomerDetail;