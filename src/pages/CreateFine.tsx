import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { ArrowLeft, AlertTriangle, Save, Upload } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const fineSchema = z.object({
  type: z.enum(["PCN", "Speeding", "Other"]),
  vehicle_id: z.string().min(1, "Vehicle is required"),
  customer_id: z.string().min(1, "Customer is required"),
  reference_no: z.string().optional(),
  issue_date: z.date(),
  due_date: z.date(),
  amount: z.number().min(0.01, "Amount must be greater than 0"),
  liability: z.enum(["Customer", "Business"]),
  notes: z.string().optional(),
});

type FineFormData = z.infer<typeof fineSchema>;

const CreateFine = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [evidenceFiles, setEvidenceFiles] = useState<File[]>([]);

  const form = useForm<FineFormData>({
    resolver: zodResolver(fineSchema),
    defaultValues: {
      type: "PCN",
      vehicle_id: "",
      customer_id: "",
      reference_no: "",
      issue_date: new Date(),
      due_date: new Date(new Date().getTime() + 28 * 24 * 60 * 60 * 1000), // 28 days from now
      amount: 0,
      liability: "Customer",
      notes: "",
    },
  });

  // Fetch active rentals for customer-vehicle sync
  const { data: activeRentals } = useQuery({
    queryKey: ["active-rentals"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rentals")
        .select(`
          id,
          customer_id,
          vehicle_id,
          customers!inner(id, name),
          vehicles!inner(id, reg, make, model)
        `)
        .eq("status", "Active")
        .order("customers(name)");

      if (error) throw error;

      return data.map(rental => ({
        rental_id: rental.id,
        customer_id: rental.customer_id,
        customer_name: (rental.customers as any).name,
        vehicle_id: rental.vehicle_id,
        vehicle_reg: (rental.vehicles as any).reg,
        vehicle_make: (rental.vehicles as any).make,
        vehicle_model: (rental.vehicles as any).model,
      }));
    },
  });

  const selectedCustomerId = form.watch("customer_id");
  const selectedVehicleId = form.watch("vehicle_id");

  // Get unique customers from active rentals
  const customers = activeRentals?.reduce((acc, rental) => {
    if (!acc.find(c => c.id === rental.customer_id)) {
      acc.push({
        id: rental.customer_id,
        name: rental.customer_name,
      });
    }
    return acc;
  }, [] as Array<{ id: string; name: string }>);

  // Get vehicles filtered by selected customer
  const availableVehicles = selectedCustomerId
    ? activeRentals?.filter(rental => rental.customer_id === selectedCustomerId)
    : activeRentals;

  // Handle customer selection - auto-select vehicle if only one option
  const handleCustomerChange = (customerId: string) => {
    form.setValue("customer_id", customerId);
    const customerVehicles = activeRentals?.filter(rental => rental.customer_id === customerId);
    
    if (customerVehicles?.length === 1) {
      form.setValue("vehicle_id", customerVehicles[0].vehicle_id);
    } else {
      form.setValue("vehicle_id", "");
    }
  };

  // Handle vehicle selection - auto-select customer
  const handleVehicleChange = (vehicleId: string) => {
    form.setValue("vehicle_id", vehicleId);
    const rental = activeRentals?.find(rental => rental.vehicle_id === vehicleId);
    
    if (rental) {
      form.setValue("customer_id", rental.customer_id);
    }
  };

  const createFineMutation = useMutation({
    mutationFn: async (data: FineFormData) => {
      // Create fine record - the trigger will handle ledger entries automatically
      const { data: fine, error: fineError } = await supabase
        .from("fines")
        .insert({
          type: data.type,
          vehicle_id: data.vehicle_id,
          customer_id: data.customer_id,
          reference_no: data.reference_no || null,
          issue_date: data.issue_date.toISOString().split('T')[0],
          due_date: data.due_date.toISOString().split('T')[0],
          amount: data.amount,
          liability: data.liability,
          notes: data.notes || null,
          status: "Open",
        })
        .select()
        .single();

      if (fineError) throw fineError;

      // Upload evidence files if any
      if (evidenceFiles.length > 0) {
        for (const file of evidenceFiles) {
          const fileExt = file.name.split('.').pop();
          const fileName = `${fine.id}/${Date.now()}.${fileExt}`;
          
          const { error: uploadError } = await supabase.storage
            .from('fine-evidence')
            .upload(fileName, file);

          if (uploadError) throw uploadError;

          // Create file record
          const { data: { publicUrl } } = supabase.storage
            .from('fine-evidence')
            .getPublicUrl(fileName);

          await supabase
            .from("fine_files")
            .insert({
              fine_id: fine.id,
              file_name: file.name,
              file_url: publicUrl,
            });
        }
      }

      return fine;
    },
    onSuccess: (fine) => {
      toast({
        title: "Fine Created",
        description: `Fine ${fine.reference_no || fine.id.slice(0, 8)} has been created successfully.`,
      });
      queryClient.invalidateQueries({ queryKey: ["fines-list"] });
      navigate(`/fines/${fine.id}`);
    },
    onError: (error) => {
      console.error("Error creating fine:", error);
      toast({
        title: "Error",
        description: "Failed to create fine. Please try again.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = async (data: FineFormData) => {
    setLoading(true);
    try {
      await createFineMutation.mutateAsync(data);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    setEvidenceFiles(prev => [...prev, ...files]);
  };

  const removeFile = (index: number) => {
    setEvidenceFiles(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="outline" onClick={() => navigate("/fines")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Fines
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Add New Fine</h1>
          <p className="text-muted-foreground">Record a new traffic fine or penalty</p>
        </div>
      </div>

      {/* Form */}
      <Card className="max-w-4xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-primary" />
            Fine Details
          </CardTitle>
          <CardDescription>
            Enter the fine information and upload any supporting evidence
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {/* Type and Vehicle */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Fine Type *</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select fine type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="PCN">PCN (Penalty Charge Notice)</SelectItem>
                          <SelectItem value="Speeding">Speeding Violation</SelectItem>
                          <SelectItem value="Other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="vehicle_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Vehicle *</FormLabel>
                      <Select onValueChange={handleVehicleChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select vehicle" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {availableVehicles?.map((rental) => (
                            <SelectItem key={rental.vehicle_id} value={rental.vehicle_id}>
                              {rental.vehicle_reg} ({rental.vehicle_make} {rental.vehicle_model})
                              {!selectedCustomerId && ` - ${rental.customer_name}`}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Customer and Reference */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="customer_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Customer *</FormLabel>
                      <Select onValueChange={handleCustomerChange} value={field.value || ""}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select customer" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {customers?.map((customer) => (
                            <SelectItem key={customer.id} value={customer.id}>
                              {customer.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="reference_no"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Reference Number</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., PCN123456789" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Dates */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="issue_date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Issue Date *</FormLabel>
                      <FormControl>
                        <Input
                          type="date"
                          {...field}
                          value={field.value ? field.value.toISOString().split('T')[0] : ''}
                          onChange={(e) => field.onChange(new Date(e.target.value))}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="due_date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Due Date *</FormLabel>
                      <FormControl>
                        <Input
                          type="date"
                          {...field}
                          value={field.value ? field.value.toISOString().split('T')[0] : ''}
                          onChange={(e) => field.onChange(new Date(e.target.value))}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Amount and Liability */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="amount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Amount (£) *</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="Enter amount"
                          {...field}
                          onChange={(e) => field.onChange(e.target.value === '' ? undefined : parseFloat(e.target.value))}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="liability"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Liability</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="Customer">Customer</SelectItem>
                          <SelectItem value="Business">Business</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Notes */}
              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Additional notes about this fine..."
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Evidence Upload */}
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Evidence Files</label>
                  <div className="mt-2 flex items-center gap-2">
                    <Input
                      type="file"
                      multiple
                      accept="image/*,.pdf,.doc,.docx"
                      onChange={handleFileUpload}
                      className="file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-primary file:text-primary-foreground hover:file:bg-primary/80"
                    />
                    <Upload className="h-4 w-4 text-muted-foreground" />
                  </div>
                </div>

                {evidenceFiles.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">Selected files:</p>
                    {evidenceFiles.map((file, index) => (
                      <div key={index} className="flex items-center justify-between p-2 bg-muted rounded">
                        <span className="text-sm">{file.name}</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeFile(index)}
                        >
                          Remove
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Submit */}
              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={() => navigate("/fines")}>
                  Cancel
                </Button>
                <Button type="submit" disabled={loading} className="bg-gradient-primary">
                  <Save className="h-4 w-4 mr-2" />
                  {loading ? "Creating..." : "Create Fine"}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
};

export default CreateFine;