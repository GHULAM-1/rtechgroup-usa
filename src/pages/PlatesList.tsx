import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Plus, Search, Download, Car, FileText } from "lucide-react";
import { AddPlateDialog } from "@/components/AddPlateDialog";
import { AssignPlateDialog } from "@/components/AssignPlateDialog";
import { useToast } from "@/hooks/use-toast";

interface Plate {
  id: string;
  plate_number: string;
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
  const [searchTerm, setSearchTerm] = useState("");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const [selectedPlate, setSelectedPlate] = useState<Plate | null>(null);

  const { data: plates, isLoading, refetch } = useQuery({
    queryKey: ["plates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("plates")
        .select(`
          *,
          vehicles(id, reg, make, model)
        `)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data as Plate[];
    },
  });

  const filteredPlates = plates?.filter(plate =>
    plate.plate_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
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

      refetch();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to unassign plate",
        variant: "destructive",
      });
    }
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

    const csvHeaders = ["Plate Number", "Retention Doc Reference", "Assigned Vehicle", "Notes", "Created Date"];
    const csvData = plates.map(plate => [
      plate.plate_number,
      plate.retention_doc_reference || "",
      plate.vehicles ? `${plate.vehicles.reg} (${plate.vehicles.make} ${plate.vehicles.model})` : "Not Assigned",
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
          <h1 className="text-3xl font-bold">Plates Management</h1>
          <p className="text-muted-foreground">Manage license plates and vehicle assignments</p>
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
            placeholder="Search by plate number, retention doc, or assigned vehicle..."
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
                    <TableHead>Retention Doc Reference</TableHead>
                    <TableHead>Assigned Vehicle</TableHead>
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
                      <TableCell>{plate.retention_doc_reference || "—"}</TableCell>
                      <TableCell>
                        {plate.vehicles ? (
                          <div className="flex items-center gap-1">
                            <Car className="h-3 w-3 text-muted-foreground" />
                            <span className="text-sm">
                              {plate.vehicles.reg} ({plate.vehicles.make} {plate.vehicles.model})
                            </span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">Not Assigned</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={plate.assigned_vehicle_id ? "default" : "secondary"}>
                          {plate.assigned_vehicle_id ? "Assigned" : "Available"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground">
                          {plate.notes ? (plate.notes.length > 50 ? plate.notes.substring(0, 50) + "..." : plate.notes) : "—"}
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
        onSuccess={() => refetch()}
      />

      <AssignPlateDialog
        open={showAssignDialog}
        onOpenChange={setShowAssignDialog}
        plate={selectedPlate}
        onSuccess={() => {
          refetch();
          setSelectedPlate(null);
        }}
      />
    </div>
  );
};

export default PlatesList;