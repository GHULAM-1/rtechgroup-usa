import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DashboardSystemTests } from '@/components/DashboardSystemTests';
import { RentalAcceptanceTest } from '@/components/RentalAcceptanceTest';
import { FinanceAcceptanceTest } from '@/components/FinanceAcceptanceTest';
import { EnhancedSettingsTest } from '@/components/EnhancedSettingsTest';
import { ComprehensiveSystemTest } from '@/components/ComprehensiveSystemTest';
import { PaymentsAcceptanceTest } from '@/components/PaymentsAcceptanceTest';
import { AcceptanceTestInsurance } from '@/components/AcceptanceTestInsurance';
import { AlertTriangle } from 'lucide-react';

export const ComprehensiveTestingSuite = () => {
  return (
    <div className="space-y-6">
      {/* Admin Notice */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-orange-600">
            <AlertTriangle className="h-5 w-5" />
            Admin Testing Suite
          </CardTitle>
          <CardDescription>
            These system tests are for admin use only. They validate key calculations and system integrity. 
            Running them does not affect live data.
          </CardDescription>
        </CardHeader>
      </Card>

      {/* System Validation Tests */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">System Validation</CardTitle>
          <CardDescription>Core system functionality and performance tests</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <DashboardSystemTests />
            <EnhancedSettingsTest />
          </div>
        </CardContent>
      </Card>

      {/* Financial Processing Tests */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Financial Processing</CardTitle>
          <CardDescription>Payment allocation, rental accounting, and P&L validation</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <RentalAcceptanceTest />
            <FinanceAcceptanceTest />
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            <PaymentsAcceptanceTest />
            <ComprehensiveSystemTest />
          </div>
        </CardContent>
      </Card>

      {/* Feature Testing */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Feature Testing</CardTitle>
          <CardDescription>Insurance, compliance, and feature-specific validation</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <AcceptanceTestInsurance />
        </CardContent>
      </Card>

      {/* Test Documentation */}
      <Card>
        <CardHeader>
          <CardTitle>Test Documentation</CardTitle>
          <CardDescription>Understanding what these tests verify</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            <div>
              <h3 className="font-semibold mb-2">System Validation</h3>
              <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                <li>Dashboard KPI calculation accuracy</li>
                <li>Cross-page data consistency</li>
                <li>API response performance</li>
                <li>Settings configuration integrity</li>
                <li>Cache behaviour and invalidation</li>
              </ul>
            </div>
            
            <div>
              <h3 className="font-semibold mb-2">Financial Processing</h3>
              <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                <li>Initial fee payments create immediate revenue</li>
                <li>Rental payments use FIFO allocation</li>
                <li>Proper ledger and P&L entry creation</li>
                <li>Payment status tracking (Applied/Credit/Partial)</li>
                <li>Upfront finance cost accounting</li>
                <li>Customer balance calculations</li>
              </ul>
            </div>
            
            <div>
              <h3 className="font-semibold mb-2">Feature Testing</h3>
              <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                <li>Insurance policy management</li>
                <li>Document upload and validation</li>
                <li>Compliance status tracking</li>
                <li>Reminder system functionality</li>
                <li>Data integrity maintenance</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};