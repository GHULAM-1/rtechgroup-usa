import { Layout } from "@/components/Layout";
import { DashboardStats } from "@/components/DashboardStats";
import { FleetOverview } from "@/components/FleetOverview";
import { RecentActivity } from "@/components/RecentActivity";

const Index = () => {
  return (
    <Layout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Fleet Dashboard</h1>
            <p className="text-muted-foreground">Monitor your fleet performance and financial metrics</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-muted-foreground">Today</p>
            <p className="text-lg font-semibold">{new Date().toLocaleDateString()}</p>
          </div>
        </div>

        <DashboardStats />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <FleetOverview />
          <RecentActivity />
        </div>
      </div>
    </Layout>
  );
};

export default Index;
