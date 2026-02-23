import { Globe, ExternalLink } from 'lucide-react';

interface SeoPreviewProps {
  title: string;
  description: string;
  url?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
}

export function GooglePreview({ title, description, url = 'onlycargo.lovable.app' }: SeoPreviewProps) {
  const displayTitle = title || 'Хуудасны гарчиг';
  const displayDesc = description || 'Мета тайлбар энд харагдана...';
  const truncatedTitle = displayTitle.length > 60 ? displayTitle.slice(0, 57) + '...' : displayTitle;
  const truncatedDesc = displayDesc.length > 160 ? displayDesc.slice(0, 157) + '...' : displayDesc;

  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
        <Globe className="h-3 w-3" /> Google хайлтын үр дүн
      </p>
      <div className="rounded-lg border bg-card p-3 space-y-1">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <div className="h-4 w-4 rounded-full bg-primary/20 flex items-center justify-center">
            <span className="text-[8px] font-bold text-primary">O</span>
          </div>
          {url}
        </div>
        <p className="text-base text-primary font-medium leading-tight hover:underline cursor-pointer">
          {truncatedTitle}
        </p>
        <p className="text-xs text-muted-foreground leading-relaxed">{truncatedDesc}</p>
      </div>
    </div>
  );
}

export function SocialPreview({ title, description, ogTitle, ogDescription, ogImage, url = 'onlycargo.lovable.app' }: SeoPreviewProps) {
  const displayTitle = ogTitle || title || 'Хуудасны гарчиг';
  const displayDesc = ogDescription || description || 'Тайлбар энд харагдана...';

  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
        <ExternalLink className="h-3 w-3" /> Сошиал хуваалцах preview
      </p>
      <div className="rounded-lg border bg-card overflow-hidden">
        <div className="h-28 bg-muted flex items-center justify-center overflow-hidden">
          {ogImage ? (
            <img src={ogImage} alt="OG Preview" className="w-full h-full object-cover" />
          ) : (
            <span className="text-3xl font-bold text-muted-foreground/30">OG Image</span>
          )}
        </div>
        <div className="p-3 space-y-0.5 border-t">
          <p className="text-[10px] text-muted-foreground uppercase">{url}</p>
          <p className="text-sm font-semibold leading-tight">{displayTitle}</p>
          <p className="text-xs text-muted-foreground line-clamp-2">{displayDesc}</p>
        </div>
      </div>
    </div>
  );
}
