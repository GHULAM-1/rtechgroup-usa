import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Mail, Phone, Edit, MapPin, User } from "lucide-react";

interface NextOfKinCardProps {
  nokFullName?: string;
  nokRelationship?: string;
  nokPhone?: string;
  nokEmail?: string;
  nokAddress?: string;
  onEdit: () => void;
}

export const NextOfKinCard = ({
  nokFullName,
  nokRelationship,
  nokPhone,
  nokEmail,
  nokAddress,
  onEdit,
}: NextOfKinCardProps) => {
  const hasNextOfKin = nokFullName || nokRelationship || nokPhone || nokEmail || nokAddress;

  if (!hasNextOfKin) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <User className="h-4 w-4" />
            Next of Kin / Emergency Contact
          </CardTitle>
          <Button variant="outline" size="sm" onClick={onEdit}>
            <Edit className="h-4 w-4 mr-1" />
            Add
          </Button>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No emergency contact information on file.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <User className="h-4 w-4" />
          Next of Kin / Emergency Contact
        </CardTitle>
        <Button variant="outline" size="sm" onClick={onEdit}>
          <Edit className="h-4 w-4 mr-1" />
          Edit
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {nokFullName && (
          <div>
            <p className="font-medium">{nokFullName}</p>
            {nokRelationship && (
              <p className="text-sm text-muted-foreground">{nokRelationship}</p>
            )}
          </div>
        )}
        
        <div className="space-y-2">
          {nokPhone && (
            <a
              href={`tel:${nokPhone}`}
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <Phone className="h-4 w-4" />
              {nokPhone}
            </a>
          )}
          
          {nokEmail && (
            <a
              href={`mailto:${nokEmail}`}
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <Mail className="h-4 w-4" />
              {nokEmail}
            </a>
          )}
          
          {nokAddress && (
            <div className="flex items-start gap-2 text-sm text-muted-foreground">
              <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <div className="whitespace-pre-line">{nokAddress}</div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};