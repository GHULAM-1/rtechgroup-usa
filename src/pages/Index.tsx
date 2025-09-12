import { Layout } from "@/components/Layout";
import { DashboardStats } from "@/components/DashboardStats";
import { FleetOverview } from "@/components/FleetOverview";
import { CustomerManagement } from "@/components/CustomerManagement";
import { AcceptanceTestDashboard } from "@/components/AcceptanceTestDashboard";

const Index = () => {
  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-5xl font-bold text-foreground">Fleet Dashboard</h1>
            <p className="text-muted-foreground mt-2">Monitor your fleet performance and financial metrics</p>
          </div>
          <div className="text-right">
            <p className="text-metadata text-muted-foreground">Today</p>
            <p className="text-lg font-semibold">{new Date().toLocaleDateString()}</p>
          </div>
        </div>

        <DashboardStats />

        <AcceptanceTestDashboard />
      </div>
    </Layout>
  );
};

export default Index;
