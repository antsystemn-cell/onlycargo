import { useState, useEffect } from 'react';
import { MapPin, Plus, Edit2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { formatPrice } from '@/lib/priceCalculation';
import { DeliveryZoneMapEditor } from '@/components/delivery/DeliveryZoneMapEditor';
import type { DeliveryZone } from '@/types/cargo';

interface Point {
  lat: number;
  lng: number;
}

export default function DeliveryZoneManagement() {
  const { toast } = useToast();
  const [zones, setZones] = useState<DeliveryZone[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingZone, setEditingZone] = useState<DeliveryZone | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Form state
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [price, setPrice] = useState('');
  const [description, setDescription] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [sortOrder, setSortOrder] = useState('0');
  const [polygon, setPolygon] = useState<Point[]>([]);
  const [zoneColor, setZoneColor] = useState('#3b82f6');

  useEffect(() => {
    fetchZones();
  }, []);

  const fetchZones = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('delivery_zones')
        .select('*')
        .order('sort_order');

      if (error) throw error;
      setZones(data as DeliveryZone[]);
    } catch (error) {
      console.error('Failed to fetch zones:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setEditingZone(null);
    setName('');
    setCode('');
    setPrice('');
    setDescription('');
    setIsActive(true);
    setSortOrder('0');
    setPolygon([]);
    setZoneColor('#3b82f6');
  };

  const openEditDialog = (zone: DeliveryZone) => {
    setEditingZone(zone);
    setName(zone.name);
    setCode(zone.code);
    setPrice(String(zone.price));
    setDescription(zone.description || '');
    setIsActive(zone.is_active);
    setSortOrder(String(zone.sort_order));
    // Parse polygon from JSON
    const zonePolygon = zone.polygon as Point[] | null;
    setPolygon(zonePolygon || []);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!name.trim() || !code.trim() || !price.trim()) {
      toast({ title: 'Бүх талбарыг бөглөнө үү', variant: 'destructive' });
      return;
    }

    setIsSaving(true);
    try {
      const zoneData = {
        name,
        code: code.toUpperCase(),
        price: parseFloat(price),
        description: description || null,
        is_active: isActive,
        sort_order: parseInt(sortOrder) || 0,
        polygon: polygon.length >= 3 ? JSON.parse(JSON.stringify(polygon)) : null,
      };

      if (editingZone) {
        const { error } = await supabase
          .from('delivery_zones')
          .update(zoneData)
          .eq('id', editingZone.id);

        if (error) throw error;
        toast({ title: 'Бүс шинэчлэгдлээ' });
      } else {
        const { error } = await supabase
          .from('delivery_zones')
          .insert(zoneData);

        if (error) throw error;
        toast({ title: 'Бүс нэмэгдлээ' });
      }

      setDialogOpen(false);
      resetForm();
      fetchZones();
    } catch (error: any) {
      if (error.code === '23505') {
        toast({ title: 'Энэ код бүртгэгдсэн байна', variant: 'destructive' });
      } else {
        toast({ title: 'Хадгалж чадсангүй', variant: 'destructive' });
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Энэ бүсийг устгах уу?')) return;

    try {
      const { error } = await supabase.from('delivery_zones').delete().eq('id', id);
      if (error) throw error;

      setZones((prev) => prev.filter((z) => z.id !== id));
      toast({ title: 'Устгагдлаа' });
    } catch (error) {
      toast({ title: 'Устгаж чадсангүй', variant: 'destructive' });
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
          <h1 className="text-2xl font-bold">Хүргэлтийн бүсүүд</h1>
          <p className="text-muted-foreground">Хүргэлтийн бүс, үнийг тохируулах</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button onClick={resetForm}>
              <Plus className="mr-2 h-4 w-4" />
              Бүс нэмэх
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] flex flex-col">
            <DialogHeader>
              <DialogTitle>{editingZone ? 'Бүс засах' : 'Шинэ бүс'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 overflow-y-auto flex-1 pr-1">
              <div className="space-y-2">
                <Label>Нэр *</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="A бүс" />
              </div>
              <div className="space-y-2">
                <Label>Код *</Label>
                <Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="ZONE_A" />
              </div>
              <div className="space-y-2">
                <Label>Үнэ (₮) *</Label>
                <Input type="number" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="5000" />
              </div>
              <div className="space-y-2">
                <Label>Тайлбар</Label>
                <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Хотын төв хэсэг..." />
              </div>
              <div className="space-y-2">
                <Label>Эрэмбэ</Label>
                <Input type="number" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} placeholder="0" />
              </div>
              
              {/* Map Editor for Zone Polygon */}
              <DeliveryZoneMapEditor
                polygon={polygon}
                onPolygonChange={setPolygon}
                zoneColor={zoneColor}
              />
              
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
            <MapPin className="h-5 w-5" />
            Бүсүүдийн жагсаалт ({zones.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Нэр</TableHead>
                <TableHead>Код</TableHead>
                <TableHead>Үнэ</TableHead>
                <TableHead>Тайлбар</TableHead>
                <TableHead>Төлөв</TableHead>
                <TableHead>Үйлдэл</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {zones.map((zone) => (
                <TableRow key={zone.id}>
                  <TableCell className="font-medium">{zone.name}</TableCell>
                  <TableCell className="font-mono text-sm">{zone.code}</TableCell>
                  <TableCell className="font-semibold">{formatPrice(zone.price)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{zone.description || '-'}</TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                      zone.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                    }`}>
                      {zone.is_active ? 'Идэвхтэй' : 'Идэвхгүй'}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEditDialog(zone)}>
                        <Edit2 className="h-3 w-3" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => handleDelete(zone.id)}>
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
