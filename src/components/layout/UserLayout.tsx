import { Outlet } from 'react-router-dom';
import { SiteSettingsProvider } from '@/hooks/useSiteSettings';
import { SeoHead } from '@/components/seo/SeoHead';
import SiteHeader from '@/components/layout/SiteHeader';

export default function UserLayout() {
  return (
    <SiteSettingsProvider>
      <SeoHead />
      <div className="flex min-h-screen flex-col bg-background">
        <SiteHeader />
        <div className="flex-1">
          <Outlet />
        </div>
      </div>
    </SiteSettingsProvider>
  );
}
