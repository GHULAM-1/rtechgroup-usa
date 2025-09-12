import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Car } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

interface VehicleFormData {
  reg_number: string;
  make: string;
  model: string;
  colour: string;
  acquisition_type: "purchase" | "finance" | "lease";
  acquisition_price: string;
  acquisition_date: string;
  dealer_source: string;
}

export const AddVehicleDialog = () => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [formData, setFormData] = useState<VehicleFormData>({
    reg_number: "",
    make: "",
    model: "",
    colour: "",
    acquisition_type: "purchase",
    acquisition_price: "",
    acquisition_date: "",
    dealer_source: ""
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase
        .from("vehicles")
        .insert({
          reg_number: formData.reg_number,
          make: formData.make,
          model: formData.model,
          colour: formData.colour,
          acquisition_type: formData.acquisition_type,
          acquisition_price: parseFloat(formData.acquisition_price),
          acquisition_date: formData.acquisition_date,
          dealer_source: formData.dealer_source || null,
          status: "available"
        });

      if (error) throw error;

      toast({
        title: "Vehicle Added",
        description: `${formData.make} ${formData.model} (${formData.reg_number}) has been added to your fleet.`,
      });

      // Reset form and close dialog
      setFormData({
        reg_number: "",
        make: "",
        model: "",
        colour: "",
        acquisition_type: "purchase",
        acquisition_price: "",
        acquisition_date: "",
        dealer_source: ""
      });
      setOpen(false);
      
      // Refresh the vehicles list
      queryClient.invalidateQueries({ queryKey: ["vehicles"] });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to add vehicle. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-gradient-primary text-primary-foreground hover:opacity-90 transition-all duration-200 rounded-lg focus:ring-2 focus:ring-primary">
          <Plus className="mr-2 h-4 w-4" />
          Add Vehicle
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Car className="h-5 w-5 text-primary" />
            Add New Vehicle
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="reg_number">Registration Number</Label>
              <Input
                id="reg_number"
                value={formData.reg_number}
                onChange={(e) => setFormData(prev => ({ ...prev, reg_number: e.target.value }))}
                placeholder="AB12 CDE"
                className="input-focus"
                required
              />
            </div>
            <div>
              <Label htmlFor="acquisition_date">Acquisition Date</Label>
              <Input
                id="acquisition_date"
                type="date"
                value={formData.acquisition_date}
                onChange={(e) => setFormData(prev => ({ ...prev, acquisition_date: e.target.value }))}
                className="input-focus"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="make">Make</Label>
              <Input
                id="make"
                value={formData.make}
                onChange={(e) => setFormData(prev => ({ ...prev, make: e.target.value }))}
                placeholder="Audi"
                className="input-focus"
                required
              />
            </div>
            <div>
              <Label htmlFor="model">Model</Label>
              <Input
                id="model"
                value={formData.model}
                onChange={(e) => setFormData(prev => ({ ...prev, model: e.target.value }))}
                placeholder="A4"
                className="input-focus"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="colour">Colour</Label>
              <Input
                id="colour"
                value={formData.colour}
                onChange={(e) => setFormData(prev => ({ ...prev, colour: e.target.value }))}
                placeholder="Black"
                className="input-focus"
                required
              />
            </div>
            <div>
              <Label htmlFor="acquisition_type">Acquisition Type</Label>
              <Select
                value={formData.acquisition_type}
                onValueChange={(value) => setFormData(prev => ({ ...prev, acquisition_type: value as any }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="purchase">Purchase</SelectItem>
                  <SelectItem value="finance">Finance</SelectItem>
                  <SelectItem value="lease">Lease</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="acquisition_price">Acquisition Price (£)</Label>
              <Input
                id="acquisition_price"
                type="number"
                step="0.01"
                min="0"
                value={formData.acquisition_price}
                onChange={(e) => setFormData(prev => ({ ...prev, acquisition_price: e.target.value }))}
                placeholder="25000.00"
                className="input-focus"
                required
              />
            </div>
            <div>
              <Label htmlFor="dealer_source">Dealer Source (Optional)</Label>
              <Input
                id="dealer_source"
                value={formData.dealer_source}
                onChange={(e) => setFormData(prev => ({ ...prev, dealer_source: e.target.value }))}
                placeholder="Premium Motors Ltd"
                className="input-focus"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading} className="bg-gradient-primary rounded-lg transition-all duration-200 focus:ring-2 focus:ring-primary">
              {loading ? "Adding..." : "Add Vehicle"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};