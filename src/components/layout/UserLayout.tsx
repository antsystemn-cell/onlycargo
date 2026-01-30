import { Outlet } from 'react-router-dom';
import BottomNav from './BottomNav';
import { SiteSettingsProvider } from '@/hooks/useSiteSettings';

export default function UserLayout() {
  return (
    <SiteSettingsProvider>
      <div className="flex min-h-screen flex-col bg-background">
        <div className="flex-1 pb-20">
          <Outlet />
        </div>
        <BottomNav />
      </div>
    </SiteSettingsProvider>
  );
}
