import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { Search, Building2, Copy, Check } from 'lucide-react';
import { format } from 'date-fns';
import { useTranslation } from 'react-i18next';
import { getDateFnsLocale } from '@/lib/locale';

interface Company {
  id: string;
  name: string;
  slug: string;
  email: string | null;
  phone: string | null;
  is_active: boolean;
  subscription_plan: string;
  subscription_start: string;
  subscription_end: string;
  max_users: number;
  max_products: number;
  invitation_code: string | null;
  created_at: string;
}

export const CompanyList = () => {
  const { t } = useTranslation();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const fetchCompanies = async () => {
    try {
      const { data, error } = await supabase
        .from('companies')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setCompanies((data as Company[]) || []);
    } catch (err) {
      console.error('Error fetching companies:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCompanies();
  }, []);

  const handleToggleActive = async (companyId: string, currentActive: boolean) => {
    try {
      const { error } = await supabase
        .from('companies')
        .update({ is_active: !currentActive })
        .eq('id', companyId);

      if (error) throw error;

      toast({
        title: currentActive ? t('superAdmin.companies_list.toast_suspended_title') : t('superAdmin.companies_list.toast_activated_title'),
        description: currentActive ? t('superAdmin.companies_list.toast_suspended_desc') : t('superAdmin.companies_list.toast_activated_desc'),
      });
      fetchCompanies();
    } catch (err) {
      toast({ title: t('superAdmin.common.error'), description: t('superAdmin.companies_list.toast_status_error'), variant: 'destructive' });
    }
  };

  const handleChangePlan = async (companyId: string, newPlan: string) => {
    try {
      const planLimits: Record<string, { max_users: number; max_products: number }> = {
        trial: { max_users: 3, max_products: 50 },
        basic: { max_users: 5, max_products: 200 },
        pro: { max_users: 15, max_products: 1000 },
        premium: { max_users: 999999, max_products: 999999 },
      };

      const limits = planLimits[newPlan] || planLimits.trial;
      const newEnd = new Date();
      newEnd.setDate(newEnd.getDate() + (newPlan === 'trial' ? 30 : 365));

      const { error } = await supabase
        .from('companies')
        .update({
          subscription_plan: newPlan,
          subscription_end: newEnd.toISOString().split('T')[0],
          max_users: limits.max_users,
          max_products: limits.max_products,
        })
        .eq('id', companyId);

      if (error) throw error;
      toast({ title: t('superAdmin.companies_list.toast_plan_changed'), description: t('superAdmin.companies_list.toast_plan_changed_desc', { plan: newPlan }) });
      fetchCompanies();
    } catch (err) {
      toast({ title: t('superAdmin.common.error'), description: t('superAdmin.companies_list.toast_plan_error'), variant: 'destructive' });
    }
  };

  const handleExtendTrial = async (companyId: string) => {
    try {
      const newEnd = new Date();
      newEnd.setDate(newEnd.getDate() + 30);

      const { error } = await supabase
        .from('companies')
        .update({ subscription_end: newEnd.toISOString().split('T')[0] })
        .eq('id', companyId);

      if (error) throw error;
      toast({ title: t('superAdmin.companies_list.toast_extended'), description: t('superAdmin.companies_list.toast_extended_desc') });
      fetchCompanies();
    } catch (err) {
      toast({ title: t('superAdmin.common.error'), description: t('superAdmin.companies_list.toast_extend_error'), variant: 'destructive' });
    }
  };

  const copyInvitationCode = (code: string, companyId: string) => {
    navigator.clipboard.writeText(code);
    setCopiedId(companyId);
    setTimeout(() => setCopiedId(null), 2000);
    toast({ title: t('superAdmin.companies_list.toast_code_copied'), description: code });
  };

  const filtered = companies.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.email?.toLowerCase().includes(search.toLowerCase()) ||
      c.slug.toLowerCase().includes(search.toLowerCase())
  );

  const today = new Date().toISOString().split('T')[0];

  const getPlanBadge = (plan: string) => {
    const variants: Record<string, string> = {
      trial: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
      basic: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
      pro: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
      premium: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    };
    return <Badge className={variants[plan] || ''}>{plan}</Badge>;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <CardTitle className="flex items-center gap-2">
            <Building2 className="w-5 h-5" />
            {t('superAdmin.companies_list.title', { count: filtered.length })}
          </CardTitle>
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder={t('superAdmin.common.search')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-2 sm:p-6 pt-0">
        {loading ? (
          <p className="text-center text-muted-foreground py-8">{t('superAdmin.common.loading')}</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs sm:text-sm">{t('superAdmin.companies_list.header_company')}</TableHead>
                  <TableHead className="text-xs sm:text-sm">{t('superAdmin.companies_list.header_plan')}</TableHead>
                  <TableHead className="text-xs sm:text-sm">{t('superAdmin.companies_list.header_status')}</TableHead>
                  <TableHead className="text-xs sm:text-sm hidden sm:table-cell">{t('superAdmin.companies_list.header_expiration')}</TableHead>
                  <TableHead className="text-xs sm:text-sm hidden md:table-cell">{t('superAdmin.companies_list.header_invitation')}</TableHead>
                  <TableHead className="text-xs sm:text-sm">{t('superAdmin.companies_list.header_actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((company) => {
                  const isExpired = company.subscription_end < today;
                  return (
                    <TableRow key={company.id}>
                      <TableCell className="p-2 sm:p-4">
                        <div>
                          <p className="font-medium text-xs sm:text-sm">{company.name}</p>
                          <p className="text-[10px] sm:text-xs text-muted-foreground">{company.email || company.slug}</p>
                        </div>
                      </TableCell>
                      <TableCell className="p-2 sm:p-4">{getPlanBadge(company.subscription_plan)}</TableCell>
                      <TableCell className="p-2 sm:p-4">
                        {!company.is_active ? (
                          <Badge variant="destructive" className="text-[10px] sm:text-xs">{t('superAdmin.companies_list.status_suspended')}</Badge>
                        ) : isExpired ? (
                          <Badge variant="outline" className="border-destructive text-destructive text-[10px] sm:text-xs">{t('superAdmin.companies_list.status_expired')}</Badge>
                        ) : (
                          <Badge variant="outline" className="border-green-500 text-green-600 text-[10px] sm:text-xs">{t('superAdmin.companies_list.status_active')}</Badge>
                        )}
                      </TableCell>
                      <TableCell className="p-2 sm:p-4 hidden sm:table-cell">
                        <span className={`text-xs sm:text-sm ${isExpired ? 'text-destructive font-medium' : ''}`}>
                          {format(new Date(company.subscription_end), 'dd MMM yyyy', { locale: getDateFnsLocale() })}
                        </span>
                      </TableCell>
                      <TableCell className="p-2 sm:p-4 hidden md:table-cell">
                        {company.invitation_code && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="font-mono text-[10px] sm:text-xs h-7"
                            onClick={() => copyInvitationCode(company.invitation_code!, company.id)}
                          >
                            {copiedId === company.id ? (
                              <><Check className="w-3 h-3 mr-1" /> {t('superAdmin.companies_list.copied')}</>
                            ) : (
                              <><Copy className="w-3 h-3 mr-1" /> {company.invitation_code}</>
                            )}
                          </Button>
                        )}
                      </TableCell>
                      <TableCell className="p-2 sm:p-4">
                        <div className="flex items-center gap-1 flex-wrap">
                          <Button
                            variant={company.is_active ? 'outline' : 'default'}
                            size="sm"
                            className="text-[10px] sm:text-xs h-7 px-2 sm:px-3"
                            onClick={() => handleToggleActive(company.id, company.is_active)}
                          >
                            {company.is_active ? t('superAdmin.companies_list.suspend') : t('superAdmin.companies_list.activate')}
                          </Button>
                          <Select
                            value={company.subscription_plan}
                            onValueChange={(v) => handleChangePlan(company.id, v)}
                          >
                            <SelectTrigger className="w-20 sm:w-24 h-7 sm:h-8 text-[10px] sm:text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="trial">Trial</SelectItem>
                              <SelectItem value="basic">Basic</SelectItem>
                              <SelectItem value="pro">Pro</SelectItem>
                              <SelectItem value="premium">Premium</SelectItem>
                            </SelectContent>
                          </Select>
                          <Button variant="ghost" size="sm" className="h-7 text-[10px] sm:text-xs px-1.5 sm:px-3" onClick={() => handleExtendTrial(company.id)}>
                            {t('superAdmin.companies_list.extend_30d')}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8 text-xs sm:text-sm">
                      {t('superAdmin.companies_list.no_companies')}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
