import React, { useState } from 'react';
import { useReminders, useReminderStats, useReminderActions, useReminderGeneration, type ReminderFilters } from '@/hooks/useReminders';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { 
  AlertTriangle, 
  Clock, 
  CheckCircle, 
  XCircle, 
  Bell, 
  Calendar,
  Filter,
  Download,
  Play,
  Pause,
  MoreHorizontal
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

const SEVERITY_COLORS = {
  critical: 'destructive',
  warning: 'secondary',
  info: 'outline'
} as const;

const SEVERITY_ICONS = {
  critical: AlertTriangle,
  warning: Clock,
  info: Bell
};

const STATUS_COLORS = {
  pending: 'default',
  sent: 'secondary',
  snoozed: 'outline',
  done: 'default',
  dismissed: 'outline',
  expired: 'outline'
} as const;

export default function RemindersPageEnhanced() {
  const [filters, setFilters] = useState<ReminderFilters>({});
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  
  const { data: reminders = [], isLoading, error } = useReminders(filters);
  const { data: stats } = useReminderStats();
  const { markDone, dismiss, snooze, bulkUpdate, isLoading: isUpdating } = useReminderActions();
  const generateReminders = useReminderGeneration();

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(reminders.map(r => r.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectReminder = (id: string, checked: boolean) => {
    if (checked) {
      setSelectedIds(prev => [...prev, id]);
    } else {
      setSelectedIds(prev => prev.filter(selectedId => selectedId !== id));
    }
  };

  const handleBulkAction = (action: string, snoozeUntil?: string) => {
    if (selectedIds.length === 0) return;
    
    bulkUpdate.mutate({
      ids: selectedIds,
      action,
      snoozeUntil,
      note: `Bulk ${action} operation`
    });
    
    setSelectedIds([]);
  };

  const exportReminders = () => {
    const csv = [
      'ID,Rule Code,Object Type,Object ID,Title,Message,Due On,Remind On,Status,Severity,Snooze Until,Last Sent At,Created At,Updated At',
      ...reminders.map(r => [
        r.id,
        r.rule_code,
        r.object_type,
        r.object_id,
        `"${r.title}"`,
        `"${r.message}"`,
        r.due_on,
        r.remind_on,
        r.status,
        r.severity,
        r.snooze_until || '',
        r.last_sent_at || '',
        r.created_at,
        r.updated_at
      ].join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `reminders_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const getSeverityIcon = (severity: string) => {
    const Icon = SEVERITY_ICONS[severity as keyof typeof SEVERITY_ICONS] || Bell;
    return <Icon className="h-4 w-4" />;
  };

  const getObjectLink = (reminder: any) => {
    const baseClasses = "text-primary hover:underline";
    const objectId = reminder.object_id;
    
    switch (reminder.object_type) {
      case 'Vehicle':
        return <a href={`/vehicles/${objectId}`} className={baseClasses}>{reminder.context?.reg || objectId}</a>;
      case 'Customer':
        return <a href={`/customers/${objectId}`} className={baseClasses}>{reminder.context?.customer_name || objectId}</a>;
      case 'Rental':
        return <a href={`/rentals/${objectId}`} className={baseClasses}>Rental</a>;
      case 'Fine':
        return <a href={`/fines/${objectId}`} className={baseClasses}>{reminder.context?.reference || objectId}</a>;
      default:
        return <span className="text-muted-foreground">{objectId}</span>;
    }
  };

  if (error) {
    return (
      <div className="container mx-auto py-8">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <XCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Error Loading Reminders</h3>
              <p className="text-muted-foreground">{error.message}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold mb-2">Reminders</h1>
          <p className="text-sm text-muted-foreground">
            Monitor and manage fleet compliance reminders and notifications
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter className="h-4 w-4 mr-2" />
            Filters
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={exportReminders}
            disabled={reminders.length === 0}
          >
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => generateReminders.mutate()}
            disabled={generateReminders.isPending}
          >
            <Play className="h-4 w-4 mr-2" />
            {generateReminders.isPending ? 'Generating...' : 'Generate'}
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-card hover:bg-accent/50 border transition-all duration-200 cursor-pointer hover:shadow-md">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Active</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.total || 0}</div>
            <p className="text-xs text-muted-foreground">All pending & snoozed</p>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20 hover:border-primary/40 transition-all duration-200 cursor-pointer hover:shadow-md">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Due Today</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">{stats?.due || 0}</div>
            <p className="text-xs text-muted-foreground">Require attention</p>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-destructive/10 to-destructive/5 border-destructive/20 hover:border-destructive/40 transition-all duration-200 cursor-pointer hover:shadow-md">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Critical</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{stats?.critical || 0}</div>
            <p className="text-xs text-muted-foreground">Urgent action needed</p>
          </CardContent>
        </Card>
        
        <Card className="bg-card hover:bg-accent/50 border transition-all duration-200 cursor-pointer hover:shadow-md">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Snoozed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-muted-foreground">{stats?.snoozed || 0}</div>
            <p className="text-xs text-muted-foreground">Deferred reminders</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Filter Reminders</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={filters.status?.[0] || ''}
                  onValueChange={(value) => 
                    setFilters(prev => ({ ...prev, status: value ? [value] : undefined }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="sent">Sent</SelectItem>
                    <SelectItem value="snoozed">Snoozed</SelectItem>
                    <SelectItem value="done">Done</SelectItem>
                    <SelectItem value="dismissed">Dismissed</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Severity</Label>
                <Select
                  value={filters.severity?.[0] || ''}
                  onValueChange={(value) => 
                    setFilters(prev => ({ ...prev, severity: value ? [value] : undefined }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All severities" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="critical">Critical</SelectItem>
                    <SelectItem value="warning">Warning</SelectItem>
                    <SelectItem value="info">Info</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Object Type</Label>
                <Select
                  value={filters.object_type?.[0] || ''}
                  onValueChange={(value) => 
                    setFilters(prev => ({ ...prev, object_type: value ? [value] : undefined }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Vehicle">Vehicle</SelectItem>
                    <SelectItem value="Rental">Rental</SelectItem>
                    <SelectItem value="Customer">Customer</SelectItem>
                    <SelectItem value="Fine">Fine</SelectItem>
                    <SelectItem value="Document">Document</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-end">
                <Button
                  variant="outline"
                  onClick={() => setFilters({})}
                  className="w-full"
                >
                  Clear Filters
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Bulk Actions */}
      {selectedIds.length > 0 && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                {selectedIds.length} reminder{selectedIds.length !== 1 ? 's' : ''} selected
              </span>
              
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={() => handleBulkAction('done')}
                  disabled={isUpdating}
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Mark Done
                </Button>
                
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleBulkAction('dismissed')}
                  disabled={isUpdating}
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  Dismiss
                </Button>
                
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="sm" variant="outline">
                      <Pause className="h-4 w-4 mr-2" />
                      Snooze
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem onClick={() => {
                      const snoozeUntil = new Date();
                      snoozeUntil.setDate(snoozeUntil.getDate() + 1);
                      handleBulkAction('snoozed', snoozeUntil.toISOString().split('T')[0]);
                    }}>
                      1 day
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => {
                      const snoozeUntil = new Date();
                      snoozeUntil.setDate(snoozeUntil.getDate() + 7);
                      handleBulkAction('snoozed', snoozeUntil.toISOString().split('T')[0]);
                    }}>
                      1 week
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => {
                      const snoozeUntil = new Date();
                      snoozeUntil.setDate(snoozeUntil.getDate() + 14);
                      handleBulkAction('snoozed', snoozeUntil.toISOString().split('T')[0]);
                    }}>
                      2 weeks
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Reminders Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">
            All Reminders ({reminders.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
              <p className="mt-4 text-muted-foreground">Loading reminders...</p>
            </div>
          ) : reminders.length === 0 ? (
            <div className="text-center py-12">
              <Bell className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Reminders</h3>
              <p className="text-muted-foreground mb-4">No reminders match your current filters.</p>
              <Button
                variant="outline"
                onClick={() => generateReminders.mutate()}
                disabled={generateReminders.isPending}
              >
                <Play className="h-4 w-4 mr-2" />
                Generate Reminders
              </Button>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]">
                      <Checkbox
                        checked={selectedIds.length === reminders.length}
                        onCheckedChange={handleSelectAll}
                      />
                    </TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>Object</TableHead>
                    <TableHead>Due On</TableHead>
                    <TableHead>Remind On</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Snooze Until</TableHead>
                    <TableHead className="w-[100px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reminders.map((reminder) => (
                    <TableRow key={reminder.id}>
                      <TableCell>
                        <Checkbox
                          checked={selectedIds.includes(reminder.id)}
                          onCheckedChange={(checked) => 
                            handleSelectReminder(reminder.id, checked as boolean)
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center">
                          {getSeverityIcon(reminder.severity)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{reminder.title}</div>
                          <div className="text-sm text-muted-foreground truncate max-w-[300px]">
                            {reminder.message}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <div>{getObjectLink(reminder)}</div>
                          <div className="text-xs text-muted-foreground">
                            {reminder.object_type}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {format(parseISO(reminder.due_on), 'MMM dd, yyyy')}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {format(parseISO(reminder.remind_on), 'MMM dd, yyyy')}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={STATUS_COLORS[reminder.status as keyof typeof STATUS_COLORS]}>
                          {reminder.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {reminder.snooze_until && (
                          <div className="text-sm">
                            {format(parseISO(reminder.snooze_until), 'MMM dd, yyyy')}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => markDone(reminder.id)}
                              disabled={['done', 'dismissed', 'expired'].includes(reminder.status)}
                            >
                              <CheckCircle className="h-4 w-4 mr-2" />
                              Mark Done
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => dismiss(reminder.id)}
                              disabled={['done', 'dismissed', 'expired'].includes(reminder.status)}
                            >
                              <XCircle className="h-4 w-4 mr-2" />
                              Dismiss
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => snooze(reminder.id, 1)}
                              disabled={['done', 'dismissed', 'expired'].includes(reminder.status)}
                            >
                              <Pause className="h-4 w-4 mr-2" />
                              Snooze 1 day
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => snooze(reminder.id, 7)}
                              disabled={['done', 'dismissed', 'expired'].includes(reminder.status)}
                            >
                              <Pause className="h-4 w-4 mr-2" />
                              Snooze 1 week
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => snooze(reminder.id, 14)}
                              disabled={['done', 'dismissed', 'expired'].includes(reminder.status)}
                            >
                              <Pause className="h-4 w-4 mr-2" />
                              Snooze 2 weeks
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}