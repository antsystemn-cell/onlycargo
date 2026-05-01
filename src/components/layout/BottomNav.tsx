import { Link, useLocation } from 'react-router-dom';
import { Home, Package, MapPin, User } from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/', icon: Home, label: 'Нүүр' },
  { href: '/my-cargo', icon: Package, label: 'Миний ачаа' },
  { href: '/china-address', icon: MapPin, label: 'Хятад' },
  { href: '/korea-address', icon: MapPin, label: 'Солонгос' },
  { href: '/profile', icon: User, label: 'Профайл' },
];

export default function BottomNav() {
  const location = useLocation();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-card/95 backdrop-blur-sm pb-safe">
      <div className="mx-auto flex max-w-md">
        {navItems.map((item) => {
          const isActive = location.pathname === item.href;
          return (
            <Link
              key={item.href}
              to={item.href}
              className={cn(
                'flex flex-1 flex-col items-center gap-1 py-3 text-xs transition-all duration-200',
                isActive
                  ? 'text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <div className={cn(
                'rounded-full p-1.5 transition-colors',
                isActive && 'bg-primary/10'
              )}>
                <item.icon className={cn('h-5 w-5', isActive && 'stroke-[2.5px]')} />
              </div>
              <span className={cn('font-medium', isActive && 'font-semibold')}>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
