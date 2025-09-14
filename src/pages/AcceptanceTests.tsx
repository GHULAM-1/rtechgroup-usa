import { AcceptanceTestVehicleDisposal } from "@/components/AcceptanceTestVehicleDisposal";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function AcceptanceTests() {
  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">System Acceptance Tests</h1>
        <p className="text-muted-foreground">
          Run automated acceptance tests to verify system functionality
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Available Test Suites</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="disposal">
            <TabsList>
              <TabsTrigger value="disposal">Vehicle Disposal</TabsTrigger>
              {/* Add more test categories as needed */}
            </TabsList>
            
            <TabsContent value="disposal" className="mt-6">
              <AcceptanceTestVehicleDisposal />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}