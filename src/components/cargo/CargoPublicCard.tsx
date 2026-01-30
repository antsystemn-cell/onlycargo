import { format } from 'date-fns';
import { Package } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import CargoStatusBadge from './CargoStatusBadge';
import type { CargoPublic } from '@/types/cargo';

interface CargoPublicCardProps {
  cargo: CargoPublic;
}

export default function CargoPublicCard({ cargo }: CargoPublicCardProps) {
  if (!cargo.track_number || !cargo.status) {
    return null;
  }

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-2">
                <Package className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="font-mono text-sm font-medium truncate">
                  {cargo.track_number}
                </span>
              </div>
              <CargoStatusBadge status={cargo.status} />
            </div>

            <div className="mt-2 flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                {cargo.status_date && format(new Date(cargo.status_date), 'yyyy.MM.dd')}
              </span>
              <span className="text-xs text-muted-foreground">
                Нэвтэрч дэлгэрэнгүй харах
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
