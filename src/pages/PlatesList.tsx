import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Plus, Search, Download, Car, FileText } from "lucide-react";
import { format } from "date-fns";
import { AddPlateDialog } from "@/components/AddPlateDialog";
import { AssignPlateDialog } from "@/components/AssignPlateDialog";
import { useToast } from "@/hooks/use-toast";

interface Plate {
  id: string;
  plate_number: string;
  vehicle_id: string;
  supplier: string;
  order_date: string;
  cost: number;
  status: string;
  retention_doc_reference: string;
  assigned_vehicle_id: string;
  notes: string;
  document_url: string;
  document_name: string;
  created_at: string;
  vehicles?: {
    id: string;
    reg: string;
    make: string;
    model: string;
  };
}

const PlatesList = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const vehicleFilter = searchParams.get("vehicle_id");
  const [searchTerm, setSearchTerm] = useState("");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const [selectedPlate, setSelectedPlate] = useState<Plate | null>(null);

  const { data: plates, isLoading, refetch } = useQuery({
    queryKey: ["plates", vehicleFilter],
    queryFn: async () => {
      console.log("Fetching plates...");
      let query = supabase
        .from("plates")
        .select(`
          *,
          vehicles!plates_vehicle_id_fkey(id, reg, make, model)
        `);
      
      // Apply vehicle filter if provided
      if (vehicleFilter) {
        query = query.eq("vehicle_id", vehicleFilter);
      }
      
      const { data, error } = await query.order("created_at", { ascending: false });
      
      if (error) {
        console.error("Error fetching plates:", error);
        throw error;
      }
      console.log("Fetched plates:", data?.length, "plates");
      return (data || []) as any[];
    },
    staleTime: 0, // Always refetch when component mounts
    gcTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  // Set up real-time subscriptions
  useEffect(() => {
    console.log("Setting up real-time subscription for plates");
    const channel = supabase
      .channel('plates-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'plates'
        },
        (payload) => {
          console.log('Real-time update received:', payload);
          // Invalidate and refetch plates data
          queryClient.invalidateQueries({ queryKey: ["plates"] });
        }
      )
      .subscribe();

    return () => {
      console.log("Cleaning up real-time subscription");
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const filteredPlates = plates?.filter(plate =>
    plate.plate_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
    plate.supplier?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    plate.retention_doc_reference?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    plate.vehicles?.reg?.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  const handleAssignPlate = (plate: Plate) => {
    setSelectedPlate(plate);
    setShowAssignDialog(true);
  };

  const handleUnassignPlate = async (plateId: string) => {
    try {
      const { error } = await supabase
        .from("plates")
        .update({ assigned_vehicle_id: null })
        .eq("id", plateId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Plate unassigned successfully",
      });

      // Invalidate all plates queries to ensure fresh data
      queryClient.invalidateQueries({ queryKey: ["plates"] });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to unassign plate",
        variant: "destructive",
      });
    }
  };

  const handlePlateSuccess = () => {
    console.log("Plate operation successful, invalidating queries");
    // Invalidate all plates queries to ensure fresh data
    queryClient.invalidateQueries({ queryKey: ["plates"] });
  };

  const handleExportCSV = () => {
    if (!plates || plates.length === 0) {
      toast({
        title: "No data",
        description: "No plates to export",
        variant: "destructive",
      });
      return;
    }

    const csvHeaders = ["Plate Number", "Vehicle", "Supplier", "Order Date", "Cost", "Status", "Retention Doc", "Notes", "Created Date"];
    const csvData = plates.map(plate => [
      plate.plate_number,
      plate.vehicles ? `${plate.vehicles.reg} (${plate.vehicles.make} ${plate.vehicles.model})` : "Not Assigned",
      plate.supplier || "",
      plate.order_date ? new Date(plate.order_date).toLocaleDateString() : "",
      plate.cost || "0",
      plate.status || "",
      plate.retention_doc_reference || "",
      plate.notes || "",
      new Date(plate.created_at).toLocaleDateString()
    ]);

    const csvContent = [csvHeaders, ...csvData]
      .map(row => row.map(field => `"${field}"`).join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `plates_export_${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
    window.URL.revokeObjectURL(url);

    toast({
      title: "Success",
      description: "Plates exported to CSV successfully",
    });
  };

  if (isLoading) {
    return <div>Loading plates...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">
            {vehicleFilter ? `Plates for Vehicle` : "Plates Management"}
          </h1>
          <p className="text-muted-foreground">
            {vehicleFilter 
              ? "Plates assigned to the selected vehicle"
              : "Manage license plates and vehicle assignments"
            }
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExportCSV}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
          <Button onClick={() => setShowAddDialog(true)} className="bg-gradient-primary">
            <Plus className="h-4 w-4 mr-2" />
            Add Plate
          </Button>
        </div>
      </div>

      {/* Search */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5 text-primary" />
            Search Plates
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Input
            placeholder="Search by plate number, supplier, retention doc, or vehicle..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="max-w-md"
          />
        </CardContent>
      </Card>

      {/* Plates Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Plates Database
          </CardTitle>
          <CardDescription>
            All registered plates with assignment status and documentation
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredPlates.length > 0 ? (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Plate Number</TableHead>
                    <TableHead>Vehicle</TableHead>
                    <TableHead>Supplier</TableHead>
                    <TableHead>Order Date</TableHead>
                    <TableHead>Cost</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Notes</TableHead>
                    <TableHead>Document</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPlates.map((plate) => (
                    <TableRow key={plate.id} className="hover:bg-muted/50">
                      <TableCell className="font-medium">{plate.plate_number}</TableCell>
                      <TableCell>
                        {plate.vehicles ? (
                          <div className="flex items-center gap-1">
                            <Car className="h-3 w-3 text-muted-foreground" />
                            <button
                              onClick={() => navigate(`/vehicles/${plate.vehicles?.id}`)}
                              className="text-sm text-primary hover:underline"
                            >
                              {plate.vehicles.reg} ({plate.vehicles.make} {plate.vehicles.model})
                            </button>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">Not Assigned</span>
                        )}
                      </TableCell>
                      <TableCell>{plate.supplier || "—"}</TableCell>
                      <TableCell>
                        {plate.order_date ? format(new Date(plate.order_date), "dd/MM/yyyy") : "—"}
                      </TableCell>
                      <TableCell>
                        {plate.cost > 0 ? `$${Number(plate.cost).toLocaleString()}` : "—"}
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant="secondary"
                          className={
                            plate.status === 'ordered' ? 'bg-muted text-muted-foreground' :
                            plate.status === 'received' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300' :
                            plate.status === 'fitted' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300' :
                            'bg-muted text-muted-foreground'
                          }
                        >
                          {plate.status ? (plate.status.charAt(0).toUpperCase() + plate.status.slice(1)) : "Unknown"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground">
                          {plate.notes ? (plate.notes.length > 30 ? plate.notes.substring(0, 30) + "..." : plate.notes) : "—"}
                        </span>
                      </TableCell>
                      <TableCell>
                        {plate.document_url ? (
                          <Button variant="outline" size="sm">
                            <FileText className="h-3 w-3 mr-1" />
                            View
                          </Button>
                        ) : (
                          <span className="text-muted-foreground text-sm">None</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          {plate.assigned_vehicle_id ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleUnassignPlate(plate.id)}
                            >
                              Unassign
                            </Button>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleAssignPlate(plate)}
                            >
                              Assign
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-8">
              <FileText className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">
                {searchTerm ? "No plates match your search" : "No plates found"}
              </h3>
              <p className="text-muted-foreground mb-4">
                {searchTerm ? "Try adjusting your search terms" : "Add your first plate to get started"}
              </p>
              {!searchTerm && (
                <Button onClick={() => setShowAddDialog(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Plate
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <AddPlateDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        onSuccess={handlePlateSuccess}
        preSelectedVehicleId={vehicleFilter || undefined}
      />

      <AssignPlateDialog
        open={showAssignDialog}
        onOpenChange={setShowAssignDialog}
        plate={selectedPlate}
        onSuccess={() => {
          handlePlateSuccess();
          setSelectedPlate(null);
        }}
      />
    </div>
  );
};

export default PlatesList;