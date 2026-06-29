import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { MapPin, Truck, RefreshCw, AlertCircle, Clock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';

interface TrackingEvent {
  id: string;
  event_time: string | null;
  event_time_raw: string | null;
  description: string | null;
  location: string | null;
  stage: string | null;
  provider_name: string | null;
  country: string | null;
  city: string | null;
}

interface Props {
  trackingNumber: string;
  cargoId?: string | null;
  preregistrationId?: string | null;
  carrier?: number | null;
  status17?: string | null;
  lastSyncAt?: string | null;
  latestEventDescription?: string | null;
  latestEventLocation?: string | null;
  latestEventTime?: string | null;
  registered?: boolean;
  registerError?: string | null;
  allowSync?: boolean;
}

const STATUS_LABELS: Record<string, { label: string; tone: string }> = {
  tracking_not_found: { label: 'Мэдээлэл олдсонгүй', tone: 'bg-muted text-muted-foreground' },
  china_info_received: { label: 'Тээврийн мэдээлэл үүссэн', tone: 'bg-blue-100 text-blue-700' },
  china_in_transit: { label: 'Замд явж байна', tone: 'bg-amber-100 text-amber-700' },
  china_tracking_expired: { label: 'Удаан шинэчлэгдээгүй', tone: 'bg-gray-100 text-gray-700' },
  china_tracking_exception: { label: 'Тээврийн асуудал гарсан', tone: 'bg-red-100 text-red-700' },
  possible_china_delivered: { label: 'Хүргэгдсэн байж магадгүй', tone: 'bg-emerald-100 text-emerald-700' },
  possible_ereen_ready_or_pickup: { label: 'Хүлээн авах цэг дээр ирсэн байж магадгүй', tone: 'bg-emerald-100 text-emerald-700' },
  china_out_for_delivery: { label: 'Хүргэлтэнд гарсан', tone: 'bg-cyan-100 text-cyan-700' },
  china_delivery_failure: { label: 'Хүргэлт амжилтгүй', tone: 'bg-red-100 text-red-700' },
  TRACKING_STOPPED: { label: 'Хяналт зогссон', tone: 'bg-gray-200 text-gray-700' },
  Registered: { label: 'Бүртгэгдсэн', tone: 'bg-blue-100 text-blue-700' },
};

function composeLocation(ev: { location?: string | null; city?: string | null; state?: string | null; country?: string | null }) {
  if (ev.location) return ev.location;
  const parts = [ev.city, ev.state, ev.country].filter(Boolean) as string[];
  return parts.length > 0 ? parts.join(', ') : null;
}

export default function ChinaTrackingTimeline(props: Props) {
  const {
    trackingNumber,
    cargoId,
    preregistrationId,
    carrier,
    status17,
    lastSyncAt,
    latestEventDescription,
    latestEventLocation,
    latestEventTime,
    registered,
    registerError,
    allowSync = true,
  } = props;

  const [events, setEvents] = useState<TrackingEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const fetchEvents = async () => {
    setLoading(true);
    let query = supabase
      .from('tracking_events')
      .select('id,event_time,event_time_raw,description,location,stage,provider_name,country,city')
      .eq('tracking_number', trackingNumber)
      .order('event_time', { ascending: false, nullsFirst: false });
    const { data } = await query;
    setEvents((data as TrackingEvent[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchEvents();
  }, [trackingNumber]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const { error } = await supabase.functions.invoke('sync-17track', {
        body: {
          tracking_number: trackingNumber,
          carrier,
          cargo_id: cargoId,
          preregistration_id: preregistrationId,
        },
      });
      if (error) throw error;
      await fetchEvents();
      toast({ title: 'Шинэчлэгдлээ' });
    } catch (e: any) {
      toast({ title: 'Алдаа', description: e.message, variant: 'destructive' });
    } finally {
      setSyncing(false);
    }
  };

  const statusInfo = status17 ? STATUS_LABELS[status17] : null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Truck className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">Хятад дахь тээврийн явц</h3>
        </div>
        {allowSync && registered && (
          <Button size="sm" variant="ghost" onClick={handleSync} disabled={syncing}>
            <RefreshCw className={`h-3.5 w-3.5 mr-1 ${syncing ? 'animate-spin' : ''}`} />
            Шинэчлэх
          </Button>
        )}
      </div>

      {/* Header status card */}
      {registerError ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm flex gap-2">
          <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-destructive">Бүртгэхэд алдаа гарлаа</p>
            <p className="text-xs text-muted-foreground mt-0.5">{registerError}</p>
          </div>
        </div>
      ) : !registered ? (
        <div className="rounded-lg bg-muted/50 p-3 text-sm flex items-center gap-2">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <span>Тээврийн мэдээлэл шалгаж байна...</span>
        </div>
      ) : (
        <div className="rounded-lg border bg-card p-3 space-y-2">
          {statusInfo && (
            <Badge className={`${statusInfo.tone} border-0 font-normal`}>{statusInfo.label}</Badge>
          )}
          {latestEventDescription ? (
            <div>
              <p className="text-xs text-muted-foreground">Сүүлийн шинэчлэлт</p>
              <p className="text-sm font-medium">{latestEventDescription}</p>
              {latestEventLocation && (
                <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                  <MapPin className="h-3 w-3" /> {latestEventLocation}
                </p>
              )}
              {latestEventTime && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  {format(new Date(latestEventTime), 'yyyy.MM.dd HH:mm')}
                </p>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Одоогоор tracking мэдээлэл хараахан ирээгүй байна.
            </p>
          )}
          {lastSyncAt && (
            <p className="text-[11px] text-muted-foreground">
              Сүүлд шалгасан: {format(new Date(lastSyncAt), 'MM.dd HH:mm')}
            </p>
          )}
        </div>
      )}

      {/* Timeline */}
      {loading ? (
        <div className="flex justify-center py-4">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : events.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-3">
          Одоогоор event бүртгэгдээгүй
        </p>
      ) : (
        <div className="space-y-0">
          {events.map((ev, idx) => {
            const isFirst = idx === 0;
            const isLast = idx === events.length - 1;
            return (
              <div key={ev.id} className="relative flex gap-3">
                <div className="flex flex-col items-center">
                  <div
                    className={`w-2.5 h-2.5 rounded-full shrink-0 mt-1.5 ${
                      isFirst ? 'bg-primary ring-4 ring-primary/20' : 'bg-muted-foreground/40'
                    }`}
                  />
                  {!isLast && <div className="w-0.5 flex-1 bg-border min-h-[36px]" />}
                </div>
                <div className="pb-3 flex-1 min-w-0">
                  <p className={`text-sm ${isFirst ? 'font-medium' : ''}`}>
                    {ev.description || '—'}
                  </p>
                  <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground mt-0.5">
                    {ev.event_time && (
                      <span>{format(new Date(ev.event_time), 'yyyy.MM.dd HH:mm')}</span>
                    )}
                    {ev.location && (
                      <span className="flex items-center gap-0.5">
                        <MapPin className="h-2.5 w-2.5" /> {ev.location}
                      </span>
                    )}
                    {ev.provider_name && <span>· {ev.provider_name}</span>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
