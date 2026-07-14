import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";

// Layouts
import UserLayout from "@/components/layout/UserLayout";
import AdminLayout from "@/components/layout/AdminLayout";
import ChinaWarehouseLayout from "@/components/layout/ChinaWarehouseLayout";

// User Pages
import Home from "@/pages/Home";
import MyCargo from "@/pages/MyCargo";
import Calculator from "@/pages/Calculator";
import ChinaAddress from "@/pages/ChinaAddress";
import KoreaAddress from "@/pages/KoreaAddress";
import Profile from "@/pages/Profile";
import WalletPage from "@/pages/Wallet";
import ReferralPage from "@/pages/Referral";
import Auth from "@/pages/Auth";
import Remittance from "@/pages/Remittance";
import ProductResearch from "@/pages/ProductResearch";
import CustomsConsultation from "@/pages/CustomsConsultation";
import ChinaDomesticTransport from "@/pages/ChinaDomesticTransport";
import MongoliaDelivery from "@/pages/MongoliaDelivery";
import NotFound from "@/pages/NotFound";



// Admin Pages
import AdminDashboard from "@/pages/admin/AdminDashboard";
import CargoRegister from "@/pages/admin/CargoRegister";
import UnassignedCargo from "@/pages/admin/UnassignedCargo";
import CargoHandover from "@/pages/admin/CargoHandover";
import AllCargo from "@/pages/admin/AllCargo";
import AllUsers from "@/pages/admin/AllUsers";
import RoleManagement from "@/pages/admin/RoleManagement";
import SiteSettings from "@/pages/admin/SiteSettings";
import BranchManagement from "@/pages/admin/BranchManagement";
import BannerManagement from "@/pages/admin/BannerManagement";
import DeliveryZoneManagement from "@/pages/admin/DeliveryZoneManagement";
import DeliveryOrders from "@/pages/admin/DeliveryOrders";
import ReferralSettings from "@/pages/admin/ReferralSettings";
import ApiKeyManagement from "@/pages/admin/ApiKeyManagement";
import RemittanceManagement from "@/pages/admin/RemittanceManagement";
import ProductResearchManagement from "@/pages/admin/ProductResearchManagement";
import CustomsConsultationManagement from "@/pages/admin/CustomsConsultationManagement";
import ChinaDomesticTransportManagement from "@/pages/admin/ChinaDomesticTransportManagement";
import MongoliaDeliveryManagement from "@/pages/admin/MongoliaDeliveryManagement";



// China Warehouse Pages
import ChinaWarehouseRegister from "@/pages/china-warehouse/ChinaWarehouseRegister";
import ShipmentLoading from "@/pages/china-warehouse/ShipmentLoading";

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
              <Route path="/china-address" element={<ChinaAddress />} />
              <Route path="/korea-address" element={<KoreaAddress />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/wallet" element={<WalletPage />} />
              <Route path="/referral" element={<ReferralPage />} />
              <Route path="/remittance" element={<Remittance />} />
              <Route path="/product-research" element={<ProductResearch />} />
              <Route path="/customs-consultation" element={<CustomsConsultation />} />
              <Route path="/china-domestic-transport" element={<ChinaDomesticTransport />} />

            </Route>

            {/* Admin Routes with Sidebar */}
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<AdminDashboard />} />
              <Route path="register" element={<CargoRegister />} />
              <Route path="unassigned" element={<UnassignedCargo />} />
              <Route path="handover" element={<CargoHandover />} />
              <Route path="cargo" element={<AllCargo />} />
              <Route path="users" element={<AllUsers />} />
              <Route path="roles" element={<RoleManagement />} />
              <Route path="settings" element={<SiteSettings />} />
              <Route path="branches" element={<BranchManagement />} />
              <Route path="banners" element={<BannerManagement />} />
              <Route path="delivery-zones" element={<DeliveryZoneManagement />} />
              <Route path="delivery-orders" element={<DeliveryOrders />} />
              <Route path="referral-settings" element={<ReferralSettings />} />
              <Route path="integrations" element={<ApiKeyManagement />} />
              <Route path="remittance" element={<RemittanceManagement />} />
              <Route path="product-research" element={<ProductResearchManagement />} />
              <Route path="customs-consultation" element={<CustomsConsultationManagement />} />
              <Route path="china-domestic-transport" element={<ChinaDomesticTransportManagement />} />

            </Route>

            {/* China Warehouse Routes */}
            <Route path="/china-warehouse" element={<ChinaWarehouseLayout />}>
              <Route index element={<ChinaWarehouseRegister />} />
              <Route path="shipments" element={<ShipmentLoading />} />
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
