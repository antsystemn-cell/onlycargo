import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { X, Package, Scale, Ruler, MapPin, Calendar, ImageIcon, ZoomIn } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import CargoStatusBadge from './CargoStatusBadge';
import CargoTimeline from './CargoTimeline';
import ChinaTrackingTimeline from './ChinaTrackingTimeline';
import type { Cargo, CargoStatusHistory, CargoPhoto } from '@/types/cargo';

interface CargoDetailModalProps {
  cargo: Cargo | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function CargoDetailModal({ cargo, open, onOpenChange }: CargoDetailModalProps) {
  const [statusHistory, setStatusHistory] = useState<CargoStatusHistory[]>([]);
  const [photos, setPhotos] = useState<CargoPhoto[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (cargo && open) {
      fetchCargoDetails();
    }
  }, [cargo, open]);

  const fetchCargoDetails = async () => {
    if (!cargo) return;
    
    setIsLoading(true);
    try {
      const [historyRes, photosRes] = await Promise.all([
        supabase
          .from('cargo_status_history')
          .select('*')
          .eq('cargo_id', cargo.id)
          .order('created_at', { ascending: true }),
        supabase
          .from('cargo_photos')
          .select('*')
          .eq('cargo_id', cargo.id)
          .order('created_at', { ascending: true }),
      ]);

      if (historyRes.data) {
        setStatusHistory(historyRes.data.map(item => ({
          ...item,
          status: item.status as Cargo['status'],
        })));
      }
      if (photosRes.data) {
        setPhotos(photosRes.data);
      }
    } catch (error) {
      console.error('Failed to fetch cargo details:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatSize = () => {
    if (cargo?.length && cargo?.width && cargo?.height) {
      return `${cargo.length}×${cargo.width}×${cargo.height} см`;
    }
    return '-';
  };

  if (!cargo) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] p-0">
        <DialogHeader className="p-4 pb-2 border-b">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <Package className="h-5 w-5 text-primary" />
              Ачааны дэлгэрэнгүй
            </DialogTitle>
          </div>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(90vh-80px)]">
          <div className="p-4 space-y-4">
            {/* Header Info */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Трак дугаар</p>
                <p className="font-mono font-semibold">{cargo.track_number}</p>
              </div>
              <CargoStatusBadge status={cargo.status} />
            </div>

            {/* Details Grid */}
            <div className="grid grid-cols-2 gap-3">
              {cargo.weight && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
                  <Scale className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Жин</p>
                    <p className="font-medium">{cargo.weight} кг</p>
                  </div>
                </div>
              )}
              <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
                <Ruler className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Хэмжээ</p>
                  <p className="font-medium">{formatSize()}</p>
                </div>
              </div>
              {cargo.shelf_location && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Байршил</p>
                    <p className="font-medium">{cargo.shelf_location}</p>
                  </div>
                </div>
              )}
              <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Бүртгэсэн</p>
                  <p className="font-medium">{format(new Date(cargo.created_at), 'MM.dd')}</p>
                </div>
              </div>
            </div>

            {/* Price */}
            {cargo.price && (
              <div className="flex items-center justify-between p-4 rounded-lg bg-primary/5 border border-primary/20">
                <span className="text-muted-foreground">Төлбөр</span>
                <span className="text-xl font-bold text-primary">
                  {cargo.price.toLocaleString()}₮
                </span>
              </div>
            )}

            {/* Notes */}
            {cargo.notes && (
              <div className="p-3 rounded-lg bg-muted/50">
                <p className="text-xs text-muted-foreground mb-1">Тэмдэглэл</p>
                <p className="text-sm">{cargo.notes}</p>
              </div>
            )}

            {/* Status Timeline */}
            <div className="pt-2">
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Статусын түүх
              </h3>
              {isLoading ? (
                <div className="flex justify-center py-4">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                </div>
              ) : (
                <CargoTimeline 
                  statusHistory={statusHistory} 
                  photos={photos}
                  currentStatus={cargo.status}
                  statusDate={cargo.status_date}
                />
              )}
            </div>

            {/* China 17TRACK timeline */}
            {cargo.track_number && (
              <div className="pt-4 border-t">
                <ChinaTrackingTimeline
                  trackingNumber={cargo.track_number}
                  cargoId={cargo.id}
                  carrier={(cargo as any).tracking_carrier ?? null}
                  status17={(cargo as any).tracking_status_17track ?? null}
                  lastSyncAt={(cargo as any).tracking_last_sync_at ?? null}
                  latestEventDescription={(cargo as any).tracking_latest_event_description ?? null}
                  latestEventLocation={(cargo as any).tracking_latest_event_location ?? null}
                  latestEventTime={(cargo as any).tracking_latest_event_time ?? null}
                  registered={(cargo as any).tracking_registered ?? false}
                  registerError={(cargo as any).tracking_register_error ?? null}
                />
              </div>
            )}
          </div>

        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
