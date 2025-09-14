import { PaymentsAcceptanceTest } from './PaymentsAcceptanceTest';
import { ComprehensiveSystemTest } from './ComprehensiveSystemTest';
import { AcceptanceTestInsurance } from './AcceptanceTestInsurance';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export const AcceptanceTestDashboard = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Acceptance Test Dashboard</h1>
        <p className="text-muted-foreground mt-2">
          Comprehensive testing suite for the payments and ledger system
        </p>
      </div>

      <ComprehensiveSystemTest />
      
      <PaymentsAcceptanceTest />

      <AcceptanceTestInsurance />

      <Card>
        <CardHeader>
          <CardTitle>Test Documentation</CardTitle>
          <CardDescription>What these tests verify</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold">Payment Processing Tests</h3>
              <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                <li>Initial fee payments create immediate revenue (no FIFO allocation)</li>
                <li>Rental payments use FIFO allocation to charges</li>
                <li>Proper ledger and P&L entry creation</li>
                <li>Payment status tracking (Applied/Credit/Partial)</li>
                <li>Idempotency of payment processing</li>
                <li>Customer balance calculations</li>
                <li>Automated initial fee handling during rental creation</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};