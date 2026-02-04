import { useState, useRef, useEffect } from 'react';
import { Pencil, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

interface InlineEditableCellProps {
  value: string | number | null;
  onSave: (value: string | number | null) => Promise<void>;
  type?: 'text' | 'number' | 'select' | 'textarea';
  options?: { value: string; label: string }[];
  placeholder?: string;
  suffix?: string;
  className?: string;
  displayValue?: string;
  minValue?: number;
  maxValue?: number;
  step?: number;
  disabled?: boolean;
}

export function InlineEditableCell({
  value,
  onSave,
  type = 'text',
  options = [],
  placeholder = '-',
  suffix = '',
  className,
  displayValue,
  minValue,
  maxValue,
  step = 1,
  disabled = false,
}: InlineEditableCellProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState<string>(String(value ?? ''));
  const [isSaving, setIsSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isEditing) {
      if (type === 'textarea' && textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.select();
      } else if (inputRef.current) {
        inputRef.current.focus();
        inputRef.current.select();
      }
    }
  }, [isEditing, type]);

  const handleStartEdit = () => {
    if (disabled) return;
    setEditValue(String(value ?? ''));
    setIsEditing(true);
  };

  const handleCancel = () => {
    setEditValue(String(value ?? ''));
    setIsEditing(false);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      let saveValue: string | number | null = editValue;
      
      if (type === 'number') {
        if (editValue === '' || editValue === null) {
          saveValue = null;
        } else {
          saveValue = parseFloat(editValue);
          if (isNaN(saveValue)) saveValue = null;
        }
      } else if (editValue === '') {
        saveValue = null;
      }

      await onSave(saveValue);
      setIsEditing(false);
    } catch (error) {
      console.error('Save failed:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && type !== 'textarea') {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      handleCancel();
    }
  };

  const handleSelectChange = async (newValue: string) => {
    setEditValue(newValue);
    setIsSaving(true);
    try {
      await onSave(newValue);
      setIsEditing(false);
    } catch (error) {
      console.error('Save failed:', error);
    } finally {
      setIsSaving(false);
    }
  };

  // Display mode
  if (!isEditing) {
    const display = displayValue ?? (value !== null && value !== undefined && value !== '' 
      ? `${value}${suffix}` 
      : placeholder);

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
          "truncate",
          (value === null || value === undefined || value === '') && "text-muted-foreground"
        )}>
          {display}
        </span>
        {!disabled && (
          <Pencil className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
        )}
      </div>
    );
  }

  // Edit mode
  return (
    <div className="flex items-center gap-1">
      {type === 'select' ? (
        <Select 
          value={editValue} 
          onValueChange={handleSelectChange}
          disabled={isSaving}
        >
          <SelectTrigger className="h-7 text-xs min-w-[100px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {options.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : type === 'textarea' ? (
        <Textarea
          ref={textareaRef}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isSaving}
          className="h-16 text-xs min-w-[120px]"
          placeholder={placeholder}
        />
      ) : (
        <Input
          ref={inputRef}
          type={type}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isSaving}
          className="h-7 text-xs min-w-[60px] w-auto"
          placeholder={placeholder}
          min={minValue}
          max={maxValue}
          step={step}
        />
      )}
      
      {type !== 'select' && (
        <div className="flex gap-0.5">
          <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6"
            onClick={handleSave}
            disabled={isSaving}
          >
            <Check className="h-3 w-3 text-green-600" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6"
            onClick={handleCancel}
            disabled={isSaving}
          >
            <X className="h-3 w-3 text-destructive" />
          </Button>
        </div>
      )}
    </div>
  );
}
