import { useState, useEffect } from 'react';
import { Building2, Plus, Edit2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { Branch } from '@/types/cargo';

export default function BranchManagement() {
  const { toast } = useToast();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Form state
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    fetchBranches();
  }, []);

  const fetchBranches = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('branches')
        .select('*')
        .order('name');

      if (error) throw error;
      setBranches(data || []);
    } catch (error) {
      console.error('Failed to fetch branches:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setEditingBranch(null);
    setName('');
    setCode('');
    setAddress('');
    setPhone('');
    setIsActive(true);
  };

  const openEditDialog = (branch: Branch) => {
    setEditingBranch(branch);
    setName(branch.name);
    setCode(branch.code);
    setAddress(branch.address || '');
    setPhone(branch.phone || '');
    setIsActive(branch.is_active);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!name.trim() || !code.trim()) {
      toast({ title: 'Алдаа', description: 'Нэр болон код оруулна уу', variant: 'destructive' });
      return;
    }

    setIsSaving(true);
    try {
      if (editingBranch) {
        const { error } = await supabase
          .from('branches')
          .update({
            name,
            code,
            address: address || null,
            phone: phone || null,
            is_active: isActive,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingBranch.id);

        if (error) throw error;
        toast({ title: 'Амжилттай', description: 'Салбар шинэчлэгдлээ' });
      } else {
        const { error } = await supabase.from('branches').insert({
          name,
          code,
          address: address || null,
          phone: phone || null,
          is_active: isActive,
        });

        if (error) throw error;
        toast({ title: 'Амжилттай', description: 'Салбар нэмэгдлээ' });
      }

      setDialogOpen(false);
      resetForm();
      fetchBranches();
    } catch (error: any) {
      if (error.code === '23505') {
        toast({ title: 'Алдаа', description: 'Энэ код бүртгэгдсэн байна', variant: 'destructive' });
      } else {
        toast({ title: 'Алдаа', description: 'Хадгалж чадсангүй', variant: 'destructive' });
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Энэ салбарыг устгах уу?')) return;

    try {
      const { error } = await supabase.from('branches').delete().eq('id', id);
      if (error) throw error;

      setBranches((prev) => prev.filter((b) => b.id !== id));
      toast({ title: 'Устгагдлаа' });
    } catch (error) {
      toast({ title: 'Алдаа', description: 'Устгаж чадсангүй', variant: 'destructive' });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Салбарууд</h1>
          <p className="text-muted-foreground">Салбаруудын жагсаалт</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button onClick={resetForm}>
              <Plus className="mr-2 h-4 w-4" />
              Салбар нэмэх
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingBranch ? 'Салбар засах' : 'Шинэ салбар'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Нэр *</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Улаанбаатар төв" />
              </div>
              <div className="space-y-2">
                <Label>Код *</Label>
                <Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="UB_MAIN" />
              </div>
              <div className="space-y-2">
                <Label>Хаяг</Label>
                <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Хаяг..." />
              </div>
              <div className="space-y-2">
                <Label>Утас</Label>
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="77001234" />
              </div>
              <div className="flex items-center justify-between">
                <Label>Идэвхтэй</Label>
                <Switch checked={isActive} onCheckedChange={setIsActive} />
              </div>
              <Button className="w-full" onClick={handleSave} disabled={isSaving}>
                {isSaving ? 'Хадгалж байна...' : 'Хадгалах'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Салбаруудын жагсаалт ({branches.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Нэр</TableHead>
                <TableHead>Код</TableHead>
                <TableHead>Хаяг</TableHead>
                <TableHead>Утас</TableHead>
                <TableHead>Төлөв</TableHead>
                <TableHead>Үйлдэл</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {branches.map((branch) => (
                <TableRow key={branch.id}>
                  <TableCell className="font-medium">{branch.name}</TableCell>
                  <TableCell className="font-mono text-sm">{branch.code}</TableCell>
                  <TableCell>{branch.address || '-'}</TableCell>
                  <TableCell>{branch.phone || '-'}</TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                      branch.is_active 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {branch.is_active ? 'Идэвхтэй' : 'Идэвхгүй'}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEditDialog(branch)}>
                        <Edit2 className="h-3 w-3" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => handleDelete(branch.id)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
