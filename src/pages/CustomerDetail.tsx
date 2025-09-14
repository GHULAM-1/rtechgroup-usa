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
import AddCustomerDocumentDialog from "@/components/AddCustomerDocumentDialog";
import DocumentStatusBadge from "@/components/DocumentStatusBadge";
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
            <div className="text-2xl font-bold">0</div>
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

      {/* Basic Tabs - simplified for now */}
      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
        </TabsList>
        <TabsContent value="overview">
          <Card>
            <CardHeader>
              <CardTitle>Customer Overview</CardTitle>
            </CardHeader>
            <CardContent>
              <p>Customer details and information will be displayed here.</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default CustomerDetail;