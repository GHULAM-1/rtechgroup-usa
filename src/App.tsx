import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { useEffect } from "react";
import { Layout } from "@/components/Layout";
import { SettingsProvider } from "@/contexts/SettingsContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { AuthGuard } from "@/components/AuthGuard";
import Dashboard from "@/pages/Dashboard";
import VehiclesList from "@/pages/VehiclesList";
import VehicleDetail from "@/pages/VehicleDetail";
import CustomersList from "@/pages/CustomersList";
import CustomerDetail from "@/pages/CustomerDetail";
import RentalsList from "@/pages/RentalsList";
import RentalDetail from "@/pages/RentalDetail";
import PaymentsList from "@/pages/PaymentsList";
import PaymentDetail from "@/pages/PaymentDetail";
import ChargesList from "@/pages/ChargesList";
import PlatesListEnhanced from "@/pages/PlatesListEnhanced";
import PlateDetail from "@/pages/PlateDetail";
import PLDashboard from "@/pages/PLDashboard";
import MonthlyPLDrilldown from "@/pages/MonthlyPLDrilldown";
import CreateRental from "@/pages/CreateRental";
import RemindersPageEnhanced from "@/pages/RemindersPageEnhanced";
import ReminderSettings from "@/pages/ReminderSettings";
import Reports from "@/pages/Reports";
import Settings from "@/pages/Settings";
import { AcceptanceTestDashboard } from "@/components/AcceptanceTestDashboard";
import FinesPage from "@/pages/FinesPage";
import FinesList from "@/pages/FinesList";
import CreateFine from "@/pages/CreateFine";
import FineDetail from "@/pages/FineDetail";
import RemindersPageNew from "@/pages/RemindersPageNew";
import InsuranceListEnhanced from "@/pages/InsuranceListEnhanced";
import Login from "@/pages/Login";
import ResetPassword from "@/pages/ResetPassword";
import UsersManagement from "@/pages/UsersManagement";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function App() {
  // Global keyboard shortcut for search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        // Dispatch custom event that the Layout component can listen to
        window.dispatchEvent(new CustomEvent("open-global-search"));
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <SettingsProvider>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            <TooltipProvider>
              <Toaster />
              <Sonner />
              <BrowserRouter>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/" element={<AuthGuard><Layout><Dashboard /></Layout></AuthGuard>} />
            <Route path="/vehicles" element={<AuthGuard><Layout><VehiclesList /></Layout></AuthGuard>} />
            <Route path="/vehicles/:id" element={<AuthGuard><Layout><VehicleDetail /></Layout></AuthGuard>} />
            <Route path="/customers" element={<AuthGuard><Layout><CustomersList /></Layout></AuthGuard>} />
            <Route path="/customers/:id" element={<AuthGuard><Layout><CustomerDetail /></Layout></AuthGuard>} />
            <Route path="/rentals" element={<AuthGuard><Layout><RentalsList /></Layout></AuthGuard>} />
            <Route path="/rentals/new" element={<AuthGuard><Layout><CreateRental /></Layout></AuthGuard>} />
            <Route path="/rentals/:id" element={<AuthGuard><Layout><RentalDetail /></Layout></AuthGuard>} />
            <Route path="/payments" element={<AuthGuard><Layout><PaymentsList /></Layout></AuthGuard>} />
            <Route path="/payments/:id" element={<AuthGuard><Layout><PaymentDetail /></Layout></AuthGuard>} />
            <Route path="/charges" element={<AuthGuard><Layout><ChargesList /></Layout></AuthGuard>} />
            <Route path="/plates" element={<AuthGuard><Layout><PlatesListEnhanced /></Layout></AuthGuard>} />
            <Route path="/plates/:id" element={<AuthGuard><Layout><PlateDetail /></Layout></AuthGuard>} />
            <Route path="/pl-dashboard" element={<AuthGuard><Layout><PLDashboard /></Layout></AuthGuard>} />
            <Route path="/pl-dashboard/monthly/:month" element={<AuthGuard><Layout><MonthlyPLDrilldown /></Layout></AuthGuard>} />
            <Route path="/reminders-new" element={<AuthGuard><Layout><RemindersPageNew /></Layout></AuthGuard>} />
            <Route path="/reminders" element={<AuthGuard><Layout><RemindersPageEnhanced /></Layout></AuthGuard>} />
            <Route path="/settings/reminders" element={<AuthGuard><Layout><ReminderSettings /></Layout></AuthGuard>} />
            <Route path="/reports" element={<AuthGuard><Layout><Reports /></Layout></AuthGuard>} />
            <Route path="/settings" element={<AuthGuard><Layout><Settings /></Layout></AuthGuard>} />
            <Route path="/settings/users" element={<AuthGuard requiredRoles={['head_admin']}><Layout><UsersManagement /></Layout></AuthGuard>} />
            <Route path="/fines-old" element={<AuthGuard><Layout><FinesPage /></Layout></AuthGuard>} />
            <Route path="/fines" element={<AuthGuard><Layout><FinesList /></Layout></AuthGuard>} />
            <Route path="/fines/new" element={<AuthGuard><Layout><CreateFine /></Layout></AuthGuard>} />
            <Route path="/fines/:id" element={<AuthGuard><Layout><FineDetail /></Layout></AuthGuard>} />
            <Route path="/insurance" element={<AuthGuard><Layout><InsuranceListEnhanced /></Layout></AuthGuard>} />
            <Route path="/test" element={<Navigate to="/settings?tab=testing" replace />} />
            <Route path="*" element={<NotFound />} />
            </Routes>
            </BrowserRouter>
          </TooltipProvider>
        </ThemeProvider>
      </SettingsProvider>
    </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;