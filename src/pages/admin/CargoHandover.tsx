import { useState } from 'react';
import { HandCoins, Search, Printer, Check, CreditCard, Banknote, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import CargoStatusBadge from '@/components/cargo/CargoStatusBadge';
import { format } from 'date-fns';
import type { Cargo, CargoStatus } from '@/types/cargo';

type PaymentMethod = 'transfer' | 'card' | 'cash';

export default function CargoHandover() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [cargo, setCargo] = useState<Cargo[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isSearching, setIsSearching] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('transfer');

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    setHasSearched(true);
    setSelectedIds(new Set());

    try {
      // Search by both phone number and tracking number
      const { data, error } = await supabase
        .from('cargo')
        .select('*')
        .eq('status', 'ready_warehouse')
        .or(`phone_number.eq.${searchQuery.trim()},track_number.ilike.%${searchQuery.trim()}%`)
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

  const getPaymentMethodLabel = (method: PaymentMethod) => {
    switch (method) {
      case 'transfer': return 'Шилжүүлэг';
      case 'card': return 'Карт';
      case 'cash': return 'Бэлэн';
      default: return '';
    }
  };

  const handlePrint = () => {
    const selectedCargo = cargo.filter((c) => selectedIds.has(c.id));
    const totalPrice = selectedCargo.reduce((sum, c) => sum + (c.price || 0), 0);
    const customerPhone = selectedCargo[0]?.phone_number || searchQuery;

    const printContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Ачаа хүлээлцсэн баримт</title>
        <style>
          @page { size: 80mm auto; margin: 5mm; }
          body { 
            font-family: Arial, sans-serif; 
            font-size: 11px; 
            padding: 5px;
            max-width: 80mm;
          }
          h2 { text-align: center; margin: 5px 0; font-size: 14px; }
          .header { text-align: center; margin-bottom: 10px; border-bottom: 1px dashed #000; padding-bottom: 5px; }
          table { width: 100%; border-collapse: collapse; margin: 10px 0; }
          th, td { border: 1px solid #000; padding: 3px; text-align: left; font-size: 10px; }
          th { background: #f0f0f0; }
          .checkbox { 
            display: inline-block; 
            width: 14px; 
            height: 14px; 
            border: 1px solid #000; 
            margin-right: 5px;
            vertical-align: middle;
          }
          .total { text-align: right; font-weight: bold; margin: 10px 0; font-size: 12px; }
          .payment-section { 
            margin: 15px 0; 
            padding: 8px; 
            border: 1px solid #000; 
          }
          .payment-option { margin: 5px 0; display: flex; align-items: center; }
          .signature-section { 
            margin-top: 20px; 
            display: flex; 
            justify-content: space-between; 
          }
          .signature-box { 
            width: 45%; 
            text-align: center;
          }
          .signature-line { 
            border-top: 1px solid #000; 
            margin-top: 30px; 
            padding-top: 3px; 
            font-size: 9px;
          }
          .footer { text-align: center; margin-top: 15px; font-size: 9px; border-top: 1px dashed #000; padding-top: 5px; }
        </style>
      </head>
      <body>
        <div class="header">
          <h2>ONLY CARGO</h2>
          <p>Ачаа хүлээлцсэн баримт</p>
        </div>
        
        <p><strong>Утас:</strong> ${customerPhone}</p>
        <p><strong>Огноо:</strong> ${format(new Date(), 'yyyy.MM.dd HH:mm')}</p>
        
        <table>
          <thead>
            <tr>
              <th style="width: 20px;"><span class="checkbox"></span></th>
              <th>Трак дугаар</th>
              <th>Жин</th>
              <th>Үнэ</th>
            </tr>
          </thead>
          <tbody>
            ${selectedCargo.map((c, i) => `
              <tr>
                <td><span class="checkbox"></span></td>
                <td>${c.track_number}</td>
                <td>${c.weight || '-'} кг</td>
                <td>${(c.price || 0).toLocaleString()}₮</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        
        <p class="total">Нийт: ${selectedCargo.length} ширхэг / ${totalPrice.toLocaleString()}₮</p>
        
        <div class="payment-section">
          <p><strong>Төлбөрийн хэлбэр:</strong></p>
          <div class="payment-option">
            <span class="checkbox" ${paymentMethod === 'transfer' ? 'style="background:#000;"' : ''}></span>
            <span>Шилжүүлэг</span>
          </div>
          <div class="payment-option">
            <span class="checkbox" ${paymentMethod === 'card' ? 'style="background:#000;"' : ''}></span>
            <span>Карт</span>
          </div>
          <div class="payment-option">
            <span class="checkbox" ${paymentMethod === 'cash' ? 'style="background:#000;"' : ''}></span>
            <span>Бэлэн</span>
          </div>
        </div>
        
        <div class="signature-section">
          <div class="signature-box">
            <div class="signature-line">Хүлээлгэж өгсөн</div>
          </div>
          <div class="signature-box">
            <div class="signature-line">Хүлээж авсан</div>
          </div>
        </div>
        
        <p class="footer">Баярлалаа! Дахин ашиглана уу.</p>
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
        <p className="text-muted-foreground">Агуулахад бэлэн болсон ачаа хүлээлгэж өгөх</p>
      </div>

      {/* Search */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Хайлт
          </CardTitle>
          <CardDescription>Утасны дугаар эсвэл трак дугаараар хайх</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              placeholder="Утас эсвэл трак дугаар"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
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
                Агуулахад бэлэн болсон ачаа олдсонгүй
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">
                          <Checkbox
                            checked={selectedIds.size === cargo.length && cargo.length > 0}
                            onCheckedChange={handleSelectAll}
                          />
                        </TableHead>
                        <TableHead>Трак дугаар</TableHead>
                        <TableHead>Утас</TableHead>
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
                          <TableCell>{item.phone_number || '-'}</TableCell>
                          <TableCell>{item.weight ? `${item.weight} кг` : '-'}</TableCell>
                          <TableCell>{item.shelf_location || '-'}</TableCell>
                          <TableCell className="font-medium">{item.price?.toLocaleString()}₮</TableCell>
                          <TableCell>
                            <CargoStatusBadge status={item.status} />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {selectedIds.size > 0 && (
                  <div className="mt-6 space-y-4 border-t pt-4">
                    {/* Payment Method */}
                    <div className="space-y-3">
                      <Label className="text-base font-medium">Төлбөрийн хэлбэр</Label>
                      <RadioGroup
                        value={paymentMethod}
                        onValueChange={(v) => setPaymentMethod(v as PaymentMethod)}
                        className="flex flex-wrap gap-4"
                      >
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="transfer" id="transfer" />
                          <Label htmlFor="transfer" className="flex items-center gap-1 cursor-pointer">
                            <Wallet className="h-4 w-4" />
                            Шилжүүлэг
                          </Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="card" id="card" />
                          <Label htmlFor="card" className="flex items-center gap-1 cursor-pointer">
                            <CreditCard className="h-4 w-4" />
                            Карт
                          </Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="cash" id="cash" />
                          <Label htmlFor="cash" className="flex items-center gap-1 cursor-pointer">
                            <Banknote className="h-4 w-4" />
                            Бэлэн
                          </Label>
                        </div>
                      </RadioGroup>
                    </div>

                    {/* Summary and Actions */}
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                      <div>
                        <p className="text-muted-foreground">
                          Сонгосон: {selectedIds.size} ширхэг
                        </p>
                        <p className="text-2xl font-bold text-primary">
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
