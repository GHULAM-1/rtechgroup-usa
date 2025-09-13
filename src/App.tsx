import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Layout } from "@/components/Layout";
import Dashboard from "@/pages/Dashboard";
import VehiclesList from "@/pages/VehiclesList";
import VehicleDetail from "@/pages/VehicleDetail";
import CustomersList from "@/pages/CustomersList";
import CustomerDetail from "@/pages/CustomerDetail";
import RentalsList from "@/pages/RentalsList";
import RentalDetail from "@/pages/RentalDetail";
import PaymentsList from "@/pages/PaymentsList";
import ChargesList from "@/pages/ChargesList";
import PlatesList from "@/pages/PlatesList";
import PLDashboard from "@/pages/PLDashboard";
import CreateRental from "@/pages/CreateRental";
import RemindersPage from "@/pages/RemindersPage";
import ReminderSettings from "@/pages/ReminderSettings";
import Reports from "@/pages/Reports";
import { AcceptanceTestDashboard } from "@/components/AcceptanceTestDashboard";
import FinesPage from "@/pages/FinesPage";
import FinesList from "@/pages/FinesList";
import CreateFine from "@/pages/CreateFine";
import FineDetail from "@/pages/FineDetail";
import RemindersPageNew from "@/pages/RemindersPageNew";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Layout><Dashboard /></Layout>} />
          <Route path="/vehicles" element={<Layout><VehiclesList /></Layout>} />
          <Route path="/vehicles/:id" element={<Layout><VehicleDetail /></Layout>} />
          <Route path="/customers" element={<Layout><CustomersList /></Layout>} />
          <Route path="/customers/:id" element={<Layout><CustomerDetail /></Layout>} />
          <Route path="/rentals" element={<Layout><RentalsList /></Layout>} />
          <Route path="/rentals/new" element={<Layout><CreateRental /></Layout>} />
          <Route path="/rentals/:id" element={<Layout><RentalDetail /></Layout>} />
          <Route path="/payments" element={<Layout><PaymentsList /></Layout>} />
          <Route path="/charges" element={<Layout><ChargesList /></Layout>} />
          <Route path="/plates" element={<Layout><PlatesList /></Layout>} />
          <Route path="/pl-dashboard" element={<Layout><PLDashboard /></Layout>} />
          <Route path="/reminders-new" element={<Layout><RemindersPageNew /></Layout>} />
          <Route path="/reminders" element={<Layout><RemindersPage /></Layout>} />
          <Route path="/settings/reminders" element={<Layout><ReminderSettings /></Layout>} />
          <Route path="/reports" element={<Layout><Reports /></Layout>} />
          <Route path="/fines-old" element={<Layout><FinesPage /></Layout>} />
          <Route path="/fines" element={<Layout><FinesList /></Layout>} />
          <Route path="/fines/new" element={<Layout><CreateFine /></Layout>} />
          <Route path="/fines/:id" element={<Layout><FineDetail /></Layout>} />
          <Route path="/test" element={<Layout><AcceptanceTestDashboard /></Layout>} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;