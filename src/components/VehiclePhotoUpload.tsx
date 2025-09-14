import { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Camera, Upload, Trash2, RotateCcw, Car } from "lucide-react";
import { useVehiclePhoto } from "@/hooks/useVehiclePhoto";

interface VehiclePhotoUploadProps {
  vehicleId: string;
  vehicleReg: string;
  currentPhotoUrl?: string;
  onPhotoUpdate?: (photoUrl: string | null) => void;
}

export const VehiclePhotoUpload = ({ 
  vehicleId, 
  vehicleReg, 
  currentPhotoUrl, 
  onPhotoUpdate 
}: VehiclePhotoUploadProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const { 
    replacePhoto, 
    removePhoto, 
    isUploading, 
    isRemoving 
  } = useVehiclePhoto({
    vehicleId,
    vehicleReg,
    onPhotoUpdate,
  });

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const success = await replacePhoto(file, currentPhotoUrl);
    
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleRemovePhoto = async () => {
    if (!currentPhotoUrl) return;
    await removePhoto(currentPhotoUrl);
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Camera className="h-5 w-5 text-primary" />
          Vehicle Photo
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Photo Display */}
        <div className="flex justify-center">
          <div className="relative w-80 h-60 bg-muted/30 rounded-lg border-2 border-dashed border-muted-foreground/20 overflow-hidden">
            {currentPhotoUrl ? (
              <img
                src={currentPhotoUrl}
                alt={`Photo of ${vehicleReg}`}
                className="w-full h-full object-cover"
                onError={(e) => {
                  console.error('Image load error:', e);
                  // Fallback to placeholder if image fails to load
                  e.currentTarget.style.display = 'none';
                }}
              />
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                <Car className="h-16 w-16 mb-4 opacity-30" />
                <p className="text-sm font-medium">No photo uploaded</p>
                <p className="text-xs">Upload a photo of {vehicleReg}</p>
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-center gap-2">
          <Button
            onClick={handleUploadClick}
            disabled={isUploading || isRemoving}
            className="flex items-center gap-2"
          >
            {isUploading ? (
              <RotateCcw className="h-4 w-4 animate-spin" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
            {currentPhotoUrl ? 'Replace Photo' : 'Upload Photo'}
          </Button>

          {currentPhotoUrl && (
            <Button
              variant="outline"
              onClick={handleRemovePhoto}
              disabled={isUploading || isRemoving}
              className="flex items-center gap-2"
            >
              {isRemoving ? (
                <RotateCcw className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
              Remove Photo
            </Button>
          )}
        </div>

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          className="hidden"
        />

        {/* Upload instructions */}
        <div className="text-xs text-muted-foreground text-center space-y-1">
          <p>Supported formats: JPG, PNG, WebP</p>
          <p>Maximum file size: 5MB</p>
        </div>
      </CardContent>
    </Card>
  );
};