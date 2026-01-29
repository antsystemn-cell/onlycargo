import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";

// Layouts
import UserLayout from "@/components/layout/UserLayout";
import AdminLayout from "@/components/layout/AdminLayout";

// User Pages
import Home from "@/pages/Home";
import MyCargo from "@/pages/MyCargo";
import Calculator from "@/pages/Calculator";
import Profile from "@/pages/Profile";
import Auth from "@/pages/Auth";
import NotFound from "@/pages/NotFound";

// Admin Pages
import AdminDashboard from "@/pages/admin/AdminDashboard";
import CargoRegister from "@/pages/admin/CargoRegister";
import UnassignedCargo from "@/pages/admin/UnassignedCargo";
import CargoHandover from "@/pages/admin/CargoHandover";
import AllCargo from "@/pages/admin/AllCargo";
import AllUsers from "@/pages/admin/AllUsers";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            {/* Auth Route */}
            <Route path="/auth" element={<Auth />} />

            {/* User Routes with Bottom Nav */}
            <Route element={<UserLayout />}>
              <Route path="/" element={<Home />} />
              <Route path="/my-cargo" element={<MyCargo />} />
              <Route path="/calculator" element={<Calculator />} />
              <Route path="/profile" element={<Profile />} />
            </Route>

            {/* Admin Routes with Sidebar */}
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<AdminDashboard />} />
              <Route path="register" element={<CargoRegister />} />
              <Route path="unassigned" element={<UnassignedCargo />} />
              <Route path="handover" element={<CargoHandover />} />
              <Route path="cargo" element={<AllCargo />} />
              <Route path="users" element={<AllUsers />} />
            </Route>

            {/* Catch-all */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
