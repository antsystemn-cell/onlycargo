import { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import type { Banner } from '@/types/cargo';

export default function BannerCarousel() {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const autoPlayRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const fetchBanners = async () => {
      const { data, error } = await supabase
        .from('banners')
        .select('*')
        .eq('is_enabled', true)
        .order('sort_order', { ascending: true });
      
      if (!error && data) {
        setBanners(data as Banner[]);
      }
      setIsLoading(false);
    };

    fetchBanners();
  }, []);

  // Auto-play carousel
  useEffect(() => {
    if (banners.length <= 1) return;

    const startAutoPlay = () => {
      autoPlayRef.current = setInterval(() => {
        setCurrentIndex((prev) => (prev + 1) % banners.length);
      }, 5000);
    };

    startAutoPlay();

    return () => {
      if (autoPlayRef.current) {
        clearInterval(autoPlayRef.current);
      }
    };
  }, [banners.length]);

  // Scroll to current index
  useEffect(() => {
    if (scrollRef.current && banners.length > 0) {
      const child = scrollRef.current.children[currentIndex] as HTMLElement;
      if (child) {
        child.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
    }
  }, [currentIndex, banners.length]);

  const handleScroll = () => {
    if (scrollRef.current) {
      const scrollLeft = scrollRef.current.scrollLeft;
      const childWidth = scrollRef.current.children[0]?.clientWidth || 0;
      if (childWidth > 0) {
        const newIndex = Math.round(scrollLeft / childWidth);
        if (newIndex !== currentIndex && newIndex >= 0 && newIndex < banners.length) {
          setCurrentIndex(newIndex);
        }
      }
    }
  };

  const goToSlide = (index: number) => {
    setCurrentIndex(index);
    // Reset autoplay timer
    if (autoPlayRef.current) {
      clearInterval(autoPlayRef.current);
      autoPlayRef.current = setInterval(() => {
        setCurrentIndex((prev) => (prev + 1) % banners.length);
      }, 5000);
    }
  };

  if (isLoading) {
    return (
      <div className="h-40 rounded-2xl bg-muted animate-pulse" />
    );
  }

  if (banners.length === 0) {
    return null;
  }

  return (
    <div className="relative">
      {/* Swipeable container */}
      <div 
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex gap-4 overflow-x-auto snap-x snap-mandatory scrollbar-hide -mx-4 px-4"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {banners.map((banner, idx) => (
          <div 
            key={banner.id}
            className="min-w-full flex-shrink-0 snap-center"
          >
            <div 
              className="relative h-40 rounded-2xl overflow-hidden border shadow-sm"
              style={{
                background: banner.image_url 
                  ? `linear-gradient(to right, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0.3) 100%), url(${banner.image_url}) center/cover`
                  : 'linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(var(--primary)/0.7) 100%)'
              }}
            >
              <div className="absolute inset-0 p-4 flex flex-col justify-end text-white">
                <h3 className="font-bold text-lg mb-1 drop-shadow-md line-clamp-1">
                  {banner.title}
                </h3>
                {banner.description && (
                  <p className="text-sm text-white/90 line-clamp-2 drop-shadow-sm">
                    {banner.description}
                  </p>
                )}
                {banner.link_url && (
                  <a 
                    href={banner.link_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-white/90 hover:text-white transition-colors"
                  >
                    Дэлгэрэнгүй <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Navigation arrows */}
      {banners.length > 1 && (
        <>
          <Button
            variant="secondary"
            size="icon"
            className="absolute left-1 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full shadow-md opacity-80 hover:opacity-100"
            onClick={() => goToSlide((currentIndex - 1 + banners.length) % banners.length)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="secondary"
            size="icon"
            className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full shadow-md opacity-80 hover:opacity-100"
            onClick={() => goToSlide((currentIndex + 1) % banners.length)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </>
      )}

      {/* Dots indicator */}
      {banners.length > 1 && (
        <div className="flex items-center justify-center gap-1.5 mt-3">
          {banners.map((_, idx) => (
            <button
              key={idx}
              onClick={() => goToSlide(idx)}
              className={`h-1.5 rounded-full transition-all ${
                idx === currentIndex 
                  ? 'w-4 bg-primary' 
                  : 'w-1.5 bg-primary/30 hover:bg-primary/50'
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
