import { useState, useEffect } from 'react';
import { useNavigate, Outlet } from 'react-router-dom';
import { Package, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { signOut, isUserChinaWarehouse } from '@/lib/auth';
import { SiteSettingsProvider } from '@/hooks/useSiteSettings';

export default function ChinaWarehouseLayout() {
  const { user, isLoading } = useAuth();
  const navigate = useNavigate();
  const [hasAccess, setHasAccess] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const checkAccess = async () => {
      if (!isLoading && !user) {
        navigate('/auth');
        return;
      }

      if (user) {
        const isChinaWarehouse = await isUserChinaWarehouse(user.id);
        if (!isChinaWarehouse) {
          navigate('/');
          return;
        }
        setHasAccess(true);
      }
      setChecking(false);
    };

    checkAccess();
  }, [user, isLoading, navigate]);

  const handleLogout = async () => {
    await signOut();
    navigate('/');
  };

  if (isLoading || checking) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!hasAccess) {
    return null;
  }

  return (
    <SiteSettingsProvider>
      <div className="flex min-h-screen flex-col bg-background">
        {/* Header */}
        <header className="sticky top-0 z-50 border-b bg-card">
          <div className="flex h-14 items-center justify-between px-4">
            <div className="flex items-center gap-2">
              <Package className="h-6 w-6 text-primary" />
              <span className="font-semibold">Эрээн агуулах</span>
            </div>
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              <LogOut className="mr-2 h-4 w-4" />
              Гарах
            </Button>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 p-4">
          <Outlet />
        </main>
      </div>
    </SiteSettingsProvider>
  );
}
