import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { api } from '@/lib/api-client';
import type { LeadListItem } from '@shared/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Download, Eye, Filter as FilterIcon, LogOut, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

const riskLevelColors: Record<string, string> = {
  low: 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300 border-green-300/50',
  medium: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300 border-yellow-300/50',
  high: 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300 border-red-300/50',
};

function normalizeRisk(v: unknown): 'low' | 'medium' | 'high' | null {
  const s = (v ?? '').toString().toLowerCase().trim();
  if (s === 'low' || s === 'medium' || s === 'high') return s;
  return null;
}

export default function AdminPage() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryParams = useMemo(() => searchParams.toString(), [searchParams]);

  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery<LeadListItem[]>({
    queryKey: ['leads', queryParams],
    queryFn: () => api<LeadListItem[]>(`/api/leads?${queryParams}`),
  });

  const purgeMutation = useMutation({
    mutationFn: () => api('/api/admin/purge', { method: 'POST' }),
    onSuccess: (res: any) => {
      const deletedLeads = res?.deleted?.leads ?? null;
      toast.success(deletedLeads != null ? `Daten gelöscht: ${deletedLeads} Leads` : 'Daten wurden gelöscht.');
      queryClient.invalidateQueries({ queryKey: ['leads'] });
    },
    onError: (err: any) => {
      toast.error(`Löschen fehlgeschlagen: ${err instanceof Error ? err.message : 'Unknown error'}`);
    },
  });

  const handleFilterChange = (key: string, value: string) => {
    setSearchParams(prev => {
      if (!value || value === 'all') {
        prev.delete(key);
      } else {
        prev.set(key, value);
      }
      return prev;
    });
  };

  const clearFilters = () => setSearchParams({});

  const handleLogout = () => {
    // /api/logout antwortet mit 401 + WWW-Authenticate -> Browser fordert erneute Anmeldung an.
    window.location.href = '/api/logout';
  };

  const handlePurge = () => {
    if (purgeMutation.isPending) return;

    const ok = window.confirm(
      'Wirklich ALLE Leads und Antworten löschen?\n\nDieser Vorgang kann nicht rückgängig gemacht werden.'
    );
    if (!ok) return;

    purgeMutation.mutate();
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-center">
        <h1 className="text-3xl font-bold tracking-tight">{t('admin.title')}</h1>

        <div className="flex flex-wrap gap-2">
          <Button asChild className="btn-cyber">
            <a href={`/api/leads/export.csv?${queryParams}`} download>
              <Download className="mr-2 h-4 w-4" />
              {t('admin.export_csv')}
            </a>
          </Button>

          <Button variant="outline" onClick={handleLogout}>
            <LogOut className="mr-2 h-4 w-4" />
            Logout
          </Button>

          <Button variant="destructive" onClick={handlePurge} disabled={purgeMutation.isPending}>
            <Trash2 className="mr-2 h-4 w-4" />
            Daten löschen
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FilterIcon className="h-5 w-5" /> {t('admin.filters.title')}
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 items-end">
          <div className="space-y-2">
            <Label htmlFor="from">{t('admin.filters.date_from')}</Label>
            <Input
              id="from"
              type="date"
              value={searchParams.get('from') || ''}
              onChange={e => handleFilterChange('from', e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="to">{t('admin.filters.date_to')}</Label>
            <Input
              id="to"
              type="date"
              value={searchParams.get('to') || ''}
              onChange={e => handleFilterChange('to', e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>{t('admin.filters.status')}</Label>
            <Select value={searchParams.get('status') || 'all'} onValueChange={v => handleFilterChange('status', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('admin.filters.status.all')}</SelectItem>
                <SelectItem value="new">{t('admin.filters.status.new')}</SelectItem>
                <SelectItem value="done">{t('admin.filters.status.done')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>{t('admin.filters.risk')}</Label>
            <Select value={searchParams.get('risk') || 'all'} onValueChange={v => handleFilterChange('risk', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('admin.filters.risk.all')}</SelectItem>
                <SelectItem value="low">{t('admin.filters.risk.low')}</SelectItem>
                <SelectItem value="medium">{t('admin.filters.risk.medium')}</SelectItem>
                <SelectItem value="high">{t('admin.filters.risk.high')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>{t('admin.filters.discount')}</Label>
            <Select value={searchParams.get('discount') || 'all'} onValueChange={v => handleFilterChange('discount', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('admin.filters.discount.all')}</SelectItem>
                <SelectItem value="yes">{t('admin.filters.discount.yes')}</SelectItem>
                <SelectItem value="no">{t('admin.filters.discount.no')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button variant="outline" onClick={clearFilters}>{t('admin.filters.clear')}</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>{t('admin.leads')}</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('admin.table.company')}</TableHead>
                <TableHead>{t('admin.table.created_at')}</TableHead>
                <TableHead>{t('admin.table.status')}</TableHead>
                <TableHead>{t('admin.table.risk')}</TableHead>
                <TableHead>{t('admin.table.discount')}</TableHead>
                <TableHead className="text-right">{t('admin.table.actions')}</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={6}><Skeleton className="h-8 w-full" /></TableCell>
                  </TableRow>
                ))
              ) : error ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-destructive">Error loading leads.</TableCell>
                </TableRow>
              ) : (data?.length ?? 0) === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center">No leads found.</TableCell>
                </TableRow>
              ) : (
                (data ?? []).map(lead => {
                  const risk = normalizeRisk(lead.risk_level) ?? 'medium';
                  return (
                    <TableRow key={lead.id} className="hover:bg-accent/50 transition-colors">
                      <TableCell className="font-medium">{lead.company_name}</TableCell>
                      <TableCell>{new Date(lead.created_at).toLocaleDateString()}</TableCell>
                      <TableCell>
                        <Badge variant={lead.status === 'new' ? 'default' : 'secondary'}>
                          {t(`admin.filters.status.${lead.status === 'done' ? 'done' : 'new'}`)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={riskLevelColors[risk]}>
                          {t(`result.risk.${risk}`)}
                        </Badge>
                      </TableCell>
                      <TableCell>{lead.discount_opt_in ? t('admin.filters.discount.yes') : t('admin.filters.discount.no')}</TableCell>
                      <TableCell className="text-right">
                        <Button asChild variant="ghost" size="icon" className="hover:scale-110 transition-transform">
                          <Link to={`/admin/leads/${lead.id}`}><Eye className="h-4 w-4" /></Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
