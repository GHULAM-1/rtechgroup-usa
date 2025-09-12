import React from 'react';
import { LucideIcon } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface ReportCardProps {
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
  value: string;
  subtitle: string;
  metadata?: string;
  onClick: () => void;
}

export const ReportCard: React.FC<ReportCardProps> = ({
  title,
  description,
  icon: Icon,
  value,
  subtitle,
  metadata,
  onClick
}) => {
  return (
    <Card
      className="cursor-pointer transition-all hover:shadow-md hover:scale-[1.02] active:scale-[0.98]"
      onClick={onClick}
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
        {metadata && (
          <Badge variant="secondary" className="mt-2 text-xs">
            {metadata}
          </Badge>
        )}
        <CardDescription className="mt-2 text-xs">
          {description}
        </CardDescription>
      </CardContent>
    </Card>
  );
};