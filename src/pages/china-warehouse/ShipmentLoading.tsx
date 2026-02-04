import { useState, useEffect } from 'react';
import { Truck, Package, Check, History, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import type { Cargo, Shipment } from '@/types/cargo';
import { CARGO_STATUS_LABELS } from '@/types/cargo';

// Translations
const t = {
  mn: {
    title: 'Ачаа ачилт',
    loadCargo: 'Ачилтанд',
    history: 'Түүх',
    search: 'Хайх...',
    trackNumber: 'Track дугаар',
    phone: 'Утас',
    weight: 'Жин',
    status: 'Төлөв',
    selectAll: 'Бүгдийг сонгох',
    loadSelected: 'Сонгосон ачилт',
    loading: 'Ачилтанд...',
    noCargoSelected: 'Ачаа сонгоогүй байна',
    shipmentCreated: 'Ачилт үүсгэгдлээ',
    shipmentNumber: 'Ачилтын дугаар',
    loadedAt: 'Ачилтын огноо',
    cargoCount: 'Ачааны тоо',
    totalWeight: 'Нийт жин',
  },
  zh: {
    title: '装货管理',
    loadCargo: '装货',
    history: '历史',
    search: '搜索...',
    trackNumber: '运单号',
    phone: '电话',
    weight: '重量',
    status: '状态',
    selectAll: '全选',
    loadSelected: '装载所选',
    loading: '装载中...',
    noCargoSelected: '未选择货物',
    shipmentCreated: '装货单已创建',
    shipmentNumber: '装货单号',
    loadedAt: '装货日期',
    cargoCount: '货物数量',
    totalWeight: '总重量',
  },
};

export default function ShipmentLoading() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [lang, setLang] = useState<'mn' | 'zh'>('zh');
  const labels = t[lang];

  const [cargo, setCargo] = useState<Cargo[]>([]);
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      // Fetch cargo that can be loaded (status: received_ereen, not yet in shipment)
      const { data: cargoData } = await supabase
        .from('cargo')
        .select('*')
        .eq('status', 'received_ereen')
        .is('shipment_id', null)
        .order('created_at', { ascending: false });

      setCargo(cargoData as Cargo[] || []);

      // Fetch shipment history
      const { data: shipmentData } = await supabase
        .from('shipments')
        .select('*')
        .order('loaded_at', { ascending: false })
        .limit(50);

      setShipments(shipmentData as Shipment[] || []);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredCargo = cargo.filter((c) =>
    c.track_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.phone_number.includes(searchQuery)
  );

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(filteredCargo.map((c) => c.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleSelectOne = (id: string, checked: boolean) => {
    const newSet = new Set(selectedIds);
    if (checked) {
      newSet.add(id);
    } else {
      newSet.delete(id);
    }
    setSelectedIds(newSet);
  };

  const handleCreateShipment = async () => {
    if (selectedIds.size === 0) {
      toast({ title: labels.noCargoSelected, variant: 'destructive' });
      return;
    }

    setIsCreating(true);
    try {
      const selectedCargo = cargo.filter((c) => selectedIds.has(c.id));
      const totalWeight = selectedCargo.reduce((sum, c) => sum + (c.weight || 0), 0);
      const shipmentNumber = `SH${Date.now().toString(36).toUpperCase()}`;

      // Create shipment
      const { data: shipment, error: shipmentError } = await supabase
        .from('shipments')
        .insert({
          shipment_number: shipmentNumber,
          loaded_by: user?.id,
          cargo_count: selectedIds.size,
          total_weight: totalWeight,
        })
        .select()
        .single();

      if (shipmentError) throw shipmentError;

      // Create shipment items and update cargo
      for (const cargoItem of selectedCargo) {
        await supabase
          .from('shipment_items')
          .insert({
            shipment_id: shipment.id,
            cargo_id: cargoItem.id,
          });

        await supabase
          .from('cargo')
          .update({
            shipment_id: shipment.id,
            status: 'transporting',
          })
          .eq('id', cargoItem.id);
      }

      toast({ title: labels.shipmentCreated });
      setSelectedIds(new Set());
      fetchData();
    } catch (error) {
      console.error('Failed to create shipment:', error);
      toast({ title: 'Error creating shipment', variant: 'destructive' });
    } finally {
      setIsCreating(false);
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
      {/* Header with language toggle */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{labels.title}</h1>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant={lang === 'zh' ? 'default' : 'outline'}
            onClick={() => setLang('zh')}
          >
            中文
          </Button>
          <Button
            size="sm"
            variant={lang === 'mn' ? 'default' : 'outline'}
            onClick={() => setLang('mn')}
          >
            Монгол
          </Button>
        </div>
      </div>

      <Tabs defaultValue="load">
        <TabsList>
          <TabsTrigger value="load" className="gap-2">
            <Package className="h-4 w-4" />
            {labels.loadCargo}
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-2">
            <History className="h-4 w-4" />
            {labels.history}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="load" className="space-y-4">
          {/* Search and action */}
          <div className="flex gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={labels.search}
                className="pl-9"
              />
            </div>
            <Button
              onClick={handleCreateShipment}
              disabled={selectedIds.size === 0 || isCreating}
            >
              <Truck className="h-4 w-4 mr-2" />
              {isCreating ? labels.loading : `${labels.loadSelected} (${selectedIds.size})`}
            </Button>
          </div>

          {/* Cargo table */}
          <Card>
            <CardContent className="pt-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={selectedIds.size === filteredCargo.length && filteredCargo.length > 0}
                        onCheckedChange={handleSelectAll}
                      />
                    </TableHead>
                    <TableHead>{labels.trackNumber}</TableHead>
                    <TableHead>{labels.phone}</TableHead>
                    <TableHead>{labels.weight}</TableHead>
                    <TableHead>{labels.status}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCargo.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <Checkbox
                          checked={selectedIds.has(item.id)}
                          onCheckedChange={(checked) => handleSelectOne(item.id, !!checked)}
                        />
                      </TableCell>
                      <TableCell className="font-mono">{item.track_number}</TableCell>
                      <TableCell>{item.phone_number}</TableCell>
                      <TableCell>{item.weight ? `${item.weight} kg` : '-'}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          {CARGO_STATUS_LABELS[item.status]}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredCargo.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                        {lang === 'zh' ? '没有可装载的货物' : 'Ачилтанд бэлэн ачаа байхгүй'}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5" />
                {labels.history}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{labels.shipmentNumber}</TableHead>
                    <TableHead>{labels.loadedAt}</TableHead>
                    <TableHead>{labels.cargoCount}</TableHead>
                    <TableHead>{labels.totalWeight}</TableHead>
                    <TableHead>{labels.status}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {shipments.map((shipment) => (
                    <TableRow key={shipment.id}>
                      <TableCell className="font-mono font-medium">{shipment.shipment_number}</TableCell>
                      <TableCell>{new Date(shipment.loaded_at).toLocaleDateString()}</TableCell>
                      <TableCell>{shipment.cargo_count}</TableCell>
                      <TableCell>{shipment.total_weight ? `${shipment.total_weight} kg` : '-'}</TableCell>
                      <TableCell>
                        <Badge variant={shipment.status === 'completed' ? 'default' : 'secondary'}>
                          {shipment.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
