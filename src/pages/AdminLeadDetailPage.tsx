import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { api } from '@/lib/api-client';
import type { GetLeadResponse, LeadAnswer } from '@shared/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, AtSign, Building, Phone, User, CheckCircle, XCircle } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { allQuestions } from '@/lib/questions';
import { useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';

const riskLevelColors: Record<string, string> = {
  low: 'border-green-500/50 bg-green-500/10 text-green-400',
  medium: 'border-yellow-500/50 bg-yellow-500/10 text-yellow-400',
  high: 'border-red-500/50 bg-red-500/10 text-red-400',
};

export default function AdminLeadDetailPage() {
  const { leadId } = useParams<{ leadId: string }>();
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery<GetLeadResponse>({
    queryKey: ['lead', leadId],
    queryFn: () => api(`/api/leads/${leadId}`),
    enabled: !!leadId,
  });

  useEffect(() => {
    if (data?.lead?.language) {
      i18n.changeLanguage(data.lead.language);
    }
  }, [data?.lead?.language, i18n]);

  const mutation = useMutation({
    mutationFn: (status: 'new' | 'done') =>
      api(`/api/leads/${leadId}/status`, {
        method: 'POST',
        body: JSON.stringify({ status }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead', leadId] });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      toast.success('Status updated');
    },
  });

  if (isLoading) return <Skeleton className="h-64 w-full" />;
  if (error || !data) return <div className="p-8 text-destructive">Error loading lead details.</div>;

  const { lead, scores } = data;

  return (
    <div className="space-y-8">
      <Button asChild variant="ghost">
        <Link to="/admin">
          <ArrowLeft className="mr-2 h-4 w-4" />
          {t('admin.detail.back')}
        </Link>
      </Button>

      <Card>
        <CardHeader className="flex flex-row justify-between items-center">
          <div>
            <CardTitle>{lead.company_name}</CardTitle>
            <p className="text-sm text-muted-foreground">
              {new Date(lead.created_at).toLocaleString()}
            </p>
          </div>

          {scores && (
            <Badge className={riskLevelColors[scores.risk_level]}>
              {t(`result.risk.${scores.risk_level}`)}
            </Badge>
          )}
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('admin.table.contact')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div><User /> {lead.contact_name}</div>
          <div><AtSign /> {lead.email}</div>
          <div><Phone /> {lead.phone}</div>
          <div><Building /> {lead.employee_range}</div>
        </CardContent>
      </Card>
    </div>
  );
}
