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

interface SpecificationFieldsManagerProps {
  selectedSousCategorieId: string | null;
  onSelectSousCategorie: (id: string | null) => void;
}

export const SpecificationFieldsManager = ({ 
  selectedSousCategorieId,
  onSelectSousCategorie
}: SpecificationFieldsManagerProps) => {
  const { sousCategories } = useSousCategories();
  const { specifications, loading, refetch } = useSpecificationsModeles(selectedSousCategorieId || undefined);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingSpec, setEditingSpec] = useState<SpecificationModele | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<{open: boolean, id: string | null, name: string}>({
    open: false, 
    id: null,
    name: ''
  });
  
  const [formData, setFormData] = useState({
    nom_champ: '',
    type_champ: 'text' as 'text' | 'number' | 'select' | 'boolean',
    label: '',
    obligatoire: false,
    options: '',
    unite: '',
    ordre: 0
  });

  const resetForm = () => {
    setFormData({
      nom_champ: '',
      type_champ: 'text',
      label: '',
      obligatoire: false,
      options: '',
      unite: '',
      ordre: specifications.length
    });
    setEditingSpec(null);
  };

  const generateFieldName = (label: string) => {
    return label
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/(^_|_$)/g, '');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedSousCategorieId) {
      toast({
        title: "Erreur",
        description: "Veuillez sélectionner une sous-catégorie.",
        variant: "destructive"
      });
      return;
    }

    try {
      const nom_champ = formData.nom_champ || generateFieldName(formData.label);
      const optionsArray = formData.type_champ === 'select' && formData.options 
        ? formData.options.split(',').map(o => o.trim()).filter(Boolean)
        : null;
      
      if (editingSpec) {
        const { error } = await supabase
          .from('specifications_modeles')
          .update({
            nom_champ,
            type_champ: formData.type_champ,
            label: formData.label,
            obligatoire: formData.obligatoire,
            options: optionsArray,
            unite: formData.unite || null,
            ordre: formData.ordre
          })
          .eq('id', editingSpec.id);

        if (error) throw error;
        
        toast({
          title: "Spécification mise à jour",
          description: `La spécification "${formData.label}" a été modifiée.`
        });
      } else {
        const { error } = await supabase
          .from('specifications_modeles')
          .insert({
            sous_categorie_id: selectedSousCategorieId,
            nom_champ,
            type_champ: formData.type_champ,
            label: formData.label,
            obligatoire: formData.obligatoire,
            options: optionsArray,
            unite: formData.unite || null,
            ordre: formData.ordre
          });

        if (error) throw error;
        
        toast({
          title: "Spécification créée",
          description: `La spécification "${formData.label}" a été ajoutée.`
        });
      }

      setIsDialogOpen(false);
      resetForm();
      refetch();
    } catch (error: any) {
      console.error('Error saving specification:', error);
      toast({
        title: "Erreur",
        description: error.message || "Impossible de sauvegarder la spécification.",
        variant: "destructive"
      });
    }
  };

  const handleEdit = (spec: SpecificationModele) => {
    setEditingSpec(spec);
    setFormData({
      nom_champ: spec.nom_champ,
      type_champ: spec.type_champ,
      label: spec.label,
      obligatoire: spec.obligatoire,
      options: spec.options ? spec.options.join(', ') : '',
      unite: spec.unite || '',
      ordre: spec.ordre
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteDialog.id) return;

    try {
      const { error } = await supabase
        .from('specifications_modeles')
        .delete()
        .eq('id', deleteDialog.id);

      if (error) throw error;

      toast({
        title: "Spécification supprimée",
        description: `La spécification "${deleteDialog.name}" a été supprimée.`
      });
      
      refetch();
    } catch (error: any) {
      console.error('Error deleting specification:', error);
      toast({
        title: "Erreur",
        description: error.message || "Impossible de supprimer la spécification.",
        variant: "destructive"
      });
    } finally {
      setDeleteDialog({ open: false, id: null, name: '' });
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'text': return 'Texte';
      case 'number': return 'Nombre';
      case 'select': return 'Sélection';
      case 'boolean': return 'Oui/Non';
      default: return type;
    }
  };

  const getSelectedSousCategoryName = () => {
    const sc = sousCategories.find(s => s.id === selectedSousCategorieId);
    return sc?.nom || '';
  };

  if (loading && selectedSousCategorieId) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <div className="text-muted-foreground">Chargement...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-col gap-2 sm:gap-4 p-3 sm:p-6">
          <CardTitle className="flex items-center gap-2 text-sm sm:text-lg">
            <Settings className="h-4 w-4 sm:h-5 sm:w-5" />
            <span className="hidden sm:inline">Spécifications par Sous-catégorie</span>
            <span className="sm:hidden">Spécifications</span>
          </CardTitle>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
            <Select 
              value={selectedSousCategorieId || ''} 
              onValueChange={(value) => onSelectSousCategorie(value || null)}
            >
              <SelectTrigger className="w-full sm:w-[250px] h-8 sm:h-10 text-xs sm:text-sm">
                <SelectValue placeholder="Sélectionner une sous-catégorie" />
              </SelectTrigger>
              <SelectContent>
                {sousCategories.map(sc => (
                  <SelectItem key={sc.id} value={sc.id}>
                    {sc.nom}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedSousCategorieId && (
              <Dialog open={isDialogOpen} onOpenChange={(open) => {
                setIsDialogOpen(open);
                if (!open) resetForm();
              }}>
                <DialogTrigger asChild>
                  <Button className="w-full sm:w-auto h-8 sm:h-10 text-xs sm:text-sm">
                    <Plus className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                    Nouveau Champ
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-[95vw] sm:max-w-lg max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>
                      {editingSpec ? 'Modifier le Champ' : 'Nouveau Champ de Spécification'}
                    </DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="label">Label (affiché) *</Label>
                      <Input
                        id="label"
                        value={formData.label}
                        onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                        placeholder="Ex: Surface par boîte"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="nom_champ">Nom technique (auto-généré si vide)</Label>
                      <Input
                        id="nom_champ"
                        value={formData.nom_champ}
                        onChange={(e) => setFormData({ ...formData, nom_champ: e.target.value })}
                        placeholder={generateFieldName(formData.label)}
                      />
                      <p className="text-xs text-muted-foreground">
                        Utilisé comme clé dans les données. Lettres minuscules et underscores uniquement.
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="type_champ">Type de champ *</Label>
                      <Select 
                        value={formData.type_champ} 
                        onValueChange={(value: 'text' | 'number' | 'select' | 'boolean') => 
                          setFormData({ ...formData, type_champ: value })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="z-[100]" position="popper" sideOffset={5}>
                          <SelectItem value="text">Texte</SelectItem>
                          <SelectItem value="number">Nombre</SelectItem>
                          <SelectItem value="select">Liste de sélection</SelectItem>
                          <SelectItem value="boolean">Oui/Non</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {formData.type_champ === 'select' && (
                      <div className="space-y-2">
                        <Label htmlFor="options">Options (séparées par des virgules)</Label>
                        <Input
                          id="options"
                          value={formData.options}
                          onChange={(e) => setFormData({ ...formData, options: e.target.value })}
                          placeholder="Option1, Option2, Option3"
                        />
                      </div>
                    )}
                    <div className="space-y-2">
                      <Label htmlFor="unite">Unité (optionnel)</Label>
                      <Input
                        id="unite"
                        value={formData.unite}
                        onChange={(e) => setFormData({ ...formData, unite: e.target.value })}
                        placeholder="Ex: m², kg, W"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="ordre">Ordre d'affichage</Label>
                      <Input
                        id="ordre"
                        type="number"
                        value={formData.ordre}
                        onChange={(e) => setFormData({ ...formData, ordre: parseInt(e.target.value) || 0 })}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label htmlFor="obligatoire">Champ obligatoire</Label>
                      <Switch
                        id="obligatoire"
                        checked={formData.obligatoire}
                        onCheckedChange={(checked) => setFormData({ ...formData, obligatoire: checked })}
                      />
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                        Annuler
                      </Button>
                      <Button type="submit">
                        {editingSpec ? 'Mettre à jour' : 'Créer'}
                      </Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-2 sm:p-6">
          {!selectedSousCategorieId ? (
            <div className="text-center py-8 sm:py-12 text-muted-foreground text-xs sm:text-sm">
              Sélectionnez une sous-catégorie pour gérer ses spécifications
            </div>
          ) : (
            <>
              <div className="mb-2 sm:mb-4">
                <Badge variant="outline" className="text-[10px] sm:text-sm">
                  Sous-catégorie : {getSelectedSousCategoryName()}
                </Badge>
              </div>
              <div className="overflow-x-auto -mx-2 sm:mx-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="hidden sm:table-cell text-xs sm:text-sm">Ordre</TableHead>
                      <TableHead className="text-xs sm:text-sm">Label</TableHead>
                      <TableHead className="hidden md:table-cell text-xs sm:text-sm">Nom technique</TableHead>
                      <TableHead className="text-xs sm:text-sm">Type</TableHead>
                      <TableHead className="hidden sm:table-cell text-xs sm:text-sm">Unité</TableHead>
                      <TableHead className="hidden sm:table-cell text-xs sm:text-sm">Requis</TableHead>
                      <TableHead className="text-right text-xs sm:text-sm">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {specifications.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-muted-foreground py-6 sm:py-8 text-xs sm:text-sm">
                          Aucune spécification définie
                        </TableCell>
                      </TableRow>
                    ) : (
                      specifications.map((spec) => (
                        <TableRow key={spec.id}>
                          <TableCell className="hidden sm:table-cell text-xs sm:text-sm p-1 sm:p-2">{spec.ordre}</TableCell>
                          <TableCell className="font-medium text-xs sm:text-sm p-1 sm:p-2">{spec.label}</TableCell>
                          <TableCell className="hidden md:table-cell text-muted-foreground font-mono text-[10px] sm:text-sm p-1 sm:p-2">
                            {spec.nom_champ}
                          </TableCell>
                          <TableCell className="p-1 sm:p-2">
                            <Badge variant="secondary" className="text-[10px] sm:text-xs">{getTypeLabel(spec.type_champ)}</Badge>
                          </TableCell>
                          <TableCell className="hidden sm:table-cell text-xs sm:text-sm p-1 sm:p-2">{spec.unite || '-'}</TableCell>
                          <TableCell className="hidden sm:table-cell p-1 sm:p-2">
                            <Badge variant={spec.obligatoire ? "default" : "outline"} className="text-[10px] sm:text-xs">
                              {spec.obligatoire ? 'Oui' : 'Non'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right p-1 sm:p-2">
                            <div className="flex justify-end gap-0.5 sm:gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 sm:h-8 sm:w-8 p-0"
                                onClick={() => handleEdit(spec)}
                              >
                                <Edit className="h-3 w-3 sm:h-4 sm:w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 sm:h-8 sm:w-8 p-0"
                                onClick={() => setDeleteDialog({
                                  open: true,
                                  id: spec.id,
                                  name: spec.label
                                })}
                              >
                                <Trash2 className="h-3 w-3 sm:h-4 sm:w-4" />
                              </Button>
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
            <AlertDialogTitle>Confirmer la suppression</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer le champ "{deleteDialog.name}" ?
              Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
