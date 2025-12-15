import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { api } from '@/lib/api-client';
import type { GetLeadResponse } from '@shared/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Check } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Table, TableBody, TableCell, TableRow } from '@/components/ui/table';
const riskLevelColors: Record<string, string> = {
  low: 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300',
  medium: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300',
  high: 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300',
};
export default function AdminLeadDetailPage() {
  const { leadId } = useParams<{ leadId: string }>();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { data, isLoading, error } = useQuery<GetLeadResponse>({
    queryKey: ['lead', leadId],
    queryFn: () => api(`/api/leads/${leadId}`),
    enabled: !!leadId,
  });
  const mutation = useMutation({
    mutationFn: (newStatus: 'new' | 'done') => api(`/api/leads/${leadId}/status`, {
      method: 'POST',
      body: JSON.stringify({ status: newStatus }),
    }),
    onSuccess: () => {
      toast.success('Status updated successfully');
      queryClient.invalidateQueries({ queryKey: ['lead', leadId] });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
    },
    onError: (err) => {
      toast.error(`Failed to update status: ${err.message}`);
    },
  });
  if (isLoading) return <Skeleton className="h-96 w-full" />;
  if (error || !data) return <div className="text-destructive text-center p-8">Error loading lead details.</div>;
  const { lead, scores, answers } = data;
  return (
    <div className="space-y-8">
      <Button asChild variant="ghost">
        <Link to="/admin"><ArrowLeft className="mr-2 h-4 w-4" /> {t('admin.detail.back')}</Link>
      </Button>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <Card>
            <CardHeader><CardTitle>{t('admin.detail.info')}</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <p><strong>{t('admin.table.company')}:</strong> {lead.company_name}</p>
              <p><strong>{t('admin.table.contact')}:</strong> {lead.contact_name}</p>
              <p><strong>{t('contact.email')}:</strong> {lead.email}</p>
              <p><strong>{t('contact.phone')}:</strong> {lead.phone}</p>
              <p><strong>{t('contact.employee_count')}:</strong> {lead.employee_range}</p>
              <p><strong>{t('admin.table.created_at')}:</strong> {new Date(lead.created_at).toLocaleString()}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>{t('admin.detail.answers')}</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableBody>
                  {answers.map(a => (
                    <TableRow key={a.id}>
                      <TableCell className="font-medium">{a.question_key}</TableCell>
                      <TableCell>{a.answer_value}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
        <div className="space-y-8">
          <Card>
            <CardHeader><CardTitle>{t('admin.detail.status_card')}</CardTitle></CardHeader>
            <CardContent className="flex items-center space-x-2">
              <Switch
                id="status-switch"
                checked={lead.status === 'done'}
                onCheckedChange={(checked) => mutation.mutate(checked ? 'done' : 'new')}
                disabled={mutation.isPending}
              />
              <Label htmlFor="status-switch">{t('admin.detail.mark_done')}</Label>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>{t('admin.detail.scores')}</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="text-center">
                <p className="text-4xl font-bold">{scores.score_total}%</p>
                <Badge className={riskLevelColors[scores.risk_level]}>{t(`result.risk.${scores.risk_level}`)}</Badge>
              </div>
              <p><strong>{t('score.vpn')}:</strong> {scores.score_vpn}</p>
              <p><strong>{t('score.web')}:</strong> {scores.score_web}</p>
              <p><strong>{t('score.awareness')}:</strong> {scores.score_awareness}</p>
              <p><strong>{t('score.stack')}:</strong> {scores.score_stack}</p>
              <p><strong>{t('score.zero_trust')}:</strong> {scores.score_zero_trust}</p>
              {scores.best_practice_architecture === 1 && <p className="flex items-center text-blue-600"><Check className="mr-2 h-5 w-5" /> {t('result.best_practice')}</p>}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}