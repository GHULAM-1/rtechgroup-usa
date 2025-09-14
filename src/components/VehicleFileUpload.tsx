import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Upload, X, FileText, Download, Trash2 } from 'lucide-react';
import { VehicleFile } from '@/hooks/useVehicleFiles';
import { format } from 'date-fns';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

interface VehicleFileUploadProps {
  files: VehicleFile[];
  onUpload: (file: File) => void;
  onDelete: (file: VehicleFile) => void;
  onDownload: (file: VehicleFile) => void;
  isUploading?: boolean;
  isDeleting?: boolean;
}

const formatFileSize = (bytes?: number) => {
  if (!bytes) return 'Unknown size';
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export const VehicleFileUpload = ({ 
  files, 
  onUpload, 
  onDelete, 
  onDownload, 
  isUploading, 
  isDeleting 
}: VehicleFileUploadProps) => {
  const [dragActive, setDragActive] = useState(false);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    acceptedFiles.forEach((file) => {
      // Validate file size (25MB max)
      if (file.size > 25 * 1024 * 1024) {
        alert(`File ${file.name} is too large. Maximum size is 25MB.`);
        return;
      }
      onUpload(file);
    });
  }, [onUpload]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    maxSize: 25 * 1024 * 1024, // 25MB
    multiple: true,
  });

  return (
    <div className="space-y-4">
      {/* File Upload Area */}
      <Card 
        {...getRootProps()} 
        className={`border-2 border-dashed p-6 text-center cursor-pointer transition-colors ${
          isDragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50'
        }`}
      >
        <input {...getInputProps()} />
        <Upload className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
        <p className="text-sm text-muted-foreground">
          {isDragActive ? (
            "Drop the files here..."
          ) : (
            <>
              Drag & drop files here, or <span className="text-primary">click to select</span>
              <br />
              <span className="text-xs">Maximum file size: 25MB</span>
            </>
          )}
        </p>
      </Card>

      {/* File List */}
      <div className="space-y-2">
        {files.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No files uploaded yet
          </p>
        ) : (
          files.map((file) => (
            <Card key={file.id} className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <FileText className="h-5 w-5 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">
                      {file.file_name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatFileSize(file.size_bytes)} • Uploaded {format(new Date(file.uploaded_at), "MMM d, yyyy")}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onDownload(file)}
                    className="h-8 w-8 p-0"
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                        disabled={isDeleting}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete File</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to delete "{file.file_name}"? This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => onDelete(file)}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>

      {isUploading && (
        <p className="text-sm text-muted-foreground text-center">
          Uploading file...
        </p>
      )}
    </div>
  );
};