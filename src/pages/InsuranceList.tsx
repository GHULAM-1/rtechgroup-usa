import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { InsurancePolicyStatusChip } from "@/components/InsurancePolicyStatusChip";
import { type InsurancePolicyStatus } from "@/lib/insuranceUtils";
import { Badge } from "@/components/ui/badge";
import { Search, FileText, Users, Shield } from "lucide-react";
import { Link } from "react-router-dom";
import { format } from "date-fns";

interface InsurancePolicy {
  id: string;
  policy_number: string;
  provider: string;
  start_date: string;
  expiry_date: string;
  status: InsurancePolicyStatus;
  notes: string;
  customer_id: string;
  vehicle_id: string;
  customers: {
    name: string;
  };
  vehicles: {
    reg: string;
    make: string;
    model: string;
  } | null;
  document_count?: number;
}

export default function InsuranceList() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const { data: policies = [], isLoading } = useQuery({
    queryKey: ["insurance-policies"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("insurance_policies")
        .select(`
          *,
          customers!inner(name),
          vehicles(reg, make, model),
          insurance_documents(id)
        `)
        .order("expiry_date", { ascending: true });

      if (error) throw error;

      return (data || []).map(policy => ({
        ...policy,
        document_count: policy.insurance_documents?.length || 0
      }));
    },
  });

  const filteredPolicies = policies.filter((policy) => {
    const matchesSearch = 
      policy.policy_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      policy.provider?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      policy.customers.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      policy.vehicles?.reg.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === "all" || policy.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  // Calculate summary stats
  const stats = {
    total: policies.length,
    active: policies.filter(p => p.status === "Active").length,
    expiringSoon: policies.filter(p => {
      const daysUntil = Math.ceil((new Date(p.expiry_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
      return p.status === "Active" && daysUntil <= 30 && daysUntil >= 0;
    }).length,
    expired: policies.filter(p => {
      const isExpired = new Date(p.expiry_date) < new Date();
      return p.status === "Active" && isExpired;
    }).length,
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Insurance Management</h1>
          <p className="text-muted-foreground">
            Manage customer insurance policies and compliance
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Policies</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active</CardTitle>
            <Badge variant="default" className="text-xs">OK</Badge>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.active}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Expiring Soon</CardTitle>
            <Badge variant="secondary" className="text-xs">30d</Badge>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">{stats.expiringSoon}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Expired</CardTitle>
            <Badge variant="destructive" className="text-xs">!</Badge>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.expired}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Insurance Policies</CardTitle>
          <CardDescription>
            All customer insurance policies with expiry tracking
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 mb-6">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Search by policy number, provider, customer, or vehicle..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="Active">Active</SelectItem>
                <SelectItem value="Expired">Expired</SelectItem>
                <SelectItem value="Suspended">Suspended</SelectItem>
                <SelectItem value="Cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Policies Table */}
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead>Vehicle</TableHead>
                  <TableHead>Policy Number</TableHead>
                  <TableHead>Provider</TableHead>
                  <TableHead>Start Date</TableHead>
                  <TableHead>Expiry Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Docs</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8">
                      Loading policies...
                    </TableCell>
                  </TableRow>
                ) : filteredPolicies.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8">
                      {searchTerm || statusFilter !== "all" 
                        ? "No policies match your filters" 
                        : "No insurance policies found"}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredPolicies.map((policy) => (
                    <TableRow key={policy.id}>
                      <TableCell>
                        <Link 
                          to={`/customers/${policy.customer_id}`}
                          className="font-medium text-primary hover:underline"
                        >
                          {policy.customers.name}
                        </Link>
                      </TableCell>
                      <TableCell>
                        {policy.vehicles ? (
                          <div className="text-sm">
                            <div className="font-medium">{policy.vehicles.reg}</div>
                            <div className="text-muted-foreground">
                              {policy.vehicles.make} {policy.vehicles.model}
                            </div>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">No vehicle</span>
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {policy.policy_number}
                      </TableCell>
                      <TableCell>{policy.provider || "—"}</TableCell>
                      <TableCell>
                        {format(new Date(policy.start_date), "MMM d, yyyy")}
                      </TableCell>
                      <TableCell>
                        {format(new Date(policy.expiry_date), "MMM d, yyyy")}
                      </TableCell>
                      <TableCell>
                        <InsurancePolicyStatusChip 
                          status={policy.status as InsurancePolicyStatus}
                          expiryDate={policy.expiry_date}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">{policy.document_count}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Button asChild variant="ghost" size="sm">
                          <Link to={`/customers/${policy.customer_id}?tab=insurance`}>
                            View
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}