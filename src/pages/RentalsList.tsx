import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FileText, Plus, Eye, Filter } from "lucide-react";

interface Rental {
  id: string;
  start_date: string;
  end_date: string;
  monthly_amount: number;
  status: string;
  customers: { name: string };
  vehicles: { reg: string; make: string; model: string };
}

const RentalsList = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const filter = searchParams.get('filter');

  const { data: rentals, isLoading } = useQuery({
    queryKey: ["rentals-list", filter],
    queryFn: async () => {
      let query = supabase
        .from("rentals")
        .select(`
          *,
          customers(name),
          vehicles(reg, make, model)
        `)
        .order("created_at", { ascending: false });

      // Apply filters
      if (filter === 'active') {
        query = query.eq('status', 'Active');
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Rental[];
    },
  });

  if (isLoading) {
    return <div>Loading rentals...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Rentals</h1>
          <p className="text-muted-foreground">
            Manage rental agreements and contracts
            {filter && ` - ${filter.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}`}
          </p>
        </div>
        <div className="flex gap-2">
          {filter && (
            <Button variant="outline" onClick={() => navigate("/rentals")}>
              <Filter className="h-4 w-4 mr-2" />
              Clear Filter
            </Button>
          )}
          <Button 
            onClick={() => navigate("/rentals/new")}
            className="bg-gradient-primary"
          >
            <Plus className="h-4 w-4 mr-2" />
            New Rental
          </Button>
        </div>
      </div>

      {/* Rentals Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Rental Agreements
          </CardTitle>
          <CardDescription>
            View and manage all rental contracts
          </CardDescription>
        </CardHeader>
        <CardContent>
          {rentals && rentals.length > 0 ? (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Customer</TableHead>
                    <TableHead>Vehicle</TableHead>
                    <TableHead>Start Date</TableHead>
                    <TableHead>End Date</TableHead>
                    <TableHead className="text-right">Monthly Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rentals.map((rental) => (
                    <TableRow key={rental.id} className="hover:bg-muted/50">
                      <TableCell className="font-medium">{rental.customers?.name}</TableCell>
                      <TableCell>
                        {rental.vehicles?.reg} ({rental.vehicles?.make} {rental.vehicles?.model})
                      </TableCell>
                      <TableCell>{new Date(rental.start_date).toLocaleDateString()}</TableCell>
                      <TableCell>{new Date(rental.end_date).toLocaleDateString()}</TableCell>
                      <TableCell className="text-right">
                        £{Number(rental.monthly_amount).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <Badge variant={rental.status === 'Active' ? 'default' : 'secondary'}>
                          {rental.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
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
            </div>
          ) : (
            <div className="text-center py-8">
              <FileText className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No rentals found</h3>
              <p className="text-muted-foreground mb-4">
                {filter ? "No rentals match the current filter" : "No rental agreements yet"}
              </p>
              <Button onClick={() => navigate("/rentals/new")}>
                <Plus className="h-4 w-4 mr-2" />
                Create New Rental
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default RentalsList;