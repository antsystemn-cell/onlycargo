import { useState, useEffect } from 'react';
import { Building2, Plus, Edit2, Trash2, DollarSign, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { formatPrice } from '@/lib/priceCalculation';
import type { Branch } from '@/types/cargo';

export default function BranchManagement() {
  const { toast } = useToast();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Form state - Basic info
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [isActive, setIsActive] = useState(true);

  // Form state - Pricing
  const [weightRate, setWeightRate] = useState('2500');
  const [volumeRate, setVolumeRate] = useState('312000');

  // Form state - China address
  const [chinaAddressPrefix, setChinaAddressPrefix] = useState('ONLY');
  const [chinaAddressText, setChinaAddressText] = useState(`收货人: 唯一OnlyCargo
手机号码: 13694788211
所在地区: 内蒙古，锡林郭勒盟，二连浩特市, 肯特街
详细地址: 白音布日特物流巴图收`);

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
      setBranches((data || []) as Branch[]);
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
    setWeightRate('2500');
    setVolumeRate('312000');
    setChinaAddressPrefix('ONLY');
    setChinaAddressText(`收货人: 唯一OnlyCargo
手机号码: 13694788211
所在地区: 内蒙古，锡林郭勒盟，二连浩特市, 肯特街
详细地址: 白音布日特物流巴图收`);
  };

  const openEditDialog = (branch: Branch) => {
    setEditingBranch(branch);
    setName(branch.name);
    setCode(branch.code);
    setAddress(branch.address || '');
    setPhone(branch.phone || '');
    setIsActive(branch.is_active);
    setWeightRate(String(branch.weight_rate || 2500));
    setVolumeRate(String(branch.volume_rate || 312000));
    setChinaAddressPrefix(branch.china_address_prefix || 'ONLY');
    setChinaAddressText(branch.china_address_text || '');
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!name.trim() || !code.trim()) {
      toast({ title: 'Алдаа', description: 'Нэр болон код оруулна уу', variant: 'destructive' });
      return;
    }

    setIsSaving(true);
    try {
      const branchData = {
        name,
        code,
        address: address || null,
        phone: phone || null,
        is_active: isActive,
        weight_rate: parseFloat(weightRate) || 2500,
        volume_rate: parseFloat(volumeRate) || 312000,
        china_address_prefix: chinaAddressPrefix || 'ONLY',
        china_address_text: chinaAddressText || null,
      };

      if (editingBranch) {
        const { error } = await supabase
          .from('branches')
          .update({
            ...branchData,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingBranch.id);

        if (error) throw error;
        toast({ title: 'Амжилттай', description: 'Салбар шинэчлэгдлээ' });
      } else {
        const { error } = await supabase.from('branches').insert(branchData);

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
          <p className="text-muted-foreground">Салбаруудын жагсаалт, үнэ, Хятад хаяг</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button onClick={resetForm}>
              <Plus className="mr-2 h-4 w-4" />
              Салбар нэмэх
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingBranch ? 'Салбар засах' : 'Шинэ салбар'}</DialogTitle>
            </DialogHeader>
            
            <Tabs defaultValue="basic" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="basic">Үндсэн</TabsTrigger>
                <TabsTrigger value="pricing">Үнэ</TabsTrigger>
                <TabsTrigger value="china">Хятад хаяг</TabsTrigger>
              </TabsList>

              <TabsContent value="basic" className="space-y-4 mt-4">
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
              </TabsContent>

              <TabsContent value="pricing" className="space-y-4 mt-4">
                <div className="p-3 rounded-lg bg-muted/50 text-sm text-muted-foreground">
                  <p className="font-medium text-foreground mb-1">Үнийн тооцоолол</p>
                  <p>Жингийн үнэ болон эзлэхүүний үнийн аль <strong>ИХ</strong> нь тооцогдоно (SUM биш MAX).</p>
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4" />
                    Жингийн үнэ (1 кг)
                  </Label>
                  <Input
                    type="number"
                    value={weightRate}
                    onChange={(e) => setWeightRate(e.target.value)}
                    placeholder="2500"
                  />
                  <p className="text-xs text-muted-foreground">Одоогийн: {formatPrice(parseFloat(weightRate) || 0)}/кг</p>
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4" />
                    Эзлэхүүний үнэ (1 м³)
                  </Label>
                  <Input
                    type="number"
                    value={volumeRate}
                    onChange={(e) => setVolumeRate(e.target.value)}
                    placeholder="312000"
                  />
                  <p className="text-xs text-muted-foreground">Одоогийн: {formatPrice(parseFloat(volumeRate) || 0)}/м³</p>
                </div>
              </TabsContent>

              <TabsContent value="china" className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    Хаягийн угтвар (Prefix)
                  </Label>
                  <Input
                    value={chinaAddressPrefix}
                    onChange={(e) => setChinaAddressPrefix(e.target.value.toUpperCase())}
                    placeholder="ONLY"
                  />
                  <p className="text-xs text-muted-foreground">
                    Жишээ: {chinaAddressPrefix}-88665525
                  </p>
                </div>
                <Separator />
                <div className="space-y-2">
                  <Label>Хятад агуулахын хаяг</Label>
                  <Textarea
                    value={chinaAddressText}
                    onChange={(e) => setChinaAddressText(e.target.value)}
                    placeholder="收货人: ..."
                    rows={5}
                  />
                  <p className="text-xs text-muted-foreground">
                    Хэрэглэгч дээр харагдах Хятад хаяг
                  </p>
                </div>
              </TabsContent>
            </Tabs>

            <Button className="w-full mt-4" onClick={handleSave} disabled={isSaving}>
              {isSaving ? 'Хадгалж байна...' : 'Хадгалах'}
            </Button>
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
                <TableHead>Үнэ/кг</TableHead>
                <TableHead>Үнэ/м³</TableHead>
                <TableHead>Prefix</TableHead>
                <TableHead>Төлөв</TableHead>
                <TableHead>Үйлдэл</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {branches.map((branch) => (
                <TableRow key={branch.id}>
                  <TableCell className="font-medium">{branch.name}</TableCell>
                  <TableCell className="font-mono text-sm">{branch.code}</TableCell>
                  <TableCell className="text-sm">{formatPrice(branch.weight_rate || 2500)}</TableCell>
                  <TableCell className="text-sm">{formatPrice(branch.volume_rate || 312000)}</TableCell>
                  <TableCell className="font-mono text-sm">{branch.china_address_prefix || 'ONLY'}</TableCell>
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
