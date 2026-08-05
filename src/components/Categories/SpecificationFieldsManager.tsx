import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { Settings, Plus, Edit, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { useSousCategories, useSpecificationsModeles, SpecificationModele } from '@/hooks/useCategories';
import { useAuth } from '@/hooks/useAuth';
import { useTranslation } from 'react-i18next';

interface SpecificationFieldsManagerProps {
  selectedSousCategorieId: string | null;
  onSelectSousCategorie: (id: string | null) => void;
}

export const SpecificationFieldsManager = ({ selectedSousCategorieId, onSelectSousCategorie }: SpecificationFieldsManagerProps) => {
  const { t } = useTranslation();
  const { profile } = useAuth();
  const { sousCategories } = useSousCategories();
  const { specifications, loading, refetch } = useSpecificationsModeles(selectedSousCategorieId || undefined);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingSpec, setEditingSpec] = useState<SpecificationModele | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<{open: boolean, id: string | null, name: string}>({ open: false, id: null, name: '' });
  
  const [formData, setFormData] = useState({
    nom_champ: '', type_champ: 'text' as 'text' | 'number' | 'select' | 'boolean', label: '', obligatoire: false, options: '', unite: '', ordre: 0
  });

  const resetForm = () => {
    setFormData({ nom_champ: '', type_champ: 'text', label: '', obligatoire: false, options: '', unite: '', ordre: specifications.length });
    setEditingSpec(null);
  };

  const generateFieldName = (label: string) => label.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/(^_|_$)/g, '');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSousCategorieId) {
      toast({ title: t('common.error'), description: t('categories.selectSubcategoryFirst'), variant: "destructive" });
      return;
    }
    try {
      const nom_champ = formData.nom_champ || generateFieldName(formData.label);
      const optionsArray = formData.type_champ === 'select' && formData.options ? formData.options.split(',').map(o => o.trim()).filter(Boolean) : null;
      
      if (editingSpec) {
        const { error } = await supabase.from('specifications_modeles').update({
          nom_champ, type_champ: formData.type_champ, label: formData.label, obligatoire: formData.obligatoire, options: optionsArray, unite: formData.unite || null, ordre: formData.ordre
        }).eq('id', editingSpec.id);
        if (error) throw error;
        toast({ title: t('categories.specUpdated'), description: t('categories.specUpdatedDesc', { name: formData.label }) });
      } else {
        const { error } = await supabase.from('specifications_modeles').insert({
          company_id: profile?.company_id || '', sous_categorie_id: selectedSousCategorieId, nom_champ, type_champ: formData.type_champ, label: formData.label, obligatoire: formData.obligatoire, options: optionsArray, unite: formData.unite || null, ordre: formData.ordre
        });
        if (error) throw error;
        toast({ title: t('categories.specCreated'), description: t('categories.specCreatedDesc', { name: formData.label }) });
      }
      setIsDialogOpen(false);
      resetForm();
      refetch();
    } catch (error: any) {
      console.error('Error saving specification:', error);
      toast({ title: t('common.error'), description: error.message || t('common.saveError'), variant: "destructive" });
    }
  };

  const handleEdit = (spec: SpecificationModele) => {
    setEditingSpec(spec);
    setFormData({ nom_champ: spec.nom_champ, type_champ: spec.type_champ, label: spec.label, obligatoire: spec.obligatoire, options: spec.options ? spec.options.join(', ') : '', unite: spec.unite || '', ordre: spec.ordre });
    setIsDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteDialog.id) return;
    try {
      const { error } = await supabase.from('specifications_modeles').delete().eq('id', deleteDialog.id);
      if (error) throw error;
      toast({ title: t('categories.specDeleted'), description: t('categories.specDeletedDesc', { name: deleteDialog.name }) });
      refetch();
    } catch (error: any) {
      console.error('Error deleting specification:', error);
      toast({ title: t('common.error'), description: error.message || t('common.deleteError'), variant: "destructive" });
    } finally {
      setDeleteDialog({ open: false, id: null, name: '' });
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'text': return t('categories.fieldTypeText');
      case 'number': return t('categories.fieldTypeNumber');
      case 'select': return t('categories.fieldTypeSelect');
      case 'boolean': return t('categories.fieldTypeBoolean');
      default: return type;
    }
  };

  const getSelectedSousCategoryName = () => {
    const sc = sousCategories.find(s => s.id === selectedSousCategorieId);
    return sc?.nom || '';
  };

  if (loading && selectedSousCategorieId) {
    return (<Card><CardContent className="flex items-center justify-center py-12"><div className="text-muted-foreground">{t('common.loading')}</div></CardContent></Card>);
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-col gap-2 sm:gap-4 p-3 sm:p-6">
          <CardTitle className="flex items-center gap-2 text-sm sm:text-lg">
            <Settings className="h-4 w-4 sm:h-5 sm:w-5" />
            <span className="hidden sm:inline">{t('categories.specsBySubcategory')}</span>
            <span className="sm:hidden">{t('categories.specifications')}</span>
          </CardTitle>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
            <Select value={selectedSousCategorieId || ''} onValueChange={(value) => onSelectSousCategorie(value || null)}>
              <SelectTrigger className="w-full sm:w-[250px] h-8 sm:h-10 text-xs sm:text-sm">
                <SelectValue placeholder={t('categories.selectSubcategory')} />
              </SelectTrigger>
              <SelectContent>
                {sousCategories.map(sc => (<SelectItem key={sc.id} value={sc.id}>{sc.nom}</SelectItem>))}
              </SelectContent>
            </Select>
            {selectedSousCategorieId && (
              <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) resetForm(); }}>
                <DialogTrigger asChild>
                  <Button className="w-full sm:w-auto h-8 sm:h-10 text-xs sm:text-sm">
                    <Plus className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                    {t('categories.newField')}
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-[95vw] sm:max-w-lg max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>{editingSpec ? t('categories.editField') : t('categories.newSpecField')}</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="label">{t('categories.labelDisplayed')} *</Label>
                      <Input id="label" value={formData.label} onChange={(e) => setFormData({ ...formData, label: e.target.value })} placeholder={t('categories.labelPlaceholder')} required />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="nom_champ">{t('categories.technicalName')}</Label>
                      <Input id="nom_champ" value={formData.nom_champ} onChange={(e) => setFormData({ ...formData, nom_champ: e.target.value })} placeholder={generateFieldName(formData.label)} />
                      <p className="text-xs text-muted-foreground">{t('categories.technicalNameHint')}</p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="type_champ">{t('categories.fieldType')} *</Label>
                      <Select value={formData.type_champ} onValueChange={(value: 'text' | 'number' | 'select' | 'boolean') => setFormData({ ...formData, type_champ: value })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent className="z-[100]" position="popper" sideOffset={5}>
                          <SelectItem value="text">{t('categories.fieldTypeText')}</SelectItem>
                          <SelectItem value="number">{t('categories.fieldTypeNumber')}</SelectItem>
                          <SelectItem value="select">{t('categories.fieldTypeSelect')}</SelectItem>
                          <SelectItem value="boolean">{t('categories.fieldTypeBoolean')}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {formData.type_champ === 'select' && (
                      <div className="space-y-2">
                        <Label htmlFor="options">{t('categories.optionsCommaSeparated')}</Label>
                        <Input id="options" value={formData.options} onChange={(e) => setFormData({ ...formData, options: e.target.value })} placeholder="Option1, Option2, Option3" />
                      </div>
                    )}
                    <div className="space-y-2">
                      <Label htmlFor="unite">{t('categories.unitOptional')}</Label>
                      <Input id="unite" value={formData.unite} onChange={(e) => setFormData({ ...formData, unite: e.target.value })} placeholder={t('categories.unitPlaceholder')} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="ordre">{t('categories.displayOrder')}</Label>
                      <Input id="ordre" type="number" value={formData.ordre} onChange={(e) => setFormData({ ...formData, ordre: parseInt(e.target.value) || 0 })} />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label htmlFor="obligatoire">{t('categories.requiredField')}</Label>
                      <Switch id="obligatoire" checked={formData.obligatoire} onCheckedChange={(checked) => setFormData({ ...formData, obligatoire: checked })} />
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>{t('common.cancel')}</Button>
                      <Button type="submit">{editingSpec ? t('common.updated') : t('categories.create')}</Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-2 sm:p-6">
          {!selectedSousCategorieId ? (
            <div className="text-center py-8 sm:py-12 text-muted-foreground text-xs sm:text-sm">{t('categories.selectSubcategoryToManage')}</div>
          ) : (
            <>
              <div className="mb-2 sm:mb-4">
                <Badge variant="outline" className="text-[10px] sm:text-sm">{t('categories.subcategoryLabel')}: {getSelectedSousCategoryName()}</Badge>
              </div>
              <div className="overflow-x-auto -mx-2 sm:mx-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="hidden sm:table-cell text-xs sm:text-sm">{t('categories.order')}</TableHead>
                      <TableHead className="text-xs sm:text-sm">{t('categories.label')}</TableHead>
                      <TableHead className="hidden md:table-cell text-xs sm:text-sm">{t('categories.technicalNameShort')}</TableHead>
                      <TableHead className="text-xs sm:text-sm">{t('categories.type')}</TableHead>
                      <TableHead className="hidden sm:table-cell text-xs sm:text-sm">{t('common.unit')}</TableHead>
                      <TableHead className="hidden sm:table-cell text-xs sm:text-sm">{t('categories.required')}</TableHead>
                      <TableHead className="text-right text-xs sm:text-sm">{t('common.actions')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {specifications.length === 0 ? (
                      <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-6 sm:py-8 text-xs sm:text-sm">{t('categories.noSpecs')}</TableCell></TableRow>
                    ) : (
                      specifications.map((spec) => (
                        <TableRow key={spec.id}>
                          <TableCell className="hidden sm:table-cell text-xs sm:text-sm p-1 sm:p-2">{spec.ordre}</TableCell>
                          <TableCell className="font-medium text-xs sm:text-sm p-1 sm:p-2">{spec.label}</TableCell>
                          <TableCell className="hidden md:table-cell text-muted-foreground font-mono text-[10px] sm:text-sm p-1 sm:p-2">{spec.nom_champ}</TableCell>
                          <TableCell className="p-1 sm:p-2"><Badge variant="secondary" className="text-[10px] sm:text-xs">{getTypeLabel(spec.type_champ)}</Badge></TableCell>
                          <TableCell className="hidden sm:table-cell text-xs sm:text-sm p-1 sm:p-2">{spec.unite || '-'}</TableCell>
                          <TableCell className="hidden sm:table-cell p-1 sm:p-2">
                            <Badge variant={spec.obligatoire ? "default" : "outline"} className="text-[10px] sm:text-xs">{spec.obligatoire ? t('common.yes') : t('common.no')}</Badge>
                          </TableCell>
                          <TableCell className="text-right p-1 sm:p-2">
                            <div className="flex justify-end gap-0.5 sm:gap-1">
                              <Button variant="ghost" size="sm" className="h-6 w-6 sm:h-8 sm:w-8 p-0" onClick={() => handleEdit(spec)}><Edit className="h-3 w-3 sm:h-4 sm:w-4" /></Button>
                              <Button variant="ghost" size="sm" className="h-6 w-6 sm:h-8 sm:w-8 p-0" onClick={() => setDeleteDialog({ open: true, id: spec.id, name: spec.label })}><Trash2 className="h-3 w-3 sm:h-4 sm:w-4" /></Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={deleteDialog.open} onOpenChange={(open) => setDeleteDialog(prev => ({ ...prev, open }))}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('categories.confirmDelete')}</AlertDialogTitle>
            <AlertDialogDescription>{t('categories.confirmDeleteSpecDesc', { name: deleteDialog.name })}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">{t('common.delete')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
