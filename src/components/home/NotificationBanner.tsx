import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Bell, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Notification } from '@/types/cargo';

export default function NotificationBanner() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchNotifications = async () => {
      const { data } = await supabase
        .from('notifications')
        .select('*')
        .eq('is_global', true)
        .order('created_at', { ascending: false })
        .limit(10);
      
      if (data) {
        setNotifications(data as Notification[]);
      }
    };

    fetchNotifications();
  }, []);

  const scrollToIndex = (index: number) => {
    if (scrollRef.current) {
      const child = scrollRef.current.children[index] as HTMLElement;
      if (child) {
        child.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        setCurrentIndex(index);
      }
    }
  };

  const handleScroll = () => {
    if (scrollRef.current) {
      const scrollLeft = scrollRef.current.scrollLeft;
      const childWidth = scrollRef.current.children[0]?.clientWidth || 0;
      const newIndex = Math.round(scrollLeft / childWidth);
      setCurrentIndex(newIndex);
    }
  };

  if (notifications.length === 0) {
    return null;
  }

  return (
    <div className="bg-gradient-to-r from-primary/10 to-primary/5 border-b border-primary/20">
      <div className="mx-auto max-w-md px-4 py-3">
        <div className="flex items-center gap-2 mb-2">
          <Bell className="h-4 w-4 text-primary" />
          <span className="text-xs font-medium text-primary">Мэдэгдэл</span>
        </div>
        
        <div className="relative">
          {/* Swipeable container */}
          <div 
            ref={scrollRef}
            onScroll={handleScroll}
            className="swipe-notification flex gap-3 -mx-4 px-4"
          >
            {notifications.map((notification, idx) => (
              <div 
                key={notification.id}
                className="min-w-full flex-shrink-0 rounded-lg bg-card p-3 shadow-sm border"
              >
                <p className="font-medium text-sm">{notification.title}</p>
                <p className="text-xs text-muted-foreground mt-1 line-clamp-3">
                  {notification.message}
                </p>
              </div>
            ))}
          </div>

          {/* Navigation */}
          {notifications.length > 1 && (
            <div className="flex items-center justify-center gap-2 mt-3">
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => scrollToIndex(Math.max(0, currentIndex - 1))}
                disabled={currentIndex === 0}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              
              <div className="flex items-center gap-1.5">
                {notifications.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => scrollToIndex(idx)}
                    className={`h-1.5 rounded-full transition-all ${
                      idx === currentIndex 
                        ? 'w-4 bg-primary' 
                        : 'w-1.5 bg-primary/30'
                    }`}
                  />
                ))}
              </div>

              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => scrollToIndex(Math.min(notifications.length - 1, currentIndex + 1))}
                disabled={currentIndex === notifications.length - 1}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
