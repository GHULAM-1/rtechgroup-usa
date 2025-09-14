import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, XCircle, Clock, AlertTriangle } from 'lucide-react';

export interface TestResult {
  name: string;
  status: 'passed' | 'failed' | 'warning' | 'pending';
  message?: string;
  duration?: number;
}

interface TestResultsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  results: TestResult[];
  isRunning?: boolean;
}

export const TestResultsModal: React.FC<TestResultsModalProps> = ({
  open,
  onOpenChange,
  title,
  results,
  isRunning = false
}) => {
  const getStatusIcon = (status: TestResult['status']) => {
    switch (status) {
      case 'passed':
        return <CheckCircle className="h-4 w-4 text-success" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-destructive" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-warning" />;
      case 'pending':
        return <Clock className="h-4 w-4 text-muted-foreground animate-spin" />;
    }
  };

  const getStatusBadge = (status: TestResult['status']) => {
    switch (status) {
      case 'passed':
        return <Badge variant="default" className="text-green-700 bg-green-100 border-green-300">Passed</Badge>;
      case 'failed':
        return <Badge variant="destructive">Failed</Badge>;
      case 'warning':
        return <Badge variant="secondary">Warning</Badge>;
      case 'pending':
        return <Badge variant="outline">Running...</Badge>;
    }
  };

  const passedCount = results.filter(r => r.status === 'passed').length;
  const failedCount = results.filter(r => r.status === 'failed').length;
  const warningCount = results.filter(r => r.status === 'warning').length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {isRunning ? (
              'Tests are currently running...'
            ) : (
              `${passedCount} passed, ${failedCount} failed, ${warningCount} warnings`
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {results.map((result, index) => (
            <div
              key={index}
              className="flex items-start gap-3 p-4 rounded-lg border border-border bg-card"
            >
              <div className="flex-shrink-0 mt-0.5">
                {getStatusIcon(result.status)}
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <h4 className="font-medium text-sm truncate">{result.name}</h4>
                  {getStatusBadge(result.status)}
                </div>
                
                {result.message && (
                  <p className="text-sm text-muted-foreground">{result.message}</p>
                )}
                
                {result.duration && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Completed in {result.duration}ms
                  </p>
                )}
              </div>
            </div>
          ))}

          {results.length === 0 && !isRunning && (
            <div className="text-center py-8 text-muted-foreground">
              No test results available
            </div>
          )}

          {isRunning && results.length === 0 && (
            <div className="text-center py-8">
              <Clock className="h-8 w-8 text-muted-foreground animate-spin mx-auto mb-2" />
              <p className="text-muted-foreground">Initializing tests...</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};