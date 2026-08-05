import { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { Building2, Save, Loader2, DollarSign, Image, MapPin, CreditCard, ChevronDown, Settings2, Check, AlertCircle, Copy, Users, RefreshCw, Crown, Mail, Package, UserCheck, Zap, Lock, CheckCircle2, Smartphone } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useSubscription } from '@/hooks/useSubscription';
import { useTranslation } from 'react-i18next';
import { formatLocalizedDate } from '@/lib/locale';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface CompanySettings {
  id: string;
  company_name: string;
  company_description: string;
  address: string;
  city: string;
  phone: string;
  email: string;
  tva_rate: number;
  payment_terms: string;
  logo_url?: string;
  logo_position_x?: number;
  logo_position_y?: number;
  logo_width?: number;
  logo_height?: number;
  usd_htg_rate?: number;
  default_display_currency?: 'USD' | 'HTG';
}

export const CompanySettings = () => {
  const { t } = useTranslation();
  const subscription = useSubscription();
  const { profile } = useAuth();
  const [settings, setSettings] = useState<CompanySettings | null>(null);
  const [originalSettings, setOriginalSettings] = useState<CompanySettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string>('');
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [invitationCode, setInvitationCode] = useState<string | null>(null);
  const [codeCopied, setCodeCopied] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [showRegenerateConfirm, setShowRegenerateConfirm] = useState(false);
  const [subscriptionPlans, setSubscriptionPlans] = useState<any[]>([]);
  const [paymentHistory, setPaymentHistory] = useState<any[]>([]);
  const [isAnnual, setIsAnnual] = useState(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<'stripe' | 'moncash'>('stripe');
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [openSections, setOpenSections] = useState({
    logo: true,
    company: true,
    address: false,
    currency: false,
    payment: false,
    subscription: false,
  });

  const isDirty = useCallback(() => {
    if (!settings || !originalSettings) return false;
    return JSON.stringify(settings) !== JSON.stringify(originalSettings);
  }, [settings, originalSettings]);

  const getModifiedFields = useCallback((): string[] => {
    if (!settings || !originalSettings) return [];
    const modified: string[] = [];
    const keys = Object.keys(settings) as (keyof CompanySettings)[];
    keys.forEach(key => {
      if (settings[key] !== originalSettings[key]) {
        modified.push(key);
      }
    });
    return modified;
  }, [settings, originalSettings]);

  useEffect(() => {
    fetchSettings();
    fetchSubscriptionPlans();
    fetchPaymentHistory();
  }, [profile?.company_id]);

  const fetchSubscriptionPlans = async () => {
    const { data } = await supabase
      .from('subscription_plans')
      .select('*')
      .eq('is_active', true)
      .order('price_monthly', { ascending: true });
    if (data) setSubscriptionPlans(data);
  };

  const fetchPaymentHistory = async () => {
    if (!profile?.company_id) return;
    const [paymentsRes, invoicesRes] = await Promise.all([
      supabase.from('payments').select('*').eq('status', 'completed').order('created_at', { ascending: false }).limit(10),
      supabase.from('subscription_invoices').select('*').order('created_at', { ascending: false }).limit(10),
    ]);
    const combined = [
      ...(paymentsRes.data || []).map((p: any) => ({ type: 'payment', ...p })),
      ...(invoicesRes.data || []).map((i: any) => ({ type: 'invoice', ...i, amount: i.amount, currency: i.currency || 'USD' })),
    ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    setPaymentHistory(combined);
  };

  const handleRegenerateCode = async () => {
    if (!settings) return;
    setRegenerating(true);
    try {
      const newCode = crypto.randomUUID().substring(0, 8);
      const { error } = await supabase
        .from('companies')
        .update({ invitation_code: newCode })
        .eq('id', settings.id);
      if (error) throw error;
      setInvitationCode(newCode);
      toast({ title: t('settings.invitation.regenerated'), description: t('settings.invitation.regeneratedDesc', { code: newCode }) });
    } catch (error) {
      console.error('Error regenerating code:', error);
      toast({ title: t('common.error'), description: t('settings.invitation.regenerateError'), variant: 'destructive' });
    } finally {
      setRegenerating(false);
    }
  };

  useEffect(() => {
    if (!isDirty() || saving) return;
    if (autoSaveTimeoutRef.current) clearTimeout(autoSaveTimeoutRef.current);
    autoSaveTimeoutRef.current = setTimeout(() => { handleSave(true); }, 2000);
    return () => { if (autoSaveTimeoutRef.current) clearTimeout(autoSaveTimeoutRef.current); };
  }, [settings, isDirty, saving]);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty()) {
        e.preventDefault();
        e.returnValue = '';
        return e.returnValue;
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  const fetchSettings = async () => {
    try {
      if (!profile?.company_id) { setLoading(false); return; }
      const { data, error } = await supabase.from('companies').select('*').eq('id', profile.company_id).single();
      if (error) throw error;
      const settingsData: CompanySettings = {
        id: data.id,
        company_name: data.name || '',
        company_description: data.company_description || '',
        address: data.address || '',
        city: data.city || '',
        phone: data.phone || '',
        email: data.email || '',
        tva_rate: data.tva_rate || 10,
        payment_terms: data.payment_terms || '',
        logo_url: data.logo_url,
        logo_position_x: data.logo_position_x,
        logo_position_y: data.logo_position_y,
        logo_width: data.logo_width,
        logo_height: data.logo_height,
        usd_htg_rate: data.usd_htg_rate,
        default_display_currency: (data.default_display_currency as 'USD' | 'HTG') || 'HTG'
      };
      setSettings(settingsData);
      setOriginalSettings(settingsData);
      if (data.logo_url) setLogoPreview(data.logo_url);
      setInvitationCode(data.invitation_code || null);
    } catch (error) {
      console.error('Error fetching company settings:', error);
      toast({ title: t('common.error'), description: t('settings.settingsLoadError'), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        toast({ title: t('settings.logo.fileTooLarge'), description: t('settings.logo.fileTooLargeDesc'), variant: "destructive" });
        return;
      }
      setLogoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => { setLogoPreview(reader.result as string); };
      reader.readAsDataURL(file);
    }
  };

  const handleLogoUpload = async () => {
    if (!logoFile || !settings) return;
    setUploading(true);
    try {
      const fileExt = logoFile.name.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `logos/${fileName}`;
      const { error: uploadError } = await supabase.storage.from('company-assets').upload(filePath, logoFile);
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from('company-assets').getPublicUrl(filePath);
      const { error: updateError } = await supabase.from('companies').update({ logo_url: publicUrl }).eq('id', settings.id);
      if (updateError) throw updateError;
      setSettings({ ...settings, logo_url: publicUrl });
      toast({ title: t('settings.logo.uploaded'), description: t('settings.logo.uploadedDesc') });
    } catch (error) {
      console.error('Error uploading logo:', error);
      toast({ title: t('common.error'), description: t('settings.logo.uploadError'), variant: "destructive" });
    } finally {
      setUploading(false);
      setLogoFile(null);
    }
  };

  const handleSave = async (isAutoSave = false) => {
    if (!settings) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('companies')
        .update({
          name: settings.company_name, company_description: settings.company_description,
          address: settings.address, city: settings.city, phone: settings.phone, email: settings.email,
          tva_rate: settings.tva_rate, payment_terms: settings.payment_terms,
          logo_position_x: settings.logo_position_x, logo_position_y: settings.logo_position_y,
          logo_width: settings.logo_width, logo_height: settings.logo_height,
          usd_htg_rate: settings.usd_htg_rate, default_display_currency: settings.default_display_currency,
        })
        .eq('id', settings.id);
      if (error) throw error;
      setOriginalSettings(settings);
      setLastSaved(new Date());
      if (!isAutoSave) {
        toast({ title: t('settings.settingsSaved'), description: t('settings.settingsSavedDesc') });
      }
    } catch (error) {
      console.error('Error saving settings:', error);
      toast({ title: t('common.error'), description: t('settings.settingsSaveError'), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const toggleSection = (section: keyof typeof openSections) => {
    setOpenSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!settings) {
    return (
      <Card>
        <CardContent className="py-12">
          <p className="text-center text-muted-foreground">{t('settings.noSettings')}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3 sm:space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Settings2 className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
          <div>
            <h1 className="text-lg sm:text-xl font-semibold">{t('settings.title')}</h1>
            <p className="text-xs sm:text-sm text-muted-foreground hidden sm:block">{t('settings.companyConfig')}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isDirty() ? (
            <Badge variant="outline" className="gap-1 text-xs bg-amber-500/10 text-amber-600 border-amber-500/30 animate-pulse">
              <AlertCircle className="h-3 w-3" />
              <span className="hidden sm:inline">{t('settings.unsaved')}</span>
            </Badge>
          ) : lastSaved ? (
            <Badge variant="outline" className="gap-1 text-xs bg-emerald-500/10 text-emerald-600 border-emerald-500/30">
              <Check className="h-3 w-3" />
              <span className="hidden sm:inline">{t('settings.saved')}</span>
            </Badge>
          ) : null}
          <Button onClick={() => handleSave()} disabled={saving || !isDirty()} size="sm" className="gap-1.5">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            <span className="hidden sm:inline">{t('common.save')}</span>
          </Button>
        </div>
      </div>

      {/* Logo Section */}
      <Card>
        <Collapsible open={openSections.logo} onOpenChange={() => toggleSection('logo')}>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors py-3 sm:py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Image className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                  <CardTitle className="text-sm sm:text-base">{t('settings.logo.title')}</CardTitle>
                </div>
                <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${openSections.logo ? 'rotate-180' : ''}`} />
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent className="data-[state=open]:animate-accordion-down data-[state=closed]:animate-accordion-up overflow-hidden">
            <CardContent className="pt-0 space-y-3">
              {subscription.isFreePlan ? (
                <div className="flex flex-col items-center py-6 text-center">
                  <Lock className="w-8 h-8 text-muted-foreground mb-2" />
                  <p className="text-sm font-medium mb-1">{t('settings.logo.customLogo')}</p>
                  <p className="text-xs text-muted-foreground mb-3">{t('settings.logo.customLogoDesc')}</p>
                  <Badge variant="secondary">{t('common.freeplan')}</Badge>
                </div>
              ) : (
                <>
                  {logoPreview && (
                    <div className="flex items-center gap-3 p-3 border rounded-lg bg-muted/30">
                      <img src={logoPreview} alt="Logo" className="h-14 w-14 sm:h-16 sm:w-16 object-contain rounded" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs sm:text-sm font-medium truncate">{t('settings.logo.current')}</p>
                        <p className="text-[10px] sm:text-xs text-muted-foreground">{t('settings.logo.format')}</p>
                      </div>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <Input type="file" accept="image/png,image/jpeg,image/jpg" onChange={handleLogoChange} className="flex-1 text-xs sm:text-sm h-9" />
                    {logoFile && (
                      <Button onClick={handleLogoUpload} disabled={uploading} size="sm" className="gap-1.5 shrink-0">
                        {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                        <span className="hidden sm:inline">Upload</span>
                      </Button>
                    )}
                  </div>
                </>
              )}
              {settings?.logo_url && (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">{t('settings.logo.width')}</Label>
                    <Input type="number" value={settings.logo_width || 50} onChange={(e) => setSettings({ ...settings, logo_width: parseFloat(e.target.value) || 50 })} className="h-8 text-xs" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">{t('settings.logo.height')}</Label>
                    <Input type="number" value={settings.logo_height || 50} onChange={(e) => setSettings({ ...settings, logo_height: parseFloat(e.target.value) || 50 })} className="h-8 text-xs" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">{t('settings.logo.positionX')}</Label>
                    <Input type="number" value={settings.logo_position_x || 0} onChange={(e) => setSettings({ ...settings, logo_position_x: parseFloat(e.target.value) || 0 })} className="h-8 text-xs" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">{t('settings.logo.positionY')}</Label>
                    <Input type="number" value={settings.logo_position_y || 0} onChange={(e) => setSettings({ ...settings, logo_position_y: parseFloat(e.target.value) || 0 })} className="h-8 text-xs" />
                  </div>
                </div>
              )}
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>

      {/* Company Info */}
      <Card>
        <Collapsible open={openSections.company} onOpenChange={() => toggleSection('company')}>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors py-3 sm:py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                  <CardTitle className="text-sm sm:text-base">{t('settings.company.title')}</CardTitle>
                </div>
                <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${openSections.company ? 'rotate-180' : ''}`} />
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent className="data-[state=open]:animate-accordion-down data-[state=closed]:animate-accordion-up overflow-hidden">
            <CardContent className="pt-0 space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs sm:text-sm">{t('settings.company.name')}</Label>
                <Input value={settings.company_name} onChange={(e) => setSettings({ ...settings, company_name: e.target.value })} className="h-9 text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs sm:text-sm">{t('settings.company.description')}</Label>
                <Input value={settings.company_description} onChange={(e) => setSettings({ ...settings, company_description: e.target.value })} className="h-9 text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-2 sm:gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs sm:text-sm">{t('settings.company.phone')}</Label>
                  <Input value={settings.phone} onChange={(e) => setSettings({ ...settings, phone: e.target.value })} placeholder="+509 1234-5678" className="h-9 text-sm" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs sm:text-sm">{t('settings.company.email')}</Label>
                  <Input type="email" value={settings.email} onChange={(e) => setSettings({ ...settings, email: e.target.value })} placeholder="contact@email.com" className="h-9 text-sm" />
                </div>
              </div>
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>

      {/* Invitation Code */}
      {invitationCode && (
        <Card>
          <CardHeader className="py-3 sm:py-4">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
              <CardTitle className="text-sm sm:text-base">{t('settings.invitation.title')}</CardTitle>
            </div>
            <CardDescription className="text-xs">{t('settings.invitation.description')}</CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex items-center gap-2">
              <div className="flex-1 bg-muted rounded-md px-4 py-2.5 font-mono text-lg tracking-widest text-center select-all">
                {invitationCode}
              </div>
              <Button variant="outline" size="sm" className="gap-1.5 shrink-0" onClick={() => {
                navigator.clipboard.writeText(invitationCode);
                setCodeCopied(true);
                setTimeout(() => setCodeCopied(false), 2000);
                toast({ title: t('settings.invitation.codeCopied'), description: invitationCode });
              }}>
                {codeCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {codeCopied ? t('settings.invitation.copied') : t('settings.invitation.copy')}
              </Button>
              <Button variant="outline" size="sm" className="gap-1.5 shrink-0" onClick={() => setShowRegenerateConfirm(true)} disabled={regenerating}>
                <RefreshCw className={`h-4 w-4 ${regenerating ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">{t('settings.invitation.regenerate')}</span>
              </Button>
            </div>

            <AlertDialog open={showRegenerateConfirm} onOpenChange={setShowRegenerateConfirm}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{t('settings.invitation.regenerateTitle')}</AlertDialogTitle>
                  <AlertDialogDescription>{t('settings.invitation.regenerateDesc')}</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                  <AlertDialogAction onClick={() => { setShowRegenerateConfirm(false); handleRegenerateCode(); }}>
                    {t('settings.invitation.regenerate')}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardContent>
        </Card>
      )}

      {/* Address */}
      <Card>
        <Collapsible open={openSections.address} onOpenChange={() => toggleSection('address')}>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors py-3 sm:py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                  <CardTitle className="text-sm sm:text-base">{t('settings.address.title')}</CardTitle>
                </div>
                <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${openSections.address ? 'rotate-180' : ''}`} />
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent className="data-[state=open]:animate-accordion-down data-[state=closed]:animate-accordion-up overflow-hidden">
            <CardContent className="pt-0 space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs sm:text-sm">{t('settings.address.address')}</Label>
                <Input value={settings.address} onChange={(e) => setSettings({ ...settings, address: e.target.value })} placeholder="123 Rue Principale" className="h-9 text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs sm:text-sm">{t('settings.address.city')}</Label>
                <Input value={settings.city} onChange={(e) => setSettings({ ...settings, city: e.target.value })} placeholder="Aux Cayes 8110" className="h-9 text-sm" />
              </div>
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>

      {/* Currency */}
      <Card>
        <Collapsible open={openSections.currency} onOpenChange={() => toggleSection('currency')}>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors py-3 sm:py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                  <CardTitle className="text-sm sm:text-base">{t('settings.currencies.title')}</CardTitle>
                </div>
                <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${openSections.currency ? 'rotate-180' : ''}`} />
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent className="data-[state=open]:animate-accordion-down data-[state=closed]:animate-accordion-up overflow-hidden">
            <CardContent className="pt-0 space-y-3">
              <div className="grid grid-cols-2 gap-2 sm:gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs sm:text-sm">{t('settings.currencies.usdToHtg')}</Label>
                  <Input type="number" step="0.01" min="1" value={settings.usd_htg_rate || 132} onChange={(e) => setSettings({ ...settings, usd_htg_rate: parseFloat(e.target.value) || 132 })} className="h-9 text-sm" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs sm:text-sm">{t('settings.currencies.defaultCurrency')}</Label>
                  <Select value={settings.default_display_currency || 'HTG'} onValueChange={(value: 'USD' | 'HTG') => setSettings({ ...settings, default_display_currency: value })}>
                    <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="HTG">HTG</SelectItem>
                      <SelectItem value="USD">USD</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="p-2.5 sm:p-3 rounded-lg bg-muted/50 border text-xs sm:text-sm">
                <p className="font-medium mb-1.5">{t('settings.currencies.preview')}</p>
                <div className="space-y-1 text-muted-foreground">
                  <div className="flex justify-between">
                    <span>100 USD =</span>
                    <span className="font-mono">{((settings.usd_htg_rate || 132) * 100).toLocaleString()} HTG</span>
                  </div>
                  <div className="flex justify-between">
                    <span>1,000 HTG =</span>
                    <span className="font-mono">${(1000 / (settings.usd_htg_rate || 132)).toFixed(2)} USD</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>

      {/* Payment & TVA */}
      <Card>
        <Collapsible open={openSections.payment} onOpenChange={() => toggleSection('payment')}>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors py-3 sm:py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CreditCard className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                  <CardTitle className="text-sm sm:text-base">{t('settings.paymentTva.title')}</CardTitle>
                </div>
                <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${openSections.payment ? 'rotate-180' : ''}`} />
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent className="data-[state=open]:animate-accordion-down data-[state=closed]:animate-accordion-up overflow-hidden">
            <CardContent className="pt-0 space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs sm:text-sm">{t('settings.paymentTva.tvaRate')}</Label>
                <Input type="number" step="0.1" min="0" max="100" value={settings.tva_rate} onChange={(e) => setSettings({ ...settings, tva_rate: parseFloat(e.target.value) || 0 })} placeholder="10.0" className="h-9 text-sm" />
                <p className="text-[10px] sm:text-xs text-muted-foreground">{t('settings.paymentTva.tvaRateHint')}</p>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs sm:text-sm">{t('settings.paymentTva.paymentTerms')}</Label>
                <Textarea value={settings.payment_terms} onChange={(e) => setSettings({ ...settings, payment_terms: e.target.value })} placeholder={t('settings.paymentTva.paymentTermsPlaceholder')} rows={2} className="text-sm resize-none" />
              </div>
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>

      {/* Subscription */}
      <Card>
        <Collapsible open={openSections.subscription} onOpenChange={() => toggleSection('subscription')}>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors py-3 sm:py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Crown className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                  <CardTitle className="text-sm sm:text-base">{t('settings.subscription.title')}</CardTitle>
                  <Badge variant={subscription.isExpired ? 'destructive' : 'default'} className="text-[10px] px-1.5">
                    {subscription.plan.toUpperCase()}
                  </Badge>
                </div>
                <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${openSections.subscription ? 'rotate-180' : ''}`} />
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent className="data-[state=open]:animate-accordion-down data-[state=closed]:animate-accordion-up overflow-hidden">
            <CardContent className="pt-0 space-y-4">
              <div className="p-3 rounded-lg border bg-muted/30 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs sm:text-sm font-medium">{t('settings.subscription.status')}</span>
                  <Badge variant={subscription.isActive && !subscription.isExpired ? 'default' : 'destructive'}>
                    {subscription.isActive && !subscription.isExpired ? t('settings.subscription.active') : t('settings.subscription.expired')}
                  </Badge>
                </div>
                {subscription.subscriptionEnd && (
                  <>
                    <div className="flex items-center justify-between text-xs sm:text-sm">
                      <span className="text-muted-foreground">{t('settings.subscription.expiration')}</span>
                      <span className="font-mono">{formatLocalizedDate(subscription.subscriptionEnd)}</span>
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">{t('settings.subscription.daysRemaining', { count: subscription.daysRemaining })}</span>
                        <span className="text-muted-foreground">{Math.min(100, Math.round((subscription.daysRemaining / 30) * 100))}%</span>
                      </div>
                      <Progress value={Math.min(100, Math.round((subscription.daysRemaining / 30) * 100))} className="h-2" />
                    </div>
                  </>
                )}
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <div className="flex items-center gap-1.5 text-xs sm:text-sm">
                    <UserCheck className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-muted-foreground">{t('settings.subscription.maxUsers')}:</span>
                    <span className="font-medium">{subscription.maxUsers === 999 ? '∞' : subscription.maxUsers}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs sm:text-sm">
                    <Package className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-muted-foreground">{t('settings.subscription.maxProducts')}:</span>
                    <span className="font-medium">{subscription.maxProducts === 999999 ? '∞' : subscription.maxProducts}</span>
                  </div>
                </div>
              </div>

              {subscriptionPlans.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs sm:text-sm font-medium">{t('settings.subscription.choosePlan')}</p>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs ${!isAnnual ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}>{t('settings.subscription.monthly')}</span>
                      <Switch checked={isAnnual} onCheckedChange={setIsAnnual} />
                      <span className={`text-xs ${isAnnual ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}>
                        {t('settings.subscription.annual')}
                      </span>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {subscriptionPlans.map((plan: any) => {
                      const isCurrent = plan.id === subscription.plan;
                      const planOrder = ['trial', 'basic', 'pro', 'premium'];
                      const currentIndex = planOrder.indexOf(subscription.plan);
                      const planIndex = planOrder.indexOf(plan.id);
                      const isUpgrade = planIndex > currentIndex;
                      const features = Array.isArray(plan.features) ? plan.features : [];
                      const monthlyPrice = plan.price_monthly;
                      const annualPrice = Math.round(monthlyPrice * 12 * 0.8);
                      const displayPrice = isAnnual ? Math.round(annualPrice / 12) : monthlyPrice;
                      return (
                        <div key={plan.id} className={`p-3 rounded-lg border text-xs sm:text-sm space-y-2 ${isCurrent ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'bg-muted/20'}`}>
                          <div className="flex items-center justify-between">
                            <span className="font-semibold">{plan.name}</span>
                            {isCurrent && <Badge className="text-[10px] px-1.5">{t('settings.subscription.currentPlan')}</Badge>}
                          </div>
                          <p className="text-lg font-bold">
                            {monthlyPrice === 0 ? t('common.freeplan') : `$${displayPrice}`}
                            {monthlyPrice > 0 && <span className="text-xs text-muted-foreground font-normal">{t('settings.subscription.perMonth')}</span>}
                          </p>
                          <div className="space-y-1 text-muted-foreground text-xs">
                            <p>{plan.max_users >= 999 ? `${t('settings.subscription.unlimited')} ${t('settings.subscription.users')}` : `${plan.max_users} ${t('settings.subscription.users')}`}</p>
                            <p>{plan.max_products >= 999999 ? `${t('settings.subscription.unlimited')} ${t('settings.subscription.products')}` : `${plan.max_products} ${t('settings.subscription.products')}`}</p>
                            <p>{plan.max_sales_monthly >= 999999 ? `${t('settings.subscription.unlimited')} ${t('settings.subscription.salesPerMonth')}` : `${plan.max_sales_monthly} ${t('settings.subscription.salesPerMonth')}`}</p>
                          </div>
                          {features.length > 0 && (
                            <div className="space-y-0.5 pt-1 border-t">
                              {features.map((f: string, i: number) => (
                                <div key={i} className="flex items-center gap-1 text-[10px] sm:text-xs text-muted-foreground">
                                  <CheckCircle2 className="h-3 w-3 shrink-0 text-primary" />
                                  <span>{f}</span>
                                </div>
                              ))}
                            </div>
                          )}
                          {isUpgrade && (
                            <Button size="sm" className="w-full gap-1.5 mt-2" disabled={!!checkoutLoading} onClick={async () => {
                              setCheckoutLoading(plan.id);
                              try {
                                const { error: refreshError } = await supabase.auth.refreshSession();
                                if (refreshError) throw refreshError;
                                const { data, error } = await supabase.functions.invoke('create-checkout', {
                                  body: { plan_id: plan.id, payment_method: selectedPaymentMethod, billing_period: isAnnual ? 'annual' : 'monthly' },
                                });
                                if (error) throw error;
                                if (data?.url) window.open(data.url, '_blank');
                              } catch (err: any) {
                                toast({ title: t('common.error'), description: err.message || t('common.saveError'), variant: 'destructive' });
                              } finally {
                                setCheckoutLoading(null);
                              }
                            }}>
                              {checkoutLoading === plan.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
                              {t('settings.subscription.subscribe')} {plan.name}
                            </Button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {subscription.isFreePlan && (
                <div className="p-3 rounded-lg border border-amber-500/30 bg-amber-500/5 space-y-2">
                  <div className="flex items-center gap-1.5">
                    <Lock className="h-4 w-4 text-amber-600" />
                    <span className="text-xs sm:text-sm font-medium text-amber-700 dark:text-amber-400">{t('common.premiumFeature')}</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-xs text-muted-foreground">
                    <p>🔒 {t('settings.subscription.advancedAnalytics')}</p>
                    <p>🔒 {t('settings.subscription.advancedReports')}</p>
                    <p>🔒 {t('settings.logo.customLogo')}</p>
                    <p>🔒 {t('settings.subscription.excelPdfExport')}</p>
                  </div>
                </div>
              )}

              {paymentHistory.length > 0 && (
                <div className="space-y-2 pt-2 border-t">
                  <p className="text-xs sm:text-sm font-medium flex items-center gap-1.5">
                    <CreditCard className="h-3.5 w-3.5" />
                    {t('settings.subscription.paymentHistory')}
                  </p>
                  <div className="space-y-1.5 max-h-48 overflow-y-auto">
                    {paymentHistory.map((item: any, idx: number) => (
                      <div key={idx} className="flex items-center justify-between text-xs p-2 rounded-md bg-muted/30">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-[10px] capitalize">
                            {item.type === 'invoice' ? item.invoice_number : (item.plan_id || item.plan_name || '-')}
                          </Badge>
                          <span className="text-muted-foreground capitalize">{item.payment_method || 'stripe'}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{item.amount} {item.currency}</span>
                          <span className="text-muted-foreground">{formatLocalizedDate(item.created_at)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-2 pt-2 border-t">
                <p className="text-xs sm:text-sm font-medium">{t('common.payment')}</p>
                <div className="flex gap-2">
                  <Button variant={selectedPaymentMethod === 'stripe' ? 'default' : 'outline'} size="sm" className="gap-1.5 flex-1" onClick={() => setSelectedPaymentMethod('stripe')}>
                    <CreditCard className="h-3.5 w-3.5" />
                    {t('common.payment')}
                  </Button>
                  <Button variant={selectedPaymentMethod === 'moncash' ? 'default' : 'outline'} size="sm" className="gap-1.5 flex-1" onClick={() => setSelectedPaymentMethod('moncash')}>
                    <Smartphone className="h-3.5 w-3.5" />
                    MonCash
                  </Button>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-2 pt-1">
                <Button variant="outline" size="sm" className="gap-1.5 flex-1" onClick={() => window.open('mailto:contact@systemmanagement.sn?subject=Question abonnement', '_blank')}>
                  <Mail className="h-4 w-4" />
                  {t('common.email')}
                </Button>
              </div>
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>
    </div>
  );
};
