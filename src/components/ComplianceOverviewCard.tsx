import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useReminderStats } from '@/hooks/useReminders';
import { AlertTriangle, Clock, Bell, CheckCircle } from 'lucide-react';
import { Link } from 'react-router-dom';

export function ComplianceOverviewCard() {
  const { data: stats, isLoading } = useReminderStats();

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Fleet Compliance</CardTitle>
          <CardDescription>Overall compliance status</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-3">
            <div className="h-4 bg-muted rounded w-3/4"></div>
            <div className="h-4 bg-muted rounded w-1/2"></div>
            <div className="h-8 bg-muted rounded w-full"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const getStatusColor = () => {
    if ((stats?.critical || 0) > 0) return 'destructive';
    if ((stats?.due || 0) > 0) return 'secondary';
    return 'default';
  };

  const getStatusIcon = () => {
    if ((stats?.critical || 0) > 0) return <AlertTriangle className="h-4 w-4" />;
    if ((stats?.due || 0) > 0) return <Clock className="h-4 w-4" />;
    return <CheckCircle className="h-4 w-4" />;
  };

  const getStatusText = () => {
    if ((stats?.critical || 0) > 0) return 'Critical Issues';
    if ((stats?.due || 0) > 0) return 'Action Required';
    return 'All Clear';
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-sm">Fleet Compliance</CardTitle>
            <CardDescription>Overall compliance status</CardDescription>
          </div>
          <Badge variant={getStatusColor()} className="flex items-center gap-1">
            {getStatusIcon()}
            {getStatusText()}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-2xl font-bold text-destructive">
              {stats?.critical || 0}
            </div>
            <div className="text-xs text-muted-foreground">Critical</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-primary">
              {stats?.due || 0}
            </div>
            <div className="text-xs text-muted-foreground">Due Today</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-muted-foreground">
              {stats?.total || 0}
            </div>
            <div className="text-xs text-muted-foreground">Total Active</div>
          </div>
        </div>
        
        <Button asChild variant="outline" size="sm" className="w-full">
          <Link to="/reminders">
            <Bell className="h-4 w-4 mr-2" />
            View All Reminders
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}