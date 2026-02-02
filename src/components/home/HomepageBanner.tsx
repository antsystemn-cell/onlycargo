import { Package, Truck, MapPin } from 'lucide-react';
import { useSiteSettings } from '@/hooks/useSiteSettings';

export default function HomepageBanner() {
  const { homepageBanner, isLoading } = useSiteSettings();

  if (isLoading || !homepageBanner.enabled) {
    return null;
  }

  const hasBackgroundImage = !!homepageBanner.backgroundImage;

  return (
    <div 
      className="relative overflow-hidden rounded-2xl border p-6"
      style={{
        background: hasBackgroundImage
          ? `linear-gradient(to right, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0.3) 100%), url(${homepageBanner.backgroundImage}) center/cover`
          : 'linear-gradient(135deg, hsl(var(--primary)/0.1) 0%, hsl(var(--primary)/0.05) 50%, hsl(var(--background)) 100%)'
      }}
    >
      {/* Decorative elements - only show when no background image */}
      {!hasBackgroundImage && (
        <>
          <div className="absolute top-0 right-0 opacity-10">
            <Package className="h-32 w-32 -translate-y-8 translate-x-8" />
          </div>
          <div className="absolute bottom-0 left-0 opacity-10">
            <Truck className="h-24 w-24 translate-y-6 -translate-x-6" />
          </div>
        </>
      )}

      <div className="relative z-10 space-y-2">
        <div 
          className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ${
            hasBackgroundImage 
              ? 'bg-white/20 text-white backdrop-blur-sm' 
              : 'bg-primary/10 text-primary'
          }`}
        >
          <MapPin className="h-3 w-3" />
          Хятад → Монгол
        </div>
        <h2 className={`text-xl font-bold tracking-tight ${hasBackgroundImage ? 'text-white' : ''}`}>
          {homepageBanner.title}
        </h2>
        <p className={`text-sm max-w-sm ${hasBackgroundImage ? 'text-white/90' : 'text-muted-foreground'}`}>
          {homepageBanner.description}
        </p>
      </div>
    </div>
  );
}
