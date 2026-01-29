import { cn } from '@/lib/utils';
import { STATUS_LABELS, STATUS_COLORS, type CargoStatus } from '@/types/cargo';

interface CargoStatusBadgeProps {
  status: CargoStatus;
  className?: string;
}

export default function CargoStatusBadge({ status, className }: CargoStatusBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
        STATUS_COLORS[status],
        className
      )}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}
