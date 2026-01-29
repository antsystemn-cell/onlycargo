import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Bell, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Notification } from '@/types/cargo';

export default function NotificationBanner() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const fetchNotifications = async () => {
      const { data } = await supabase
        .from('notifications')
        .select('*')
        .eq('is_global', true)
        .order('created_at', { ascending: false })
        .limit(5);
      
      if (data) {
        setNotifications(data as Notification[]);
      }
    };

    fetchNotifications();
  }, []);

  if (notifications.length === 0 || dismissed) {
    return null;
  }

  const currentNotification = notifications[currentIndex];

  return (
    <div className="bg-primary/10 border-b border-primary/20">
      <div className="mx-auto flex max-w-md items-center gap-2 px-4 py-2">
        <Bell className="h-4 w-4 shrink-0 text-primary" />
        <div className="flex-1 overflow-hidden">
          <p className="truncate text-sm font-medium">{currentNotification.title}</p>
          <p className="truncate text-xs text-muted-foreground">{currentNotification.message}</p>
        </div>
        {notifications.length > 1 && (
          <div className="flex items-center gap-1">
            {notifications.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentIndex(idx)}
                className={`h-1.5 w-1.5 rounded-full transition-colors ${
                  idx === currentIndex ? 'bg-primary' : 'bg-primary/30'
                }`}
              />
            ))}
          </div>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 shrink-0"
          onClick={() => setDismissed(true)}
        >
          <X className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}
