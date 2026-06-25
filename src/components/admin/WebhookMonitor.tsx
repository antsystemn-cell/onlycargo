import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { RefreshCw, AlertTriangle, CheckCircle2, Clock, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Delivery {
  id: string;
  event: string;
  event_id: string | null;
  target_url: string;
  response_status: number | null;
  response_body: string | null;
  success: boolean;
  status: string;
  attempts: number;
  max_attempts: number;
  last_attempt_at: string | null;
  next_retry_at: string | null;
  last_error: string | null;
  payload: any;
  created_at: string;
  api_key_id: string;
}

interface Summary {
  total: number;
  success: number;
  pending: number;
  dead: number;
  last_at: string | null;
}

export default function WebhookMonitor() {
  const { toast } = useToast();
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [summary, setSummary] = useState<Summary>({ total: 0, success: 0, pending: 0, dead: 0, last_at: null });
  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState<string | null>(null);
  const [inspect, setInspect] = useState<Delivery | null>(null);

  const fetchAll = async () => {
    setLoading(true);
    const since = new Date(Date.now() - 7 * 86400_000).toISOString();
    const { data } = await supabase
      .from('webhook_deliveries')
      .select('*')
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(100);

    const rows = (data || []) as unknown as Delivery[];
    setDeliveries(rows);
    setSummary({
      total: rows.length,
      success: rows.filter((r) => r.status === 'success').length,
      pending: rows.filter((r) => r.status === 'pending').length,
      dead: rows.filter((r) => r.status === 'dead').length,
      last_at: rows[0]?.created_at || null,
    });
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  const handleRetry = async (id: string) => {
    setRetrying(id);
    try {
      const { error } = await supabase.functions.invoke('webhook-retry', {
        body: { delivery_id: id },
      });
      if (error) throw error;
      toast({ title: 'Дахин илгээлээ' });
      await fetchAll();
    } catch (e: any) {
      toast({ title: 'Алдаа', description: e.message, variant: 'destructive' });
    } finally {
      setRetrying(null);
    }
  };

  const statusBadge = (s: string) => {
    if (s === 'success') return <Badge className="bg-green-600">Амжилттай</Badge>;
    if (s === 'dead') return <Badge variant="destructive">Бүтэлгүйтсэн</Badge>;
    if (s === 'pending') return <Badge variant="secondary">Хүлээгдэж буй</Badge>;
    return <Badge variant="outline">{s}</Badge>;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Send className="h-4 w-4" />
              Webhook мониторинг
            </CardTitle>
            <CardDescription>Сүүлийн 7 хоногийн дамжуулалт, retry queue, гар retry</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={fetchAll} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
            Шинэчлэх
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <SummaryTile icon={<Send className="h-4 w-4" />} label="Нийт" value={summary.total} />
          <SummaryTile icon={<CheckCircle2 className="h-4 w-4 text-green-600" />} label="Амжилттай" value={summary.success} />
          <SummaryTile icon={<Clock className="h-4 w-4 text-yellow-600" />} label="Retry queue" value={summary.pending} />
          <SummaryTile icon={<AlertTriangle className="h-4 w-4 text-destructive" />} label="Бүтэлгүйтсэн" value={summary.dead} />
        </div>
        <div className="text-xs text-muted-foreground">
          Сүүлийн дамжуулалт: {summary.last_at ? format(new Date(summary.last_at), 'yyyy-MM-dd HH:mm:ss') : 'Байхгүй'}
        </div>

        <div className="border rounded-md overflow-auto max-h-[480px]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Огноо</TableHead>
                <TableHead>Event</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>HTTP</TableHead>
                <TableHead>Attempts</TableHead>
                <TableHead>Next retry</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {deliveries.map((d) => (
                <TableRow key={d.id} className="cursor-pointer" onClick={() => setInspect(d)}>
                  <TableCell className="text-xs whitespace-nowrap">{format(new Date(d.created_at), 'MM/dd HH:mm:ss')}</TableCell>
                  <TableCell className="text-xs font-mono">{d.event}</TableCell>
                  <TableCell>{statusBadge(d.status)}</TableCell>
                  <TableCell className="text-xs">{d.response_status ?? '—'}</TableCell>
                  <TableCell className="text-xs">{d.attempts}/{d.max_attempts}</TableCell>
                  <TableCell className="text-xs">
                    {d.next_retry_at ? format(new Date(d.next_retry_at), 'MM/dd HH:mm') : '—'}
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    {(d.status === 'pending' || d.status === 'dead') && (
                      <Button size="sm" variant="outline" disabled={retrying === d.id} onClick={() => handleRetry(d.id)}>
                        <RefreshCw className={`h-3 w-3 ${retrying === d.id ? 'animate-spin' : ''}`} />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {deliveries.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    Дамжуулалт байхгүй
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>

      <Dialog open={!!inspect} onOpenChange={(o) => !o && setInspect(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>Webhook delivery</DialogTitle>
            <DialogDescription className="text-xs font-mono">{inspect?.target_url}</DialogDescription>
          </DialogHeader>
          {inspect && (
            <div className="space-y-3 text-xs">
              <div><span className="font-semibold">Event ID:</span> <code>{inspect.event_id}</code></div>
              <div><span className="font-semibold">Status:</span> {inspect.status} ({inspect.response_status ?? 'n/a'})</div>
              <div><span className="font-semibold">Attempts:</span> {inspect.attempts}/{inspect.max_attempts}</div>
              {inspect.last_error && (
                <div className="text-destructive">
                  <span className="font-semibold">Error:</span> {inspect.last_error}
                </div>
              )}
              <div>
                <p className="font-semibold mb-1">Payload</p>
                <pre className="bg-muted p-2 rounded overflow-auto text-[10px]">{JSON.stringify(inspect.payload, null, 2)}</pre>
              </div>
              {inspect.response_body && (
                <div>
                  <p className="font-semibold mb-1">Response</p>
                  <pre className="bg-muted p-2 rounded overflow-auto text-[10px]">{inspect.response_body}</pre>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function SummaryTile({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="border rounded-md p-3">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">{icon}{label}</div>
      <div className="text-2xl font-semibold mt-1">{value}</div>
    </div>
  );
}
