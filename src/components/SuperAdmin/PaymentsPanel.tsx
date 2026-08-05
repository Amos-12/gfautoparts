import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { Search, CreditCard, DollarSign, TrendingUp, Receipt, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import jsPDF from 'jspdf';
import { format } from 'date-fns';
import { useTranslation } from 'react-i18next';
import { getDateFnsLocale } from '@/lib/locale';

interface Payment {
  id: string;
  company_id: string;
  amount: number;
  currency: string;
  payment_method: string;
  payment_reference: string | null;
  status: string;
  plan_id: string | null;
  billing_period: string | null;
  created_at: string;
  completed_at: string | null;
}

interface Invoice {
  id: string;
  company_id: string;
  invoice_number: string;
  amount: number;
  currency: string | null;
  plan_name: string | null;
  period_start: string | null;
  period_end: string | null;
  status: string | null;
  created_at: string | null;
}

export const PaymentsPanel = () => {
  const { t } = useTranslation();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [companies, setCompanies] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [view, setView] = useState<'payments' | 'invoices'>('payments');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [paymentsRes, invoicesRes, companiesRes] = await Promise.all([
        supabase.from('payments').select('*').order('created_at', { ascending: false }),
        supabase.from('subscription_invoices').select('*').order('created_at', { ascending: false }),
        supabase.from('companies').select('id, name'),
      ]);

      if (paymentsRes.data) setPayments(paymentsRes.data);
      if (invoicesRes.data) setInvoices(invoicesRes.data);
      if (companiesRes.data) {
        const map: Record<string, string> = {};
        companiesRes.data.forEach(c => { map[c.id] = c.name; });
        setCompanies(map);
      }
    } catch (err) {
      toast({ title: t('superAdmin.common.error'), description: t('superAdmin.payments_panel.toast_load_error'), variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const totalRevenue = payments
    .filter(p => p.status === 'completed')
    .reduce((sum, p) => sum + (p.currency === 'USD' ? p.amount : 0), 0);

  const completedCount = payments.filter(p => p.status === 'completed').length;
  const pendingCount = payments.filter(p => p.status === 'pending').length;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed': case 'paid': return <Badge className="bg-green-500/10 text-green-600 border-green-500/20">{t('superAdmin.payments_panel.status_completed')}</Badge>;
      case 'pending': return <Badge variant="outline" className="text-yellow-600 border-yellow-500/30">{t('superAdmin.payments_panel.status_pending')}</Badge>;
      case 'failed': return <Badge variant="destructive">{t('superAdmin.payments_panel.status_failed')}</Badge>;
      default: return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getMethodBadge = (method: string) => {
    switch (method) {
      case 'stripe': return <Badge variant="outline" className="text-blue-600 border-blue-500/30">Stripe</Badge>;
      case 'moncash': return <Badge variant="outline" className="text-orange-600 border-orange-500/30">MonCash</Badge>;
      case 'natcash': return <Badge variant="outline" className="text-purple-600 border-purple-500/30">NatCash</Badge>;
      default: return <Badge variant="secondary">{method}</Badge>;
    }
  };

  const filteredPayments = payments.filter(p => {
    const companyName = companies[p.company_id] || '';
    const matchesSearch = companyName.toLowerCase().includes(search.toLowerCase()) ||
      (p.payment_reference || '').toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || p.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const downloadInvoicePdf = (invoice: Invoice) => {
    const doc = new jsPDF();
    const companyName = companies[invoice.company_id] || 'N/A';
    
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text(t('superAdmin.payments_panel.pdf_invoice'), 105, 25, { align: 'center' });
    
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text(t('superAdmin.payments_panel.pdf_number', { number: invoice.invoice_number }), 105, 35, { align: 'center' });
    
    doc.setDrawColor(200);
    doc.line(20, 42, 190, 42);
    
    let y = 55;
    const addRow = (label: string, value: string) => {
      doc.setFont('helvetica', 'bold');
      doc.text(label, 25, y);
      doc.setFont('helvetica', 'normal');
      doc.text(value, 80, y);
      y += 10;
    };
    
    addRow(t('superAdmin.payments_panel.pdf_company'), companyName);
    addRow(t('superAdmin.payments_panel.pdf_plan'), (invoice.plan_name || '-').toUpperCase());
    addRow(t('superAdmin.payments_panel.pdf_amount'), `${invoice.amount} ${invoice.currency || 'USD'}`);
    addRow(t('superAdmin.payments_panel.pdf_status'), invoice.status === 'paid' ? t('superAdmin.payments_panel.pdf_status_paid') : (invoice.status || '-'));
    
    if (invoice.period_start && invoice.period_end) {
      addRow(t('superAdmin.payments_panel.pdf_period'), `${format(new Date(invoice.period_start), 'dd/MM/yyyy')} - ${format(new Date(invoice.period_end), 'dd/MM/yyyy')}`);
    }
    
    if (invoice.created_at) {
      addRow(t('superAdmin.payments_panel.pdf_date'), format(new Date(invoice.created_at), 'dd MMM yyyy', { locale: getDateFnsLocale() }));
    }
    
    y += 15;
    doc.setDrawColor(200);
    doc.line(20, y, 190, y);
    y += 10;
    doc.setFontSize(9);
    doc.setTextColor(128);
    doc.text(t('superAdmin.payments_panel.pdf_footer'), 105, y, { align: 'center' });
    
    doc.save(`${invoice.invoice_number}.pdf`);
  };

  const filteredInvoices = invoices.filter(i => {
    const companyName = companies[i.company_id] || '';
    return companyName.toLowerCase().includes(search.toLowerCase()) ||
      i.invoice_number.toLowerCase().includes(search.toLowerCase());
  });

  if (loading) {
    return <div className="text-center py-8 text-muted-foreground">{t('superAdmin.payments_panel.loading')}</div>;
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{t('superAdmin.payments_panel.kpi_revenue')}</p>
                <p className="text-2xl font-bold">${totalRevenue.toFixed(2)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{t('superAdmin.payments_panel.kpi_completed')}</p>
                <p className="text-2xl font-bold">{completedCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-yellow-500/10 flex items-center justify-center">
                <CreditCard className="w-5 h-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{t('superAdmin.payments_panel.kpi_pending')}</p>
                <p className="text-2xl font-bold">{pendingCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Receipt className="w-5 h-5" />
              {view === 'payments' ? t('superAdmin.payments_panel.view_payments') : t('superAdmin.payments_panel.view_invoices')}
            </CardTitle>
            <div className="flex gap-2">
              <button
                onClick={() => setView('payments')}
                className={`px-3 py-1.5 text-sm rounded-md transition-colors ${view === 'payments' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}
              >
                {t('superAdmin.payments_panel.view_payments')}
              </button>
              <button
                onClick={() => setView('invoices')}
                className={`px-3 py-1.5 text-sm rounded-md transition-colors ${view === 'invoices' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}
              >
                {t('superAdmin.payments_panel.view_invoices')}
              </button>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 mt-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder={t('superAdmin.common.search')} value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
            </div>
            {view === 'payments' && (
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('superAdmin.payments_panel.filter_all')}</SelectItem>
                  <SelectItem value="completed">{t('superAdmin.payments_panel.filter_completed')}</SelectItem>
                  <SelectItem value="pending">{t('superAdmin.payments_panel.filter_pending')}</SelectItem>
                  <SelectItem value="failed">{t('superAdmin.payments_panel.filter_failed')}</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {view === 'payments' ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('superAdmin.payments_panel.header_company')}</TableHead>
                    <TableHead>{t('superAdmin.payments_panel.header_plan')}</TableHead>
                    <TableHead>{t('superAdmin.payments_panel.header_amount')}</TableHead>
                    <TableHead>{t('superAdmin.payments_panel.header_method')}</TableHead>
                    <TableHead>{t('superAdmin.payments_panel.header_status')}</TableHead>
                    <TableHead>{t('superAdmin.payments_panel.header_date')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPayments.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">{t('superAdmin.payments_panel.no_payments')}</TableCell></TableRow>
                  ) : filteredPayments.map(p => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{companies[p.company_id] || p.company_id.slice(0, 8)}</TableCell>
                      <TableCell><Badge variant="outline" className="capitalize">{p.plan_id || '-'}</Badge></TableCell>
                      <TableCell>{p.amount} {p.currency}</TableCell>
                      <TableCell>{getMethodBadge(p.payment_method)}</TableCell>
                      <TableCell>{getStatusBadge(p.status)}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {format(new Date(p.created_at), 'dd MMM yyyy HH:mm', { locale: getDateFnsLocale() })}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('superAdmin.payments_panel.header_invoice')}</TableHead>
                    <TableHead>{t('superAdmin.payments_panel.header_company')}</TableHead>
                    <TableHead>{t('superAdmin.payments_panel.header_plan')}</TableHead>
                    <TableHead>{t('superAdmin.payments_panel.header_amount')}</TableHead>
                    <TableHead>{t('superAdmin.payments_panel.header_period')}</TableHead>
                    <TableHead>{t('superAdmin.payments_panel.header_status')}</TableHead>
                    <TableHead>{t('superAdmin.payments_panel.header_action')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredInvoices.length === 0 ? (
                    <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">{t('superAdmin.payments_panel.no_invoices')}</TableCell></TableRow>
                  ) : filteredInvoices.map(i => (
                    <TableRow key={i.id}>
                      <TableCell className="font-mono text-sm">{i.invoice_number}</TableCell>
                      <TableCell className="font-medium">{companies[i.company_id] || i.company_id.slice(0, 8)}</TableCell>
                      <TableCell><Badge variant="outline" className="capitalize">{i.plan_name || '-'}</Badge></TableCell>
                      <TableCell>{i.amount} {i.currency}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {i.period_start && i.period_end
                          ? `${format(new Date(i.period_start), 'dd/MM/yy')} - ${format(new Date(i.period_end), 'dd/MM/yy')}`
                          : '-'}
                      </TableCell>
                      <TableCell>{getStatusBadge(i.status || 'paid')}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" onClick={() => downloadInvoicePdf(i)} title={t('superAdmin.payments_panel.download_pdf')}>
                          <Download className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
