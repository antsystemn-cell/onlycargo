import { useState } from 'react';
import { format } from 'date-fns';
import { Check, Circle, ImageIcon, X } from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { STATUS_LABELS, STATUS_ORDER, type CargoStatus, type CargoStatusHistory, type CargoPhoto } from '@/types/cargo';

interface CargoTimelineProps {
  statusHistory: CargoStatusHistory[];
  photos: CargoPhoto[];
  currentStatus: CargoStatus;
  statusDate: string;
}

export default function CargoTimeline({ statusHistory, photos, currentStatus, statusDate }: CargoTimelineProps) {
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

  // Build timeline from status history or fallback to current status
  const getTimelineItems = () => {
    if (statusHistory.length > 0) {
      return statusHistory.map((item) => ({
        status: item.status,
        date: item.created_at,
        notes: item.notes,
        isCompleted: true,
      }));
    }

    // Fallback: show current status only
    const currentIndex = STATUS_ORDER.indexOf(currentStatus);
    return STATUS_ORDER.slice(0, currentIndex + 1).map((status, idx) => ({
      status,
      date: idx === currentIndex ? statusDate : null,
      notes: null,
      isCompleted: true,
    }));
  };

  const timelineItems = getTimelineItems();

  // Get photos for a specific status/time
  const getPhotosForStatus = (statusDate: string | null) => {
    if (!statusDate) return [];
    const statusTime = new Date(statusDate).getTime();
    return photos.filter((photo) => {
      const photoTime = new Date(photo.created_at).getTime();
      // Show photos within 24 hours of status change
      return Math.abs(photoTime - statusTime) < 24 * 60 * 60 * 1000;
    });
  };

  // Group remaining photos that don't match any status
  const getUnmatchedPhotos = () => {
    const matchedPhotoIds = new Set<string>();
    timelineItems.forEach((item) => {
      getPhotosForStatus(item.date).forEach((p) => matchedPhotoIds.add(p.id));
    });
    return photos.filter((p) => !matchedPhotoIds.has(p.id));
  };

  const unmatchedPhotos = getUnmatchedPhotos();

  return (
    <div className="relative">
      {/* Lightbox */}
      <Dialog open={!!lightboxImage} onOpenChange={() => setLightboxImage(null)}>
        <DialogContent className="max-w-3xl p-0 bg-black/90">
          <button 
            onClick={() => setLightboxImage(null)}
            className="absolute top-2 right-2 z-10 p-2 rounded-full bg-black/50 text-white hover:bg-black/70"
          >
            <X className="h-5 w-5" />
          </button>
          {lightboxImage && (
            <img 
              src={lightboxImage} 
              alt="Cargo photo" 
              className="w-full h-auto max-h-[80vh] object-contain"
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Timeline */}
      <div className="space-y-0">
        {timelineItems.length === 0 ? (
          <div className="text-center py-4 text-muted-foreground text-sm">
            Статусын түүх байхгүй
          </div>
        ) : (
          timelineItems.map((item, idx) => {
            const isLast = idx === timelineItems.length - 1;
            const statusPhotos = getPhotosForStatus(item.date);

            return (
              <div key={`${item.status}-${idx}`} className="relative flex gap-3">
                {/* Timeline line and dot */}
                <div className="flex flex-col items-center">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
                    isLast 
                      ? 'bg-primary text-primary-foreground' 
                      : 'bg-primary/20 text-primary'
                  }`}>
                    {isLast ? (
                      <Circle className="h-3 w-3 fill-current" />
                    ) : (
                      <Check className="h-3 w-3" />
                    )}
                  </div>
                  {!isLast && (
                    <div className="w-0.5 flex-1 min-h-[40px] bg-primary/20" />
                  )}
                </div>

                {/* Content */}
                <div className={`pb-4 flex-1 ${isLast ? '' : ''}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className={`font-medium text-sm ${isLast ? 'text-primary' : ''}`}>
                        {STATUS_LABELS[item.status]}
                      </p>
                      {item.date && (
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(item.date), 'yyyy.MM.dd HH:mm')}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Notes */}
                  {item.notes && (
                    <p className="mt-1 text-xs text-muted-foreground bg-muted/50 p-2 rounded">
                      {item.notes}
                    </p>
                  )}

                  {/* Photos for this status */}
                  {statusPhotos.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {statusPhotos.map((photo) => (
                        <button
                          key={photo.id}
                          onClick={() => setLightboxImage(photo.photo_url)}
                          className="relative group"
                        >
                          <img
                            src={photo.photo_url}
                            alt="Cargo"
                            className="w-16 h-16 object-cover rounded-lg border hover:border-primary transition-colors"
                          />
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 rounded-lg transition-colors flex items-center justify-center">
                            <ImageIcon className="h-4 w-4 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            {format(new Date(photo.created_at), 'MM.dd HH:mm')}
                          </p>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}

        {/* Unmatched photos section */}
        {unmatchedPhotos.length > 0 && (
          <div className="pt-2 border-t">
            <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
              <ImageIcon className="h-3 w-3" />
              Бусад зургууд
            </p>
            <div className="flex flex-wrap gap-2">
              {unmatchedPhotos.map((photo) => (
                <button
                  key={photo.id}
                  onClick={() => setLightboxImage(photo.photo_url)}
                  className="relative group"
                >
                  <img
                    src={photo.photo_url}
                    alt="Cargo"
                    className="w-16 h-16 object-cover rounded-lg border hover:border-primary transition-colors"
                  />
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {format(new Date(photo.created_at), 'MM.dd HH:mm')}
                  </p>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
