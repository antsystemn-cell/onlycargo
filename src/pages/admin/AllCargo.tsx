import { useEffect, useState } from 'react';
import { Package, Search, Trash2, RefreshCw, History } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import CargoStatusBadge from '@/components/cargo/CargoStatusBadge';
import { InlineEditableCell } from '@/components/cargo/InlineEditableCell';
import { InlineEditableDimensions } from '@/components/cargo/InlineEditableDimensions';
import { calculateCargoPrice } from '@/lib/priceCalculation';
import { format } from 'date-fns';
import type { Cargo, CargoStatus, Branch } from '@/types/cargo';
import { STATUS_LABELS } from '@/types/cargo';

interface CargoStatusHistoryLog {
  id: string;
  cargo_id: string;
  status: CargoStatus;
  changed_by: string | null;
  notes: string | null;
  created_at: string;
}

export default function AllCargo() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [cargo, setCargo] = useState<Cargo[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [historyCargoId, setHistoryCargoId] = useState<string | null>(null);
  const [editLogs, setEditLogs] = useState<CargoStatusHistoryLog[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);

  useEffect(() => {
    fetchCargo();
    fetchBranches();
  }, []);

  const fetchCargo = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('cargo')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;

      const transformedData: Cargo[] = (data || []).map((item) => ({
        ...item,
        status: item.status as CargoStatus,
      }));

      setCargo(transformedData);
    } catch (error) {
      console.error('Failed to fetch cargo:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchBranches = async () => {
    try {
      const { data, error } = await supabase
        .from('branches')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setBranches((data || []) as Branch[]);
    } catch (error) {
      console.error('Failed to fetch branches:', error);
    }
  };

  const logEdit = async (cargoId: string, fieldName: string, oldValue: any, newValue: any) => {
    try {
      await supabase.from('cargo_status_history').insert({
        cargo_id: cargoId,
        status: 'registered', // Use a placeholder, we're logging field changes
        changed_by: user?.id,
        notes: `Field "${fieldName}" changed from "${oldValue ?? 'empty'}" to "${newValue ?? 'empty'}"`,
      });
    } catch (error) {
      console.error('Failed to log edit:', error);
    }
  };

  const fetchEditHistory = async (cargoId: string) => {
    setIsLoadingLogs(true);
    try {
      const { data, error } = await supabase
        .from('cargo_status_history')
        .select('*')
        .eq('cargo_id', cargoId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setEditLogs(data || []);
    } catch (error) {
      console.error('Failed to fetch edit history:', error);
    } finally {
      setIsLoadingLogs(false);
    }
  };

  const updateCargoField = async (
    cargoId: string,
    field: string,
    value: any,
    oldValue: any,
    recalculatePrice = false
  ) => {
    try {
      const updateData: Record<string, any> = { [field]: value };
      
      // If we need to recalculate price (weight or dimensions changed)
      if (recalculatePrice) {
        const cargoItem = cargo.find(c => c.id === cargoId);
        if (cargoItem) {
          const branch = branches.find(b => b.id === cargoItem.branch_id);
          const weightRate = branch?.weight_rate || 2500;
          const volumeRate = branch?.volume_rate || 312000;
          
          // Merge the new value with existing dimensions/weight
          const dimensions = {
            length: field === 'length' ? value : cargoItem.length,
            width: field === 'width' ? value : cargoItem.width,
            height: field === 'height' ? value : cargoItem.height,
            weight: field === 'weight' ? value : cargoItem.weight,
          };

          const priceResult = calculateCargoPrice({
            weight: dimensions.weight,
            length: dimensions.length,
            width: dimensions.width,
            height: dimensions.height,
            weightRate,
            volumeRate,
          });

          updateData.price = priceResult.finalPrice;
          updateData.kg_price = priceResult.weightPrice;
          updateData.cubic_meter_price = priceResult.volumePrice;
          updateData.total_cubic_meters = priceResult.cubicMeters;
        }
      }

      // Update status_date if status changed
      if (field === 'status') {
        updateData.status_date = new Date().toISOString();
      }

      const { error } = await supabase
        .from('cargo')
        .update(updateData)
        .eq('id', cargoId);

      if (error) throw error;

      // Log the edit
      await logEdit(cargoId, field, oldValue, value);

      // Update local state
      setCargo((prev) =>
        prev.map((c) =>
          c.id === cargoId ? { ...c, ...updateData } : c
        )
      );

      toast({ title: 'Амжилттай', description: 'Өөрчлөлт хадгалагдлаа' });
    } catch (error) {
      console.error('Update failed:', error);
      toast({ title: 'Алдаа', description: 'Шинэчлэж чадсангүй', variant: 'destructive' });
      throw error;
    }
  };

  const updateCargoDimensions = async (
    cargoId: string,
    dimensions: { length: number | null; width: number | null; height: number | null }
  ) => {
    try {
      const cargoItem = cargo.find(c => c.id === cargoId);
      if (!cargoItem) throw new Error('Cargo not found');

      const branch = branches.find(b => b.id === cargoItem.branch_id);
      const weightRate = branch?.weight_rate || 2500;
      const volumeRate = branch?.volume_rate || 312000;

      const priceResult = calculateCargoPrice({
        weight: cargoItem.weight,
        length: dimensions.length,
        width: dimensions.width,
        height: dimensions.height,
        weightRate,
        volumeRate,
      });

      const updateData = {
        length: dimensions.length,
        width: dimensions.width,
        height: dimensions.height,
        price: priceResult.finalPrice,
        kg_price: priceResult.weightPrice,
        cubic_meter_price: priceResult.volumePrice,
        total_cubic_meters: priceResult.cubicMeters,
      };

      const { error } = await supabase
        .from('cargo')
        .update(updateData)
        .eq('id', cargoId);

      if (error) throw error;

      // Log the edit
      const oldDimensions = `${cargoItem.length || 0}×${cargoItem.width || 0}×${cargoItem.height || 0}`;
      const newDimensions = `${dimensions.length || 0}×${dimensions.width || 0}×${dimensions.height || 0}`;
      await logEdit(cargoId, 'dimensions', oldDimensions, newDimensions);

      // Update local state
      setCargo((prev) =>
        prev.map((c) =>
          c.id === cargoId ? { ...c, ...updateData } : c
        )
      );

      toast({ title: 'Амжилттай', description: 'Хэмжээ хадгалагдлаа' });
    } catch (error) {
      console.error('Update dimensions failed:', error);
      toast({ title: 'Алдаа', description: 'Шинэчлэж чадсангүй', variant: 'destructive' });
      throw error;
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Устгах уу?')) return;

    try {
      const { error } = await supabase.from('cargo').delete().eq('id', id);
      if (error) throw error;

      setCargo((prev) => prev.filter((c) => c.id !== id));
      toast({ title: 'Устгагдлаа' });
    } catch (error) {
      toast({ title: 'Алдаа', description: 'Устгаж чадсангүй', variant: 'destructive' });
    }
  };

  const filteredCargo = cargo.filter((c) => {
    const matchesSearch =
      c.track_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.phone_number.includes(searchQuery);
    const matchesStatus = statusFilter === 'all' || c.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const statusOptions = Object.entries(STATUS_LABELS).map(([value, label]) => ({
    value,
    label,
  }));

  const branchOptions = branches.map(b => ({
    value: b.id,
    label: b.name,
  }));

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
          <h1 className="text-2xl font-bold">Бүх ачаа</h1>
          <p className="text-muted-foreground">Системд бүртгэгдсэн бүх ачаа (inline засварлах боломжтой)</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchCargo}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Шинэчлэх
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Ачааны жагсаалт ({filteredCargo.length})
              </CardTitle>
              <CardDescription>Талбар дээр дарж шууд засварлана</CardDescription>
            </div>
            <div className="flex gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Хайх..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 w-48"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Бүгд</SelectItem>
                  {Object.entries(STATUS_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[120px]">Трак дугаар</TableHead>
                  <TableHead className="min-w-[100px]">Утас</TableHead>
                  <TableHead className="min-w-[70px]">Жин (кг)</TableHead>
                  <TableHead className="min-w-[100px]">Хэмжээ (см)</TableHead>
                  <TableHead className="min-w-[90px]">Үнэ</TableHead>
                  <TableHead className="min-w-[130px]">Төлөв</TableHead>
                  <TableHead className="min-w-[100px]">Салбар</TableHead>
                  <TableHead className="min-w-[100px]">Тэмдэглэл</TableHead>
                  <TableHead className="min-w-[80px]">Огноо</TableHead>
                  <TableHead className="min-w-[80px]">Үйлдэл</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCargo.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-mono">
                      <InlineEditableCell
                        value={item.track_number}
                        onSave={async (val) => {
                          await updateCargoField(item.id, 'track_number', val, item.track_number);
                        }}
                        type="text"
                        placeholder="Track #"
                      />
                    </TableCell>
                    <TableCell>
                      <InlineEditableCell
                        value={item.phone_number}
                        onSave={async (val) => {
                          await updateCargoField(item.id, 'phone_number', val, item.phone_number);
                        }}
                        type="text"
                        placeholder="-"
                      />
                    </TableCell>
                    <TableCell>
                      <InlineEditableCell
                        value={item.weight}
                        onSave={async (val) => {
                          await updateCargoField(item.id, 'weight', val, item.weight, true);
                        }}
                        type="number"
                        placeholder="-"
                        suffix=" кг"
                        minValue={0}
                        step={0.1}
                      />
                    </TableCell>
                    <TableCell>
                      <InlineEditableDimensions
                        dimensions={{
                          length: item.length,
                          width: item.width,
                          height: item.height,
                        }}
                        onSave={async (dims) => {
                          await updateCargoDimensions(item.id, dims);
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <InlineEditableCell
                        value={item.price}
                        onSave={async (val) => {
                          await updateCargoField(item.id, 'price', val, item.price);
                        }}
                        type="number"
                        placeholder="-"
                        displayValue={item.price ? `${item.price.toLocaleString()}₮` : '-'}
                        minValue={0}
                      />
                    </TableCell>
                    <TableCell>
                      <InlineEditableCell
                        value={item.status}
                        onSave={async (val) => {
                          await updateCargoField(item.id, 'status', val, item.status);
                        }}
                        type="select"
                        options={statusOptions}
                        displayValue={STATUS_LABELS[item.status]}
                      />
                    </TableCell>
                    <TableCell>
                      <InlineEditableCell
                        value={item.branch_id}
                        onSave={async (val) => {
                          await updateCargoField(item.id, 'branch_id', val, item.branch_id);
                        }}
                        type="select"
                        options={branchOptions}
                        displayValue={branches.find(b => b.id === item.branch_id)?.name || '-'}
                        placeholder="-"
                      />
                    </TableCell>
                    <TableCell>
                      <InlineEditableCell
                        value={item.notes}
                        onSave={async (val) => {
                          await updateCargoField(item.id, 'notes', val, item.notes);
                        }}
                        type="textarea"
                        placeholder="-"
                        className="max-w-[150px]"
                      />
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {format(new Date(item.status_date), 'MM.dd HH:mm')}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          onClick={() => {
                            setHistoryCargoId(item.id);
                            fetchEditHistory(item.id);
                          }}
                          title="Түүх харах"
                        >
                          <History className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-destructive"
                          onClick={() => handleDelete(item.id)}
                          title="Устгах"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredCargo.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center text-muted-foreground py-8">
                      Ачаа олдсонгүй
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Edit History Dialog */}
      <Dialog open={!!historyCargoId} onOpenChange={(open) => !open && setHistoryCargoId(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Засварын түүх</DialogTitle>
          </DialogHeader>
          {isLoadingLogs ? (
            <div className="flex items-center justify-center py-8">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : editLogs.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">Түүх олдсонгүй</p>
          ) : (
            <ScrollArea className="max-h-[400px]">
              <div className="space-y-3">
                {editLogs.map((log) => (
                  <div key={log.id} className="border rounded-lg p-3 text-sm">
                    <div className="flex justify-between items-start mb-1">
                      <span className="font-medium">{log.notes || `Төлөв: ${STATUS_LABELS[log.status as CargoStatus] || log.status}`}</span>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(log.created_at), 'yyyy.MM.dd HH:mm')}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
