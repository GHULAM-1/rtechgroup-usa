import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface VehicleFile {
  id: string;
  vehicle_id: string;
  file_name: string;
  storage_path: string;
  content_type?: string;
  size_bytes?: number;
  uploaded_by?: string;
  uploaded_at: string;
  created_at: string;
}

export function useVehicleFiles(vehicleId: string) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Fetch files for a vehicle
  const { data: files = [], isLoading } = useQuery({
    queryKey: ['vehicleFiles', vehicleId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vehicle_files')
        .select('*')
        .eq('vehicle_id', vehicleId)
        .order('uploaded_at', { ascending: false });

      if (error) throw error;
      return data as VehicleFile[];
    },
    enabled: !!vehicleId,
  });

  // Upload file mutation
  const uploadFileMutation = useMutation({
    mutationFn: async (file: File) => {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `vehicle/${vehicleId}/${fileName}`;

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from('vehicle-files')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Save file metadata to database
      const { data, error: dbError } = await supabase
        .from('vehicle_files')
        .insert({
          vehicle_id: vehicleId,
          file_name: file.name,
          storage_path: filePath,
          content_type: file.type,
          size_bytes: file.size,
        })
        .select()
        .single();

      if (dbError) {
        // Clean up storage if database insert fails
        await supabase.storage.from('vehicle-files').remove([filePath]);
        throw dbError;
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vehicleFiles', vehicleId] });
      toast({
        title: "File Uploaded",
        description: "File has been uploaded successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Upload Error",
        description: error.message || "Failed to upload file",
        variant: "destructive",
      });
    },
  });

  // Delete file mutation
  const deleteFileMutation = useMutation({
    mutationFn: async (file: VehicleFile) => {
      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from('vehicle-files')
        .remove([file.storage_path]);

      if (storageError) throw storageError;

      // Delete from database
      const { error: dbError } = await supabase
        .from('vehicle_files')
        .delete()
        .eq('id', file.id);

      if (dbError) throw dbError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vehicleFiles', vehicleId] });
      toast({
        title: "File Deleted",
        description: "File has been deleted successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Delete Error",
        description: error.message || "Failed to delete file",
        variant: "destructive",
      });
    },
  });

  // Download file function
  const downloadFile = async (file: VehicleFile) => {
    try {
      const { data, error } = await supabase.storage
        .from('vehicle-files')
        .download(file.storage_path);

      if (error) throw error;

      // Create download link
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.file_name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error: any) {
      toast({
        title: "Download Error",
        description: error.message || "Failed to download file",
        variant: "destructive",
      });
    }
  };

  return {
    files,
    isLoading,
    uploadFile: uploadFileMutation.mutate,
    deleteFile: deleteFileMutation.mutate,
    downloadFile,
    isUploading: uploadFileMutation.isPending,
    isDeleting: deleteFileMutation.isPending,
  };
}