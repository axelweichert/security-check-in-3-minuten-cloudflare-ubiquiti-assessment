import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { api } from '@/lib/api-client';
import type { LeadListItem } from '@shared/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Download, Eye } from 'lucide-react';
const riskLevelColors: Record<string, string> = {
  low: 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300',
  medium: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300',
  high: 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300',
};
export default function AdminPage() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryParams = useMemo(() => searchParams.toString(), [searchParams]);
  const { data, isLoading, error } = useQuery<{ items: LeadListItem[] }>({
    queryKey: ['leads', queryParams],
    queryFn: () => api(`/api/leads?${queryParams}`),
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
  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold tracking-tight">{t('admin.title')}</h1>
        <Button asChild className="bg-[#F48120] hover:bg-[#F48120]/90 text-white">
          <a href={`/api/leads/export.csv?${queryParams}`} download>
            <Download className="mr-2 h-4 w-4" />
            {t('admin.export_csv')}
          </a>
        </Button>
      </div>
      <Card>
        <CardHeader><CardTitle>{t('admin.filters.title')}</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Input type="date" placeholder={t('admin.filters.date_from')} value={searchParams.get('from') || ''} onChange={e => handleFilterChange('from', e.target.value)} />
          <Input type="date" placeholder={t('admin.filters.date_to')} value={searchParams.get('to') || ''} onChange={e => handleFilterChange('to', e.target.value)} />
          <Select value={searchParams.get('status') || 'all'} onValueChange={v => handleFilterChange('status', v)}>
            <SelectTrigger><SelectValue placeholder={t('admin.filters.status')} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('admin.filters.status.all')}</SelectItem>
              <SelectItem value="new">{t('admin.filters.status.new')}</SelectItem>
              <SelectItem value="done">{t('admin.filters.status.done')}</SelectItem>
            </SelectContent>
          </Select>
          <Select value={searchParams.get('risk') || 'all'} onValueChange={v => handleFilterChange('risk', v)}>
            <SelectTrigger><SelectValue placeholder={t('admin.filters.risk')} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('admin.filters.risk.all')}</SelectItem>
              <SelectItem value="low">{t('admin.filters.risk.low')}</SelectItem>
              <SelectItem value="medium">{t('admin.filters.risk.medium')}</SelectItem>
              <SelectItem value="high">{t('admin.filters.risk.high')}</SelectItem>
            </SelectContent>
          </Select>
          <Select value={searchParams.get('discount') || 'all'} onValueChange={v => handleFilterChange('discount', v)}>
            <SelectTrigger><SelectValue placeholder={t('admin.filters.discount')} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('admin.filters.discount.all')}</SelectItem>
              <SelectItem value="yes">{t('admin.filters.discount.yes')}</SelectItem>
              <SelectItem value="no">{t('admin.filters.discount.no')}</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={clearFilters} className="col-start-1">{t('admin.filters.clear')}</Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>{t('admin.leads')}</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('admin.table.company')}</TableHead>
                <TableHead>{t('admin.table.created_at')}</TableHead>
                <TableHead>{t('admin.table.status')}</TableHead>
                <TableHead>{t('admin.table.risk')}</TableHead>
                <TableHead>{t('admin.table.discount')}</TableHead>
                <TableHead>{t('admin.table.actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}><TableCell colSpan={6}><Skeleton className="h-8 w-full" /></TableCell></TableRow>
                ))
              ) : error ? (
                <TableRow><TableCell colSpan={6} className="text-center text-destructive">Error loading leads.</TableCell></TableRow>
              ) : data?.items.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center">No leads found.</TableCell></TableRow>
              ) : (
                data?.items.map(lead => (
                  <TableRow key={lead.id}>
                    <TableCell className="font-medium">{lead.company_name}</TableCell>
                    <TableCell>{new Date(lead.created_at).toLocaleDateString()}</TableCell>
                    <TableCell><Badge variant={lead.status === 'new' ? 'default' : 'secondary'}>{lead.status}</Badge></TableCell>
                    <TableCell><Badge className={riskLevelColors[lead.risk_level || '']}>{lead.risk_level}</Badge></TableCell>
                    <TableCell>{lead.discount_opt_in ? t('admin.filters.discount.yes') : t('admin.filters.discount.no')}</TableCell>
                    <TableCell>
                      <Button asChild variant="ghost" size="icon">
                        <Link to={`/admin/leads/${lead.id}`}><Eye className="h-4 w-4" /></Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}