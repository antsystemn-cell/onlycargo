import { useState, useEffect } from 'react';
import { MapPin, ChevronDown, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { Branch, Profile } from '@/types/cargo';

interface BranchSelectorProps {
  profile: Profile;
  onBranchChange: () => void;
}

export default function BranchSelector({ profile, onBranchChange }: BranchSelectorProps) {
  const { toast } = useToast();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string>(profile.default_branch_id || '');
  const [pendingBranchId, setPendingBranchId] = useState<string | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    fetchBranches();
  }, []);

  useEffect(() => {
    setSelectedBranchId(profile.default_branch_id || '');
  }, [profile.default_branch_id]);

  const fetchBranches = async () => {
    const { data } = await supabase
      .from('branches')
      .select('*')
      .eq('is_active', true)
      .order('name');
    
    if (data) {
      setBranches(data as Branch[]);
    }
  };

  const handleBranchSelect = (branchId: string) => {
    if (branchId !== selectedBranchId) {
      setPendingBranchId(branchId);
      setShowConfirmDialog(true);
    }
  };

  const confirmBranchChange = async () => {
    if (!pendingBranchId) return;

    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ default_branch_id: pendingBranchId })
        .eq('id', profile.id);

      if (error) throw error;

      setSelectedBranchId(pendingBranchId);
      onBranchChange();
      
      const newBranch = branches.find(b => b.id === pendingBranchId);
      toast({
        title: 'Салбар солигдлоо',
        description: `${newBranch?.name} салбар руу солигдлоо. Хүргэлтийн хаягаа шинэчилнэ үү!`,
      });
    } catch (error) {
      toast({
        title: 'Алдаа',
        description: 'Салбар солиход алдаа гарлаа',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
      setShowConfirmDialog(false);
      setPendingBranchId(null);
    }
  };

  const currentBranch = branches.find(b => b.id === selectedBranchId);
  const pendingBranch = branches.find(b => b.id === pendingBranchId);

  return (
    <>
      <div className="space-y-2">
        <Label className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-muted-foreground" />
          Үндсэн салбар
        </Label>
        <Select value={selectedBranchId} onValueChange={handleBranchSelect}>
          <SelectTrigger>
            <SelectValue placeholder="Салбар сонгох" />
          </SelectTrigger>
          <SelectContent>
            {branches.map((branch) => (
              <SelectItem key={branch.id} value={branch.id}>
                <div className="flex flex-col items-start">
                  <span>{branch.name}</span>
                  {branch.address && (
                    <span className="text-xs text-muted-foreground">{branch.address}</span>
                  )}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {currentBranch && (
          <p className="text-xs text-muted-foreground">
            Хаяг: {currentBranch.address || 'Хаяг байхгүй'}
          </p>
        )}
      </div>

      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-warning" />
              Салбар солих уу?
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>
                  Та <strong>{currentBranch?.name}</strong> салбараас{' '}
                  <strong>{pendingBranch?.name}</strong> салбар руу солихдоо итгэлтэй байна уу?
                </p>
                <div className="p-3 bg-warning/10 border border-warning/20 rounded-lg">
                  <p className="text-sm text-warning-foreground font-medium flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" />
                    Анхааруулга
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Салбар солигдсоны дараа таны Хятадын хүргэлтийн хаяг өөрчлөгдөнө. 
                    Одоо явуулж байгаа ачаанд шинэ салбарын хаягийг ашиглана уу.
                  </p>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isLoading}>Цуцлах</AlertDialogCancel>
            <AlertDialogAction onClick={confirmBranchChange} disabled={isLoading}>
              {isLoading ? 'Хадгалж байна...' : 'Тийм, солих'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
