import { Package, Truck, MapPin } from 'lucide-react';
import { useSiteSettings } from '@/hooks/useSiteSettings';

export default function HomepageBanner() {
  const { homepageBanner, isLoading } = useSiteSettings();

  if (isLoading || !homepageBanner.enabled) {
    return null;
  }

  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/10 via-primary/5 to-background border p-6 mb-6">
      {/* Decorative elements */}
      <div className="absolute top-0 right-0 opacity-10">
        <Package className="h-32 w-32 -translate-y-8 translate-x-8" />
      </div>
      <div className="absolute bottom-0 left-0 opacity-10">
        <Truck className="h-24 w-24 translate-y-6 -translate-x-6" />
      </div>

      <div className="relative z-10 space-y-2">
        <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
          <MapPin className="h-3 w-3" />
          Хятад → Монгол
        </div>
        <h2 className="text-xl font-bold tracking-tight">
          {homepageBanner.title}
        </h2>
        <p className="text-sm text-muted-foreground max-w-sm">
          {homepageBanner.description}
        </p>
      </div>
    </div>
  );
}
