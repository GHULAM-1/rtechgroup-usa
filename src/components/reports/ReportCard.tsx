import React from 'react';
import { LucideIcon, Download, FileSpreadsheet, FileText } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ReportCardProps {
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
  value: string;
  subtitle: string;
  metadata?: string;
  onClick: () => void;
  onExport?: (format: 'csv' | 'xlsx' | 'pdf') => void;
}

export const ReportCard: React.FC<ReportCardProps> = ({
  id,
  title,
  description,
  icon: Icon,
  value,
  subtitle,
  metadata,
  onClick,
  onExport
}) => {
  const handleExportClick = (e: React.MouseEvent, format: 'csv' | 'xlsx' | 'pdf') => {
    e.stopPropagation();
    onExport?.(format);
  };

  return (
    <Card
      className={cn(
        "group cursor-pointer transition-all duration-200",
        "hover:shadow-lg hover:shadow-primary/5 hover:scale-[1.02] hover:border-primary/20",
        "active:scale-[0.98] h-full relative overflow-hidden"
      )}
      onClick={onClick}
    >
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
        <div className="flex items-center space-x-2">
          <div className="p-2 rounded-md bg-primary/10">
            <Icon className="h-4 w-4 text-primary" />
          </div>
          <CardTitle className="text-sm font-semibold">{title}</CardTitle>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-3">
        <div>
          <div className="text-2xl font-bold text-foreground">{value}</div>
          <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
        </div>
        
        {metadata && (
          <Badge variant="secondary" className="text-xs">
            {metadata}
          </Badge>
        )}
        
        <CardDescription className="text-xs line-clamp-2">
          {description}
        </CardDescription>
        
        {/* Export Icons - Bottom Right */}
        <div className="absolute bottom-3 right-3 flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 hover:bg-primary/10"
            onClick={(e) => handleExportClick(e, 'csv')}
            title="Export CSV"
          >
            <Download className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 hover:bg-primary/10"
            onClick={(e) => handleExportClick(e, 'xlsx')}
            title="Export XLSX"
          >
            <FileSpreadsheet className="h-3 w-3" />
          </Button>
          {id === 'customer-statements' && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 hover:bg-primary/10"
              onClick={(e) => handleExportClick(e, 'pdf')}
              title="Export PDF"
            >
              <FileText className="h-3 w-3" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};