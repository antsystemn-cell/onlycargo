import { Link } from 'react-router-dom';
import { Calculator, Search, MapPin, Package, Truck, Warehouse } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { useSiteSettings } from '@/hooks/useSiteSettings';

const iconMap: Record<string, React.ElementType> = {
  calculator: Calculator,
  search: Search,
  'map-pin': MapPin,
  package: Package,
  truck: Truck,
  warehouse: Warehouse,
};

const linkMap: Record<string, string> = {
  calculator: '/calculator',
  tracking: '/',
  address: '/china-address',
  'china-address': '/china-address',
  'korea-address': '/korea-address',
};

export default function HomepageWidgets() {
  const { homepageWidgets, isLoading } = useSiteSettings();

  if (isLoading) {
    return null;
  }

  const enabledWidgets = homepageWidgets.filter(w => w.enabled);

  if (enabledWidgets.length === 0) {
    return null;
  }

  return (
    <div className="grid grid-cols-3 gap-3 mb-6">
      {enabledWidgets.map((widget) => {
        const Icon = iconMap[widget.icon] || Package;
        const link = linkMap[widget.id] || '/';

        return (
          <Link key={widget.id} to={link}>
            <Card className="h-full transition-all hover:shadow-md hover:border-primary/50 hover:-translate-y-0.5">
              <CardContent className="p-4 flex flex-col items-center justify-center text-center gap-2">
                <div className="rounded-full bg-primary/10 p-3">
                  <Icon className="h-5 w-5 text-primary" />
                </div>
                <span className="text-xs font-medium">{widget.title}</span>
              </CardContent>
            </Card>
          </Link>
        );
      })}
    </div>
  );
}
