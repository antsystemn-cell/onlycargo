import { useState } from 'react';
import { Pencil, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

interface Dimensions {
  length: number | null;
  width: number | null;
  height: number | null;
}

interface InlineEditableDimensionsProps {
  dimensions: Dimensions;
  onSave: (dimensions: Dimensions) => Promise<void>;
  className?: string;
  disabled?: boolean;
}

export function InlineEditableDimensions({
  dimensions,
  onSave,
  className,
  disabled = false,
}: InlineEditableDimensionsProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editDimensions, setEditDimensions] = useState<Dimensions>(dimensions);
  const [isSaving, setIsSaving] = useState(false);

  const handleStartEdit = () => {
    if (disabled) return;
    setEditDimensions(dimensions);
    setIsEditing(true);
  };

  const handleCancel = () => {
    setEditDimensions(dimensions);
    setIsEditing(false);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(editDimensions);
      setIsEditing(false);
    } catch (error) {
      console.error('Save failed:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      handleCancel();
    }
  };

  const formatDimensions = () => {
    const { length, width, height } = dimensions;
    if (!length && !width && !height) return '-';
    return `${length || 0}×${width || 0}×${height || 0}`;
  };

  const handleChange = (field: keyof Dimensions, value: string) => {
    const numValue = value === '' ? null : parseFloat(value);
    setEditDimensions(prev => ({
      ...prev,
      [field]: isNaN(numValue as number) ? null : numValue,
    }));
  };

  // Display mode
  if (!isEditing) {
    return (
      <div 
        className={cn(
          "group flex items-center gap-1 cursor-pointer hover:bg-muted/50 rounded px-1 py-0.5 -mx-1 transition-colors",
          disabled && "cursor-default hover:bg-transparent",
          className
        )}
        onClick={handleStartEdit}
      >
        <span className={cn(
          "truncate text-xs",
          (!dimensions.length && !dimensions.width && !dimensions.height) && "text-muted-foreground"
        )}>
          {formatDimensions()}
        </span>
        {!disabled && (
          <Pencil className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
        )}
      </div>
    );
  }

  // Edit mode
  return (
    <div className="space-y-2 p-2 bg-muted/30 rounded-md">
      <div className="grid grid-cols-3 gap-1">
        <div className="space-y-1">
          <Label className="text-[10px] text-muted-foreground">Урт</Label>
          <Input
            type="number"
            value={editDimensions.length ?? ''}
            onChange={(e) => handleChange('length', e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isSaving}
            className="h-6 text-xs"
            placeholder="0"
            min={0}
            step={0.1}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-[10px] text-muted-foreground">Өргөн</Label>
          <Input
            type="number"
            value={editDimensions.width ?? ''}
            onChange={(e) => handleChange('width', e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isSaving}
            className="h-6 text-xs"
            placeholder="0"
            min={0}
            step={0.1}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-[10px] text-muted-foreground">Өндөр</Label>
          <Input
            type="number"
            value={editDimensions.height ?? ''}
            onChange={(e) => handleChange('height', e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isSaving}
            className="h-6 text-xs"
            placeholder="0"
            min={0}
            step={0.1}
          />
        </div>
      </div>
      <div className="flex gap-1 justify-end">
        <Button
          size="sm"
          variant="ghost"
          className="h-6 px-2 text-xs"
          onClick={handleSave}
          disabled={isSaving}
        >
          <Check className="h-3 w-3 mr-1 text-green-600" />
          Хадгалах
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-6 px-2 text-xs"
          onClick={handleCancel}
          disabled={isSaving}
        >
          <X className="h-3 w-3 mr-1" />
          Болих
        </Button>
      </div>
    </div>
  );
}
