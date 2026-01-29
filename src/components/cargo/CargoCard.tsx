import { format } from 'date-fns';
import { Package, Scale, Ruler } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import CargoStatusBadge from './CargoStatusBadge';
import type { Cargo } from '@/types/cargo';

interface CargoCardProps {
  cargo: Cargo;
  showPrice?: boolean;
  showCheckbox?: boolean;
  selected?: boolean;
  onSelect?: (id: string, selected: boolean) => void;
}

export default function CargoCard({
  cargo,
  showPrice = true,
  showCheckbox = false,
  selected = false,
  onSelect,
}: CargoCardProps) {
  const volumetricWeight =
    cargo.length && cargo.width && cargo.height
      ? (cargo.length * cargo.width * cargo.height) / 5000
      : null;

  const formatSize = () => {
    if (cargo.length && cargo.width && cargo.height) {
      return `${cargo.length}×${cargo.width}×${cargo.height} см`;
    }
    return '-';
  };

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          {showCheckbox && (
            <Checkbox
              checked={selected}
              onCheckedChange={(checked) => onSelect?.(cargo.id, checked as boolean)}
              className="mt-1"
            />
          )}
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

            <div className="grid grid-cols-2 gap-2 text-sm text-muted-foreground">
              {cargo.weight && (
                <div className="flex items-center gap-1">
                  <Scale className="h-3 w-3" />
                  <span>{cargo.weight} кг</span>
                </div>
              )}
              <div className="flex items-center gap-1">
                <Ruler className="h-3 w-3" />
                <span>{formatSize()}</span>
              </div>
            </div>

            <div className="mt-2 flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                {format(new Date(cargo.status_date), 'yyyy.MM.dd')}
              </span>
              {showPrice && cargo.price && (
                <span className="font-semibold text-primary">
                  {cargo.price.toLocaleString()}₮
                </span>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
