import { Link, useLocation, Outlet, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  Package,
  PackagePlus,
  PackageX,
  HandCoins,
  Users,
  ArrowLeft,
  Settings,
  Building2,
  Menu,
  Image,
  Shield,
  MapPin,
  Gift,
  Truck,
  Key,
  ArrowRightLeft,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { useAuth } from '@/hooks/useAuth';
import { SiteSettingsProvider, useSiteSettings } from '@/hooks/useSiteSettings';

const adminNavItems = [
  { href: '/admin', icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/admin/register', icon: PackagePlus, label: 'Ачаа бүртгэх' },
  { href: '/admin/unassigned', icon: PackageX, label: 'Утасгүй ачаа' },
  { href: '/admin/handover', icon: HandCoins, label: 'Хүлээлгэж өгөх' },
  { href: '/admin/cargo', icon: Package, label: 'Бүх ачаа' },
  { href: '/admin/users', icon: Users, label: 'Хэрэглэгчид' },
  { href: '/admin/roles', icon: Shield, label: 'Эрх удирдах' },
  { href: '/admin/branches', icon: Building2, label: 'Салбарууд' },
  { href: '/admin/delivery-zones', icon: MapPin, label: 'Хүргэлтийн бүс' },
  { href: '/admin/delivery-orders', icon: Truck, label: 'Хүргэлтийн захиалга' },
  { href: '/admin/banners', icon: Image, label: 'Баннерүүд' },
  { href: '/admin/referral-settings', icon: Gift, label: 'Урилгын тохиргоо' },
  { href: '/admin/remittance', icon: ArrowRightLeft, label: 'Юанийн гуйвуулга' },
  { href: '/admin/integrations', icon: Key, label: 'API Интеграци' },
  { href: '/admin/settings', icon: Settings, label: 'Тохиргоо' },
];

function AdminNav({ onItemClick }: { onItemClick?: () => void }) {
  const location = useLocation();

  return (
    <nav className="flex-1 space-y-1 p-4">
      {adminNavItems.map((item) => {
        const isActive = location.pathname === item.href;
        return (
          <Link
            key={item.href}
            to={item.href}
            onClick={onItemClick}
            className={cn(
              'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
              isActive
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            )}
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

function AdminLayoutContent() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isAdmin, isLoading } = useAuth();
  const { logoUrl } = useSiteSettings();
  const [sheetOpen, setSheetOpen] = useState(false);

  useEffect(() => {
    if (!isLoading && (!user || !isAdmin)) {
      navigate('/');
    }
  }, [user, isAdmin, isLoading, navigate]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="flex min-h-screen">
      {/* Desktop Sidebar */}
      <aside className="fixed left-0 top-0 z-40 hidden h-screen w-64 border-r bg-card lg:block">
        <div className="flex h-full flex-col">
          <div className="border-b p-4">
            <div className="flex items-center gap-2">
              <img src={logoUrl} alt="Logo" className="h-8 w-8 object-contain" />
              <h1 className="text-lg font-bold">Cargo Admin</h1>
            </div>
          </div>

          <AdminNav />

          <div className="border-t p-4">
            <Button variant="outline" className="w-full" onClick={() => navigate('/')}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Хэрэглэгч тал руу
            </Button>
          </div>
        </div>
      </aside>

      {/* Mobile Header */}
      <header className="fixed left-0 right-0 top-0 z-50 border-b bg-card lg:hidden">
        <div className="flex h-14 items-center gap-4 px-4">
          <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 p-0">
              <div className="flex items-center gap-2 border-b p-4">
                <img src={logoUrl} alt="Logo" className="h-8 w-8 object-contain" />
                <h1 className="text-lg font-bold">Admin</h1>
              </div>
              <AdminNav onItemClick={() => setSheetOpen(false)} />
              <div className="border-t p-4">
                <Button variant="outline" className="w-full" onClick={() => navigate('/')}>
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Хэрэглэгч тал руу
                </Button>
              </div>
            </SheetContent>
          </Sheet>
          <div className="flex items-center gap-2">
            <img src={logoUrl} alt="Logo" className="h-6 w-6 object-contain" />
            <span className="font-semibold">Admin</span>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 pt-14 lg:ml-64 lg:pt-0">
        <div className="p-4 lg:p-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

export default function AdminLayout() {
  return (
    <SiteSettingsProvider>
      <AdminLayoutContent />
    </SiteSettingsProvider>
  );
}
