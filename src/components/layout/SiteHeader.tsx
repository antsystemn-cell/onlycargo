import { Link, useNavigate } from 'react-router-dom';
import { Package, LogIn, MapPin, Calculator, User, Menu, Home as HomeIcon, Wallet, Settings, LogOut } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetClose } from '@/components/ui/sheet';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import logoAsset from '@/assets/onlycargo-logo.png.asset.json';

const logoUrl = logoAsset.url;

export default function SiteHeader() {
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-40 border-b bg-card/95 backdrop-blur-sm px-4 py-3">
      <div className="relative mx-auto flex max-w-md items-center justify-center">
        <Link to="/" aria-label="Нүүр хуудас" className="flex items-center transition hover:opacity-80">
          <img src={logoUrl} alt="OnlyCargo" className="h-10 w-auto object-contain" />
        </Link>
        <div className="absolute left-0 flex items-center">
          <Sheet>
            <SheetTrigger asChild>
              <button
                aria-label="Цэс"
                className="flex h-10 w-10 items-center justify-center rounded-full border bg-muted text-muted-foreground transition hover:bg-accent hover:text-accent-foreground"
              >
                <Menu className="h-5 w-5" />
              </button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72">
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  <img src={logoUrl} alt="" className="h-7 w-7 object-contain" />
                  OnlyCargo
                </SheetTitle>
              </SheetHeader>
              <nav className="mt-6 flex flex-col gap-1">
                {[
                  { to: '/', label: 'Нүүр', icon: HomeIcon },
                  { to: user ? '/my-cargo' : '/auth', label: 'Миний ачаа', icon: Package },
                  { to: '/china-address', label: 'Хятад хаяг', icon: MapPin },
                  { to: '/korea-address', label: 'Солонгос хаяг', icon: MapPin },
                  { to: '/calculator', label: 'Тооцоолуур', icon: Calculator },
                  ...(user ? [
                    { to: '/profile', label: 'Профайл', icon: User },
                    { to: '/wallet', label: 'Хэтэвч', icon: Wallet },
                  ] : []),
                  ...(isAdmin ? [{ to: '/admin', label: 'Админ', icon: Settings }] : []),
                ].map((item) => {
                  const Icon = item.icon;
                  return (
                    <SheetClose asChild key={item.to + item.label}>
                      <Link
                        to={item.to}
                        className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-foreground transition hover:bg-accent"
                      >
                        <Icon className="h-4 w-4 text-muted-foreground" />
                        {item.label}
                      </Link>
                    </SheetClose>
                  );
                })}
                {user ? (
                  <SheetClose asChild>
                    <button
                      onClick={async () => { await supabase.auth.signOut(); navigate('/'); }}
                      className="mt-2 flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-destructive transition hover:bg-destructive/10"
                    >
                      <LogOut className="h-4 w-4" />
                      Гарах
                    </button>
                  </SheetClose>
                ) : (
                  <SheetClose asChild>
                    <Link
                      to="/auth"
                      className="mt-2 flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-primary transition hover:bg-primary/10"
                    >
                      <LogIn className="h-4 w-4" />
                      Нэвтрэх
                    </Link>
                  </SheetClose>
                )}
              </nav>
            </SheetContent>
          </Sheet>
        </div>
        <div className="absolute right-0 flex items-center">
          <button
            onClick={() => navigate(user ? '/profile' : '/auth')}
            aria-label={user ? 'Профайл' : 'Нэвтрэх'}
            className="flex h-10 w-10 items-center justify-center rounded-full border bg-muted text-muted-foreground transition hover:bg-accent hover:text-accent-foreground"
          >
            <User className="h-5 w-5" />
          </button>
        </div>
      </div>
    </header>
  );
}
