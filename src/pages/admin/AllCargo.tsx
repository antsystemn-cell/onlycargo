import { useEffect, useState } from 'react';
import { Package, Search, Edit2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import CargoStatusBadge from '@/components/cargo/CargoStatusBadge';
import { format } from 'date-fns';
import type { Cargo, CargoStatus } from '@/types/cargo';
import { STATUS_LABELS } from '@/types/cargo';

export default function AllCargo() {
  const { toast } = useToast();
  const [cargo, setCargo] = useState<Cargo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [editingCargo, setEditingCargo] = useState<Cargo | null>(null);
  const [editStatus, setEditStatus] = useState<CargoStatus>('registered');
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    fetchCargo();
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

  const handleUpdateStatus = async () => {
    if (!editingCargo) return;

    setIsUpdating(true);
    try {
      const { error } = await supabase
        .from('cargo')
        .update({ status: editStatus, status_date: new Date().toISOString() })
        .eq('id', editingCargo.id);

      if (error) throw error;

      setCargo((prev) =>
        prev.map((c) =>
          c.id === editingCargo.id
            ? { ...c, status: editStatus, status_date: new Date().toISOString() }
            : c
        )
      );

      toast({ title: 'Амжилттай', description: 'Төлөв шинэчлэгдлээ' });
      setEditingCargo(null);
    } catch (error) {
      toast({ title: 'Алдаа', description: 'Шинэчлэж чадсангүй', variant: 'destructive' });
    } finally {
      setIsUpdating(false);
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Бүх ачаа</h1>
        <p className="text-muted-foreground">Системд бүртгэгдсэн бүх ачаа</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Ачааны жагсаалт ({filteredCargo.length})
              </CardTitle>
              <CardDescription>Хайх, шүүх, засах</CardDescription>
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
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Трак дугаар</TableHead>
                <TableHead>Утас</TableHead>
                <TableHead>Жин</TableHead>
                <TableHead>Үнэ</TableHead>
                <TableHead>Төлөв</TableHead>
                <TableHead>Огноо</TableHead>
                <TableHead>Үйлдэл</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCargo.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-mono">{item.track_number}</TableCell>
                  <TableCell>{item.phone_number || '-'}</TableCell>
                  <TableCell>{item.weight ? `${item.weight} кг` : '-'}</TableCell>
                  <TableCell>{item.price?.toLocaleString()}₮</TableCell>
                  <TableCell>
                    <CargoStatusBadge status={item.status} />
                  </TableCell>
                  <TableCell>{format(new Date(item.status_date), 'MM.dd HH:mm')}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        onClick={() => {
                          setEditingCargo(item);
                          setEditStatus(item.status);
                        }}
                      >
                        <Edit2 className="h-3 w-3" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-destructive"
                        onClick={() => handleDelete(item.id)}
                      >
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

      {/* Edit Dialog */}
      <Dialog open={!!editingCargo} onOpenChange={(open) => !open && setEditingCargo(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Төлөв засах</DialogTitle>
          </DialogHeader>
          {editingCargo && (
            <div className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Трак дугаар:</p>
                <p className="font-mono font-medium">{editingCargo.track_number}</p>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Төлөв</label>
                <Select value={editStatus} onValueChange={(v) => setEditStatus(v as CargoStatus)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(STATUS_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button className="w-full" onClick={handleUpdateStatus} disabled={isUpdating}>
                {isUpdating ? 'Хадгалж байна...' : 'Хадгалах'}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
