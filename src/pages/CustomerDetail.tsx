import { useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, CreditCard, FileText, Plus, Upload, Car, AlertTriangle, Eye, Download, Edit, Trash2, User, Mail, Phone, CalendarPlus, PoundSterling, FolderOpen, Receipt, CreditCard as PaymentIcon } from "lucide-react";
import { TruncatedCell } from "@/components/TruncatedCell";
import { EmptyState } from "@/components/EmptyState";
import { CustomerBalanceChip } from "@/components/CustomerBalanceChip";
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
    <div className="space-y-8 max-w-7xl mx-auto p-6 pt-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
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
            <PoundSterling className="h-4 w-4 mr-2" />
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
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <Card className="min-h-[140px] flex flex-col">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <User className="h-4 w-4 text-primary" />
              Contact Info
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 space-y-2">
            {customer.email && (
              <div className="flex items-center gap-2 text-sm">
                <Mail className="h-3 w-3 text-muted-foreground" />
                <a href={`mailto:${customer.email}`} className="hover:underline truncate">
                  {customer.email}
                </a>
              </div>
            )}
            {customer.phone && (
              <div className="flex items-center gap-2 text-sm">
                <Phone className="h-3 w-3 text-muted-foreground" />
                <a href={`tel:${customer.phone}`} className="hover:underline">
                  {customer.phone}
                </a>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="min-h-[140px] flex flex-col">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <PoundSterling className="h-4 w-4 text-primary" />
              Account Status
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1">
            {customerBalanceData ? (
              <div className="space-y-3">
                <CustomerBalanceChip 
                  balance={customerBalanceData.balance} 
                  status={customerBalanceData.status} 
                  totalCharges={customerBalanceData.totalCharges}
                  totalPayments={customerBalanceData.totalPayments}
                />
              </div>
            ) : (
              <Badge variant="secondary">Loading...</Badge>
            )}
          </CardContent>
        </Card>

        <Card className="min-h-[140px] flex flex-col">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <Car className="h-4 w-4 text-primary" />
              Active Rentals
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 space-y-2">
            <div className="text-2xl font-bold text-foreground">{activeRentalsCount || 0}</div>
            <p className="text-xs text-muted-foreground">Currently Active</p>
          </CardContent>
        </Card>

        <Card className="min-h-[140px] flex flex-col">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <PaymentIcon className="h-4 w-4 text-primary" />
              Payment Stats
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 space-y-2">
            <div className="text-2xl font-bold text-foreground">{paymentStats?.paymentCount || 0}</div>
            <p className="text-xs text-muted-foreground">Total Payments</p>
            {paymentStats?.totalPayments && paymentStats.totalPayments > 0 && (
              <p className="text-sm font-medium text-muted-foreground">
                £{paymentStats.totalPayments.toLocaleString()}
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="min-h-[140px] flex flex-col">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <AlertTriangle className="h-4 w-4 text-primary" />
              Fine Stats
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 space-y-2">
            <div className="text-2xl font-bold text-foreground">{fineStats?.openFines || 0}</div>
            <p className="text-xs text-muted-foreground">Open Fines</p>
            {fineStats?.openFineAmount && fineStats.openFineAmount > 0 && (
              <p className="text-sm font-medium text-destructive">
                £{fineStats.openFineAmount.toLocaleString()}
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="min-h-[140px] flex flex-col">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <FolderOpen className="h-4 w-4 text-primary" />
              Documents
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 space-y-2">
            <div className="text-2xl font-bold text-foreground">{documents?.length || 0}</div>
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
      <div className="relative">
        <Tabs defaultValue="rentals" className="space-y-4">
          <div className="overflow-x-auto scrollbar-hide">
            <TabsList variant="sticky-evenly-spaced" className="min-w-full">
              <TabsTrigger value="rentals" variant="evenly-spaced" className="min-w-0">
                <Car className="h-4 w-4 mr-1 sm:mr-2" />
                <span className="hidden xs:inline sm:hidden">Rentals</span>
                <span className="xs:hidden sm:inline">Rentals</span>
                <span className="sm:hidden">R</span>
              </TabsTrigger>
              <TabsTrigger value="payments" variant="evenly-spaced" className="min-w-0">
                <PaymentIcon className="h-4 w-4 mr-1 sm:mr-2" />
                <span className="hidden xs:inline sm:hidden">Payments</span>
                <span className="xs:hidden sm:inline">Payments</span>
                <span className="sm:hidden">P</span>
              </TabsTrigger>
              <TabsTrigger value="fines" variant="evenly-spaced" className="min-w-0">
                <AlertTriangle className="h-4 w-4 mr-1 sm:mr-2" />
                <span className="hidden xs:inline sm:hidden">Fines</span>
                <span className="xs:hidden sm:inline">Fines</span>
                <span className="sm:hidden">F</span>
              </TabsTrigger>
              <TabsTrigger value="vehicles" variant="evenly-spaced" className="min-w-0">
                <Car className="h-4 w-4 mr-1 sm:mr-2" />
                <span className="hidden xs:inline sm:hidden">History</span>
                <span className="xs:hidden sm:inline">Vehicle History</span>
                <span className="sm:hidden">H</span>
              </TabsTrigger>
              <TabsTrigger value="documents" variant="evenly-spaced" className="min-w-0">
                <FileText className="h-4 w-4 mr-1 sm:mr-2" />
                <span className="hidden xs:inline sm:hidden">Documents</span>
                <span className="xs:hidden sm:inline">Documents</span>
                <span className="sm:hidden">D</span>
              </TabsTrigger>
            </TabsList>
          </div>

        <TabsContent value="rentals" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Customer Rentals</span>
                <Button onClick={() => navigate(`/rentals/new?customer=${id}`)} size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Rental
                </Button>
              </CardTitle>
              <CardDescription>All rental agreements for this customer</CardDescription>
            </CardHeader>
            <CardContent>
              {rentals && rentals.length > 0 ? (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="font-semibold">Vehicle</TableHead>
                        <TableHead className="font-semibold">Start Date</TableHead>
                        <TableHead className="font-semibold">End Date</TableHead>
                        <TableHead className="font-semibold text-right">Monthly Amount</TableHead>
                        <TableHead className="font-semibold">Status</TableHead>
                        <TableHead className="font-semibold">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rentals.map((rental) => (
                        <TableRow key={rental.id} className="hover:bg-muted/50 transition-colors">
                          <TableCell className="font-medium">
                            <div>
                              <div className="font-semibold text-foreground">{rental.vehicle.reg}</div>
                              <TruncatedCell 
                                content={`${rental.vehicle.make} ${rental.vehicle.model}`}
                                maxLength={25}
                                className="text-sm text-muted-foreground"
                              />
                            </div>
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            {format(new Date(rental.start_date), "dd/MM/yyyy")}
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            {rental.end_date ? format(new Date(rental.end_date), "dd/MM/yyyy") : "Ongoing"}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            £{rental.monthly_amount.toLocaleString()}
                          </TableCell>
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
                              className="hover:bg-primary hover:text-primary-foreground"
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
              ) : (
                <EmptyState
                  icon={Car}
                  title="No rentals found"
                  description="This customer doesn't have any rental agreements yet."
                  actionLabel="Add First Rental"
                  onAction={() => navigate(`/rentals/new?customer=${id}`)}
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payments" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Payment History</span>
                <Button onClick={() => setPaymentDialogOpen(true)} size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Payment
                </Button>
              </CardTitle>
              <CardDescription>All payments made by this customer</CardDescription>
            </CardHeader>
            <CardContent>
              {payments && payments.length > 0 ? (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="font-semibold">Date</TableHead>
                        <TableHead className="font-semibold text-right">Amount</TableHead>
                        <TableHead className="font-semibold">Method</TableHead>
                        <TableHead className="font-semibold">Vehicle</TableHead>
                        <TableHead className="font-semibold">Status</TableHead>
                        <TableHead className="font-semibold text-right">Remaining</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {payments.map((payment) => (
                        <TableRow key={payment.id} className="hover:bg-muted/50 transition-colors">
                          <TableCell className="whitespace-nowrap">
                            {format(new Date(payment.payment_date), "dd/MM/yyyy")}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            £{payment.amount.toLocaleString()}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{payment.method}</Badge>
                          </TableCell>
                          <TableCell>
                            {payment.vehicle?.reg ? (
                              <TruncatedCell 
                                content={payment.vehicle.reg}
                                maxLength={15}
                                className="font-medium"
                              />
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <PaymentStatusBadge 
                              applied={payment.amount - payment.remaining_amount} 
                              amount={payment.amount} 
                            />
                          </TableCell>
                          <TableCell className="text-right">
                            {payment.remaining_amount > 0 ? (
                              <span className="text-orange-600 font-medium">
                                £{payment.remaining_amount.toLocaleString()}
                              </span>
                            ) : (
                              <span className="text-green-600 font-medium">Fully Applied</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <EmptyState
                  icon={Receipt}
                  title="No payments found"
                  description="This customer hasn't made any payments yet."
                  actionLabel="Add First Payment"
                  onAction={() => setPaymentDialogOpen(true)}
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="fines" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Customer Fines</span>
                <Button onClick={() => setFineDialogOpen(true)} size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Upload Fine
                </Button>
              </CardTitle>
              <CardDescription>All fines associated with this customer</CardDescription>
            </CardHeader>
            <CardContent>
              {fines && fines.length > 0 ? (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="font-semibold">Type</TableHead>
                        <TableHead className="font-semibold">Reference</TableHead>
                        <TableHead className="font-semibold">Vehicle</TableHead>
                        <TableHead className="font-semibold text-right">Amount</TableHead>
                        <TableHead className="font-semibold">Issue Date</TableHead>
                        <TableHead className="font-semibold">Due Date</TableHead>
                        <TableHead className="font-semibold">Status</TableHead>
                        <TableHead className="font-semibold">Liability</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {fines.map((fine) => (
                        <TableRow key={fine.id} className="hover:bg-muted/50 transition-colors">
                          <TableCell className="font-medium">{fine.type}</TableCell>
                          <TableCell>
                            {fine.reference_no ? (
                              <TruncatedCell 
                                content={fine.reference_no}
                                maxLength={12}
                                className="font-mono text-sm"
                              />
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div>
                              <div className="font-semibold text-foreground">{fine.vehicle.reg}</div>
                              <TruncatedCell 
                                content={`${fine.vehicle.make} ${fine.vehicle.model}`}
                                maxLength={20}
                                className="text-sm text-muted-foreground"
                              />
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            £{fine.amount.toLocaleString()}
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            {format(new Date(fine.issue_date), "dd/MM/yyyy")}
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            {format(new Date(fine.due_date), "dd/MM/yyyy")}
                          </TableCell>
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
                </div>
              ) : (
                <EmptyState
                  icon={AlertTriangle}
                  title="No fines found"
                  description="This customer doesn't have any fines associated with their account."
                  actionLabel="Upload Fine"
                  onAction={() => setFineDialogOpen(true)}
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="vehicles" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Vehicle History</CardTitle>
              <CardDescription>All vehicles this customer has rented</CardDescription>
            </CardHeader>
            <CardContent>
              {vehicleHistory && vehicleHistory.length > 0 ? (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="font-semibold">Vehicle</TableHead>
                        <TableHead className="font-semibold">Start Date</TableHead>
                        <TableHead className="font-semibold">End Date</TableHead>
                        <TableHead className="font-semibold text-right">Monthly Amount</TableHead>
                        <TableHead className="font-semibold">Status</TableHead>
                        <TableHead className="font-semibold">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {vehicleHistory.map((history) => (
                        <TableRow key={history.rental_id} className="hover:bg-muted/50 transition-colors">
                          <TableCell>
                            <div>
                              <div className="font-semibold text-foreground">{history.vehicle_reg}</div>
                              <TruncatedCell 
                                content={`${history.vehicle_make} ${history.vehicle_model}`}
                                maxLength={25}
                                className="text-sm text-muted-foreground"
                              />
                            </div>
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            {format(new Date(history.start_date), "dd/MM/yyyy")}
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            {history.end_date ? format(new Date(history.end_date), "dd/MM/yyyy") : "Ongoing"}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            £{history.monthly_amount.toLocaleString()}
                          </TableCell>
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
                              className="hover:bg-primary hover:text-primary-foreground"
                            >
                              <Car className="h-4 w-4 mr-1" />
                              View
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <EmptyState
                  icon={Car}
                  title="No vehicle history"
                  description="This customer hasn't rented any vehicles yet."
                  actionLabel="Add First Rental"
                  onAction={() => navigate(`/rentals/new?customer=${id}`)}
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="documents" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Customer Documents</span>
                <Button onClick={() => setDocumentDialogOpen(true)} size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Document
                </Button>
              </CardTitle>
              <CardDescription>All documents uploaded for this customer</CardDescription>
            </CardHeader>
            <CardContent>
              {documents && documents.length > 0 ? (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="font-semibold">Document</TableHead>
                        <TableHead className="font-semibold">Type</TableHead>
                        <TableHead className="font-semibold">Status</TableHead>
                        <TableHead className="font-semibold">Uploaded</TableHead>
                        <TableHead className="font-semibold text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {documents.map((doc) => (
                        <TableRow key={doc.id} className="hover:bg-muted/50 transition-colors">
                          <TableCell>
                            <div>
                              <TruncatedCell 
                                content={doc.document_name}
                                maxLength={30}
                                className="font-semibold text-foreground"
                              />
                              {doc.file_name && (
                                <TruncatedCell 
                                  content={doc.file_name}
                                  maxLength={35}
                                  className="text-sm text-muted-foreground"
                                />
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{doc.document_type}</Badge>
                          </TableCell>
                          <TableCell>
                            <DocumentStatusBadge endDate={doc.end_date} />
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            {format(new Date(doc.created_at), "dd/MM/yyyy")}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center justify-end gap-1">
                              <Button variant="outline" size="sm" className="h-8 w-8 p-0">
                                <Eye className="h-3 w-3" />
                              </Button>
                              <Button variant="outline" size="sm" className="h-8 w-8 p-0">
                                <Download className="h-3 w-3" />
                              </Button>
                              <Button variant="outline" size="sm" className="h-8 w-8 p-0">
                                <Edit className="h-3 w-3" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <EmptyState
                  icon={FileText}
                  title="No documents found"
                  description="This customer doesn't have any documents uploaded yet."
                  actionLabel="Add First Document"
                  onAction={() => setDocumentDialogOpen(true)}
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>
        </Tabs>
      </div>

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