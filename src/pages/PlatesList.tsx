import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CreditCard, Plus, Car, Download, FileUp, Unlink, Link } from "lucide-react";
import { AddPlateDialog } from "@/components/AddPlateDialog";
import { AssignPlateDialog } from "@/components/AssignPlateDialog";

interface Plate {
  id: string;
  plate_number: string;
  retention_doc_reference?: string;
  assigned_vehicle_id?: string;
  notes?: string;
  document_url?: string;
  document_name?: string;
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
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [assignPlateId, setAssignPlateId] = useState<string | null>(null);

  const { data: plates, isLoading } = useQuery({
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

  const handleUnassignPlate = async (plateId: string) => {
    try {
      const { error } = await supabase
        .from("plates")
        .update({ assigned_vehicle_id: null })
        .eq("id", plateId);

      if (error) throw error;
      
      // Refresh the data
      window.location.reload();
    } catch (error) {
      console.error("Error unassigning plate:", error);
    }
  };

  const handleExportCSV = () => {
    if (!plates || plates.length === 0) return;

    const headers = ["Plate Number", "Retention Doc Reference", "Assigned Vehicle", "Notes", "Created Date"];
    const csvData = [
      headers.join(","),
      ...plates.map(plate => [
        `"${plate.plate_number}"`,
        `"${plate.retention_doc_reference || ''}"`,
        `"${plate.vehicles ? `${plate.vehicles.reg} (${plate.vehicles.make} ${plate.vehicles.model})` : 'Unassigned'}"`,
        `"${plate.notes || ''}"`,
        `"${new Date(plate.created_at).toLocaleDateString()}"`
      ].join(","))
    ].join("\n");

    const blob = new Blob([csvData], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `plates-export-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (isLoading) {
    return <div>Loading plates...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">License Plates</h1>
          <p className="text-muted-foreground">Manage license plates and vehicle assignments</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExportCSV} disabled={!plates || plates.length === 0}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
          <Button onClick={() => setShowAddDialog(true)} className="bg-gradient-primary">
            <Plus className="h-4 w-4 mr-2" />
            Add Plate
          </Button>
        </div>
      </div>

      {/* Plates Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-primary" />
            License Plate Database
          </CardTitle>
          <CardDescription>
            View all license plates with retention documents and vehicle assignments
          </CardDescription>
        </CardHeader>
        <CardContent>
          {plates && plates.length > 0 ? (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Plate Number</TableHead>
                    <TableHead>Retention Doc Reference</TableHead>
                    <TableHead>Assigned Vehicle</TableHead>
                    <TableHead>Notes</TableHead>
                    <TableHead>Document</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {plates.map((plate) => (
                    <TableRow key={plate.id} className="hover:bg-muted/50">
                      <TableCell className="font-medium font-mono text-lg">
                        {plate.plate_number}
                      </TableCell>
                      <TableCell>
                        {plate.retention_doc_reference ? (
                          <Badge variant="outline">{plate.retention_doc_reference}</Badge>
                        ) : (
                          <span className="text-muted-foreground">No reference</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {plate.vehicles ? (
                          <div className="flex items-center gap-2">
                            <Car className="h-4 w-4 text-primary" />
                            <span>{plate.vehicles.reg}</span>
                            <span className="text-muted-foreground">
                              ({plate.vehicles.make} {plate.vehicles.model})
                            </span>
                          </div>
                        ) : (
                          <Badge variant="secondary">Unassigned</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground">
                          {plate.notes || 'No notes'}
                        </span>
                      </TableCell>
                      <TableCell>
                        {plate.document_url ? (
                          <div className="flex items-center gap-2">
                            <FileUp className="h-4 w-4 text-primary" />
                            <span className="text-sm">{plate.document_name}</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-sm">No document</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-1 justify-end">
                          {plate.assigned_vehicle_id ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleUnassignPlate(plate.id)}
                            >
                              <Unlink className="h-4 w-4 mr-1" />
                              Unassign
                            </Button>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setAssignPlateId(plate.id)}
                            >
                              <Link className="h-4 w-4 mr-1" />
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
              <CreditCard className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No plates found</h3>
              <p className="text-muted-foreground mb-4">Add your first license plate to get started</p>
              <Button onClick={() => setShowAddDialog(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Plate
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <AddPlateDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
      />

      {assignPlateId && (
        <AssignPlateDialog
          open={!!assignPlateId}
          onOpenChange={() => setAssignPlateId(null)}
          plateId={assignPlateId}
        />
      )}
    </div>
  );
};

export default PlatesList;