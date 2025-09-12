import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Layout } from "@/components/Layout";
import Dashboard from "@/pages/Dashboard";
import VehiclesList from "@/pages/VehiclesList";
import VehicleDetail from "@/pages/VehicleDetail";
import CustomersList from "@/pages/CustomersList";
import CustomerDetail from "@/pages/CustomerDetail";
import RentalsList from "@/pages/RentalsList";
import RentalDetail from "@/pages/RentalDetail";
import PaymentsList from "@/pages/PaymentsList";
import CreateRental from "@/pages/CreateRental";
import RemindersPage from "@/pages/RemindersPage";
import ReminderSettings from "@/pages/ReminderSettings";
import Reports from "@/pages/Reports";
import LoginPage from "@/pages/LoginPage";
import ChangePasswordPage from "@/pages/ChangePasswordPage";
import UnauthorizedPage from "@/pages/UnauthorizedPage";
import UsersManagementPage from "@/pages/UsersManagementPage";
import { AcceptanceTestDashboard } from "@/components/AcceptanceTestDashboard";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            {/* Public routes */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/change-password" element={<ChangePasswordPage />} />
            <Route path="/unauthorized" element={<UnauthorizedPage />} />
            
            {/* Protected routes */}
            <Route path="/" element={
              <ProtectedRoute>
                <Layout><Dashboard /></Layout>
              </ProtectedRoute>
            } />
            <Route path="/vehicles" element={
              <ProtectedRoute requirePermission="manage_vehicles">
                <Layout><VehiclesList /></Layout>
              </ProtectedRoute>
            } />
            <Route path="/vehicles/:id" element={
              <ProtectedRoute requirePermission="manage_vehicles">
                <Layout><VehicleDetail /></Layout>
              </ProtectedRoute>
            } />
            <Route path="/customers" element={
              <ProtectedRoute requirePermission="manage_customers">
                <Layout><CustomersList /></Layout>
              </ProtectedRoute>
            } />
            <Route path="/customers/:id" element={
              <ProtectedRoute requirePermission="manage_customers">
                <Layout><CustomerDetail /></Layout>
              </ProtectedRoute>
            } />
            <Route path="/rentals" element={
              <ProtectedRoute requirePermission="manage_rentals">
                <Layout><RentalsList /></Layout>
              </ProtectedRoute>
            } />
            <Route path="/rentals/new" element={
              <ProtectedRoute requirePermission="manage_rentals">
                <Layout><CreateRental /></Layout>
              </ProtectedRoute>
            } />
            <Route path="/rentals/:id" element={
              <ProtectedRoute requirePermission="manage_rentals">
                <Layout><RentalDetail /></Layout>
              </ProtectedRoute>
            } />
            <Route path="/payments" element={
              <ProtectedRoute requirePermission="manage_payments">
                <Layout><PaymentsList /></Layout>
              </ProtectedRoute>
            } />
            <Route path="/reminders" element={
              <ProtectedRoute requirePermission="manage_payments">
                <Layout><RemindersPage /></Layout>
              </ProtectedRoute>
            } />
            <Route path="/settings/reminders" element={
              <ProtectedRoute requirePermission="manage_payments">
                <Layout><ReminderSettings /></Layout>
              </ProtectedRoute>
            } />
            <Route path="/reports" element={
              <ProtectedRoute>
                <Layout><Reports /></Layout>
              </ProtectedRoute>
            } />
            <Route path="/settings/users" element={
              <ProtectedRoute requirePermission="manage_users">
                <Layout><UsersManagementPage /></Layout>
              </ProtectedRoute>
            } />
            <Route path="/test" element={
              <ProtectedRoute requirePermission="manage_settings">
                <Layout><AcceptanceTestDashboard /></Layout>
              </ProtectedRoute>
            } />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;