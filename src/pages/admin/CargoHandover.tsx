import { useState } from 'react';
import { HandCoins, Search, Printer, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import CargoStatusBadge from '@/components/cargo/CargoStatusBadge';
import { format } from 'date-fns';
import type { Cargo, CargoStatus } from '@/types/cargo';

export default function CargoHandover() {
  const { toast } = useToast();
  const [phoneQuery, setPhoneQuery] = useState('');
  const [cargo, setCargo] = useState<Cargo[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isSearching, setIsSearching] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const handleSearch = async () => {
    if (!phoneQuery.trim()) return;

    setIsSearching(true);
    setHasSearched(true);
    setSelectedIds(new Set());

    try {
      const { data, error } = await supabase
        .from('cargo')
        .select('*')
        .eq('phone_number', phoneQuery.trim())
        .eq('status', 'arrived_ub')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const transformedData: Cargo[] = (data || []).map((item) => ({
        ...item,
        status: item.status as CargoStatus,
      }));

      setCargo(transformedData);
    } catch (error) {
      console.error('Search error:', error);
      toast({
        title: 'Алдаа',
        description: 'Хайлт амжилтгүй',
        variant: 'destructive',
      });
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(cargo.map((c) => c.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleSelect = (id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  };

  const handlePrint = () => {
    const selectedCargo = cargo.filter((c) => selectedIds.has(c.id));
    const totalPrice = selectedCargo.reduce((sum, c) => sum + (c.price || 0), 0);

    const printContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Ачаа хүлээлцсэн баримт</title>
        <style>
          body { font-family: Arial, sans-serif; font-size: 12px; padding: 10px; }
          h2 { text-align: center; margin-bottom: 10px; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
          th, td { border: 1px solid #000; padding: 4px; text-align: left; }
          th { background: #f0f0f0; }
          .total { text-align: right; font-weight: bold; margin-top: 10px; }
          .footer { text-align: center; margin-top: 20px; font-size: 10px; }
        </style>
      </head>
      <body>
        <h2>Ачаа хүлээлцсэн баримт</h2>
        <p>Утас: ${phoneQuery}</p>
        <p>Огноо: ${format(new Date(), 'yyyy.MM.dd HH:mm')}</p>
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Трак дугаар</th>
              <th>Жин</th>
              <th>Үнэ</th>
            </tr>
          </thead>
          <tbody>
            ${selectedCargo.map((c, i) => `
              <tr>
                <td>${i + 1}</td>
                <td>${c.track_number}</td>
                <td>${c.weight || '-'} кг</td>
                <td>${(c.price || 0).toLocaleString()}₮</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        <p class="total">Нийт: ${selectedCargo.length} ширхэг / ${totalPrice.toLocaleString()}₮</p>
        <p class="footer">Баярлалаа!</p>
      </body>
      </html>
    `;

    const printWindow = window.open('', '', 'width=400,height=600');
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
      printWindow.print();
    }
  };

  const handleComplete = async () => {
    if (selectedIds.size === 0) return;

    setIsProcessing(true);
    try {
      const { error } = await supabase
        .from('cargo')
        .update({ status: 'completed', status_date: new Date().toISOString() })
        .in('id', Array.from(selectedIds));

      if (error) throw error;

      toast({
        title: 'Амжилттай',
        description: `${selectedIds.size} ачаа хүлээлгэж өгсөн`,
      });

      setCargo((prev) => prev.filter((c) => !selectedIds.has(c.id)));
      setSelectedIds(new Set());
    } catch (error) {
      console.error('Complete error:', error);
      toast({
        title: 'Алдаа',
        description: 'Үйлдэл амжилтгүй',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const selectedCargo = cargo.filter((c) => selectedIds.has(c.id));
  const totalPrice = selectedCargo.reduce((sum, c) => sum + (c.price || 0), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Ачаа хүлээлгэж өгөх</h1>
        <p className="text-muted-foreground">УБ-д ирсэн ачаа хэрэглэгчид хүлээлгэж өгөх</p>
      </div>

      {/* Search */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Хэрэглэгч хайх
          </CardTitle>
          <CardDescription>Утасны дугаараар хайх</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              placeholder="99112233"
              value={phoneQuery}
              onChange={(e) => setPhoneQuery(e.target.value)}
              maxLength={8}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
            <Button onClick={handleSearch} disabled={isSearching}>
              {isSearching ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              ) : (
                'Хайх'
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {hasSearched && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <HandCoins className="h-5 w-5" />
              Хүлээлгэж өгөх ачаа ({cargo.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {cargo.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                УБ-д ирсэн ачаа олдсонгүй
              </div>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">
                        <Checkbox
                          checked={selectedIds.size === cargo.length}
                          onCheckedChange={handleSelectAll}
                        />
                      </TableHead>
                      <TableHead>Трак дугаар</TableHead>
                      <TableHead>Жин</TableHead>
                      <TableHead>Тавиур</TableHead>
                      <TableHead>Үнэ</TableHead>
                      <TableHead>Төлөв</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cargo.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>
                          <Checkbox
                            checked={selectedIds.has(item.id)}
                            onCheckedChange={(checked) => handleSelect(item.id, checked as boolean)}
                          />
                        </TableCell>
                        <TableCell className="font-mono">{item.track_number}</TableCell>
                        <TableCell>{item.weight ? `${item.weight} кг` : '-'}</TableCell>
                        <TableCell>{item.shelf_location || '-'}</TableCell>
                        <TableCell>{item.price?.toLocaleString()}₮</TableCell>
                        <TableCell>
                          <CargoStatusBadge status={item.status} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                {selectedIds.size > 0 && (
                  <div className="mt-4 flex items-center justify-between border-t pt-4">
                    <div>
                      <p className="text-muted-foreground">
                        Сонгосон: {selectedIds.size} ширхэг
                      </p>
                      <p className="text-xl font-bold text-primary">
                        {totalPrice.toLocaleString()}₮
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" onClick={handlePrint}>
                        <Printer className="mr-2 h-4 w-4" />
                        Хэвлэх
                      </Button>
                      <Button onClick={handleComplete} disabled={isProcessing}>
                        {isProcessing ? (
                          <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                        ) : (
                          <>
                            <Check className="mr-2 h-4 w-4" />
                            Хүлээлгэж өгсөн
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
