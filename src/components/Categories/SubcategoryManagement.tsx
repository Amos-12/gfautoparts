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
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Layers, Plus, Edit, Trash2, Settings, GripVertical } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { useCategories, useSousCategories, SousCategorie } from '@/hooks/useCategories';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface SortableSubcategoryRowProps {
  sousCategorie: SousCategorie;
  getCategoryName: (id: string) => string;
  getStockTypeLabel: (type: string) => string;
  onEdit: (sc: SousCategorie) => void;
  onDelete: (sc: SousCategorie) => void;
  onManageSpecs: (id: string) => void;
}

const SortableSubcategoryRow = ({ 
  sousCategorie, 
  getCategoryName, 
  getStockTypeLabel, 
  onEdit, 
  onDelete, 
  onManageSpecs 
}: SortableSubcategoryRowProps) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: sousCategorie.id });
  
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <TableRow ref={setNodeRef} style={style} className={isDragging ? 'bg-muted' : ''}>
      <TableCell className="hidden sm:table-cell w-8 p-1 sm:p-2">
        <button {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing p-0.5 sm:p-1 hover:bg-muted rounded">
          <GripVertical className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
        </button>
      </TableCell>
      <TableCell className="hidden sm:table-cell text-xs sm:text-sm p-1 sm:p-2">{sousCategorie.ordre}</TableCell>
      <TableCell className="font-medium text-xs sm:text-sm p-1 sm:p-2">{sousCategorie.nom}</TableCell>
      <TableCell className="hidden md:table-cell p-1 sm:p-2">
        <Badge variant="outline" className="text-[10px] sm:text-xs">{getCategoryName(sousCategorie.categorie_id)}</Badge>
      </TableCell>
      <TableCell className="hidden sm:table-cell p-1 sm:p-2">
        <Badge variant="secondary" className="text-[10px] sm:text-xs">{getStockTypeLabel(sousCategorie.stock_type)}</Badge>
      </TableCell>
      <TableCell className="p-1 sm:p-2">
        <Badge variant={sousCategorie.is_active ? "default" : "secondary"} className="text-[10px] sm:text-xs">
          {sousCategorie.is_active ? 'Active' : 'Inactive'}
        </Badge>
      </TableCell>
      <TableCell className="text-right p-1 sm:p-2">
        <div className="flex justify-end gap-0.5 sm:gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 sm:h-8 sm:w-8 p-0"
            onClick={() => onManageSpecs(sousCategorie.id)}
            title="Gérer les spécifications"
          >
            <Settings className="h-3 w-3 sm:h-4 sm:w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 sm:h-8 sm:w-8 p-0"
            onClick={() => onEdit(sousCategorie)}
          >
            <Edit className="h-3 w-3 sm:h-4 sm:w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 sm:h-8 sm:w-8 p-0"
            onClick={() => onDelete(sousCategorie)}
          >
            <Trash2 className="h-3 w-3 sm:h-4 sm:w-4" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
};

interface SubcategoryManagementProps {
  selectedCategoryId: string | null;
  onSelectCategory: (id: string | null) => void;
  onSelectSubcategory: (id: string) => void;
}

export const SubcategoryManagement = ({ 
  selectedCategoryId, 
  onSelectCategory,
  onSelectSubcategory 
}: SubcategoryManagementProps) => {
  const { categories } = useCategories();
  const { sousCategories, loading, refetch } = useSousCategories(selectedCategoryId || undefined);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingSousCategorie, setEditingSousCategorie] = useState<SousCategorie | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<{open: boolean, id: string | null, name: string}>({
    open: false, 
    id: null,
    name: ''
  });
  
  const [formData, setFormData] = useState({
    categorie_id: '',
    nom: '',
    description: '',
    slug: '',
    is_active: true,
    ordre: 0,
    stock_type: 'quantity' as 'quantity' | 'boite_m2' | 'barre_metre'
  });

  const resetForm = () => {
    setFormData({
      categorie_id: selectedCategoryId || '',
      nom: '',
      description: '',
      slug: '',
      is_active: true,
      ordre: sousCategories.length,
      stock_type: 'quantity'
    });
    setEditingSousCategorie(null);
  };

  const generateSlug = (nom: string) => {
    return nom
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.categorie_id) {
      toast({
        title: "Erreur",
        description: "Veuillez sélectionner une catégorie parente.",
        variant: "destructive"
      });
      return;
    }

    try {
      const slug = formData.slug || generateSlug(formData.nom);
      const { data: { user } } = await supabase.auth.getUser();
      
      if (editingSousCategorie) {
        const { error } = await supabase
          .from('sous_categories')
          .update({
            categorie_id: formData.categorie_id,
            nom: formData.nom,
            description: formData.description || null,
            slug,
            is_active: formData.is_active,
            ordre: formData.ordre,
            stock_type: formData.stock_type
          })
          .eq('id', editingSousCategorie.id);

        if (error) throw error;

        // Log activity
        await supabase.from('activity_logs').insert({
          user_id: user?.id,
          action_type: 'subcategory_updated' as any,
          entity_type: 'sous_categorie',
          entity_id: editingSousCategorie.id,
          description: `Sous-catégorie "${formData.nom}" modifiée`,
          metadata: {
            subcategory_name: formData.nom,
            previous_values: { nom: editingSousCategorie.nom, is_active: editingSousCategorie.is_active },
            new_values: { nom: formData.nom, is_active: formData.is_active }
          }
        });
        
        toast({
          title: "Sous-catégorie mise à jour",
          description: `La sous-catégorie "${formData.nom}" a été modifiée.`
        });
      } else {
        const { data: newSubcat, error } = await supabase
          .from('sous_categories')
          .insert({
            categorie_id: formData.categorie_id,
            nom: formData.nom,
            description: formData.description || null,
            slug,
            is_active: formData.is_active,
            ordre: formData.ordre,
            stock_type: formData.stock_type
          })
          .select()
          .single();

        if (error) throw error;

        // Log activity
        await supabase.from('activity_logs').insert({
          user_id: user?.id,
          action_type: 'subcategory_created' as any,
          entity_type: 'sous_categorie',
          entity_id: newSubcat?.id,
          description: `Sous-catégorie "${formData.nom}" créée`,
          metadata: { subcategory_name: formData.nom, slug, stock_type: formData.stock_type }
        });
        
        toast({
          title: "Sous-catégorie créée",
          description: `La sous-catégorie "${formData.nom}" a été ajoutée.`
        });
      }

      setIsDialogOpen(false);
      resetForm();
      refetch();
    } catch (error: any) {
      console.error('Error saving sous-categorie:', error);
      toast({
        title: "Erreur",
        description: error.message || "Impossible de sauvegarder la sous-catégorie.",
        variant: "destructive"
      });
    }
  };

  const handleEdit = (sousCategorie: SousCategorie) => {
    setEditingSousCategorie(sousCategorie);
    setFormData({
      categorie_id: sousCategorie.categorie_id,
      nom: sousCategorie.nom,
      description: sousCategorie.description || '',
      slug: sousCategorie.slug,
      is_active: sousCategorie.is_active,
      ordre: sousCategorie.ordre,
      stock_type: sousCategorie.stock_type
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteDialog.id) return;

    try {
      // Check if subcategory has products
      const { data: products } = await supabase
        .from('products')
        .select('id')
        .eq('sous_categorie_id', deleteDialog.id)
        .limit(1);

      if (products && products.length > 0) {
        toast({
          title: "Impossible de supprimer",
          description: "Cette sous-catégorie contient des produits. Supprimez d'abord les produits.",
          variant: "destructive"
        });
        setDeleteDialog({ open: false, id: null, name: '' });
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();

      const { error } = await supabase
        .from('sous_categories')
        .delete()
        .eq('id', deleteDialog.id);

      if (error) throw error;

      // Log activity
      await supabase.from('activity_logs').insert({
        user_id: user?.id,
        action_type: 'subcategory_deleted' as any,
        entity_type: 'sous_categorie',
        entity_id: deleteDialog.id,
        description: `Sous-catégorie "${deleteDialog.name}" supprimée`,
        metadata: { subcategory_name: deleteDialog.name }
      });

      toast({
        title: "Sous-catégorie supprimée",
        description: `La sous-catégorie "${deleteDialog.name}" a été supprimée.`
      });
      
      refetch();
    } catch (error: any) {
      console.error('Error deleting sous-categorie:', error);
      toast({
        title: "Erreur",
        description: error.message || "Impossible de supprimer la sous-catégorie.",
        variant: "destructive"
      });
    } finally {
      setDeleteDialog({ open: false, id: null, name: '' });
    }
  };

  const getStockTypeLabel = (type: string) => {
    switch (type) {
      case 'boite_m2': return 'Boîtes / m²';
      case 'barre_metre': return 'Barres / mètres';
      default: return 'Quantité simple';
    }
  };

  const getCategoryName = (categorieId: string) => {
    const category = categories.find(c => c.id === categorieId);
    return category?.nom || 'Inconnue';
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (!over || active.id === over.id) return;

    const oldIndex = sousCategories.findIndex(sc => sc.id === active.id);
    const newIndex = sousCategories.findIndex(sc => sc.id === over.id);
    
    const reorderedItems = arrayMove(sousCategories, oldIndex, newIndex);
    
    try {
      const updates = reorderedItems.map((sc, index) => 
        supabase.from('sous_categories').update({ ordre: index }).eq('id', sc.id)
      );
      
      await Promise.all(updates);
      refetch();
      
      toast({
        title: "Ordre mis à jour",
        description: "L'ordre des sous-catégories a été modifié."
      });
    } catch (error) {
      console.error('Error updating order:', error);
      toast({
        title: "Erreur",
        description: "Impossible de mettre à jour l'ordre.",
        variant: "destructive"
      });
    }
  };

  if (loading) {
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
            <Layers className="h-4 w-4 sm:h-5 sm:w-5" />
            <span className="hidden sm:inline">Gestion des Sous-catégories</span>
            <span className="sm:hidden">Sous-catégories</span>
          </CardTitle>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
            <Select 
              value={selectedCategoryId || 'all'} 
              onValueChange={(value) => onSelectCategory(value === 'all' ? null : value)}
            >
              <SelectTrigger className="w-full sm:w-[200px] h-8 sm:h-10 text-xs sm:text-sm">
                <SelectValue placeholder="Filtrer par catégorie" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes les catégories</SelectItem>
                {categories.map(cat => (
                  <SelectItem key={cat.id} value={cat.id}>{cat.nom}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Dialog open={isDialogOpen} onOpenChange={(open) => {
              setIsDialogOpen(open);
              if (!open) resetForm();
            }}>
              <DialogTrigger asChild>
                <Button className="w-full sm:w-auto h-8 sm:h-10 text-xs sm:text-sm">
                  <Plus className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                  <span className="hidden sm:inline">Nouvelle Sous-catégorie</span>
                  <span className="sm:hidden">Nouvelle</span>
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-[95vw] sm:max-w-lg max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>
                    {editingSousCategorie ? 'Modifier la Sous-catégorie' : 'Nouvelle Sous-catégorie'}
                  </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="categorie_id">Catégorie parente *</Label>
                    <Select 
                      value={formData.categorie_id} 
                      onValueChange={(value) => setFormData({ ...formData, categorie_id: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionner une catégorie" />
                      </SelectTrigger>
                      <SelectContent className="z-[100]" position="popper" sideOffset={5}>
                        {categories.map(cat => (
                          <SelectItem key={cat.id} value={cat.id}>{cat.nom}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="nom">Nom *</Label>
                    <Input
                      id="nom"
                      value={formData.nom}
                      onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="slug">Slug (auto-généré si vide)</Label>
                    <Input
                      id="slug"
                      value={formData.slug}
                      onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                      placeholder={generateSlug(formData.nom)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      rows={2}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="stock_type">Type de gestion de stock</Label>
                    <Select 
                      value={formData.stock_type} 
                      onValueChange={(value: 'quantity' | 'boite_m2' | 'barre_metre') => 
                        setFormData({ ...formData, stock_type: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="z-[100]" position="popper" sideOffset={5}>
                        <SelectItem value="quantity">Quantité simple (unités)</SelectItem>
                        <SelectItem value="boite_m2">Boîtes / m² (céramique)</SelectItem>
                        <SelectItem value="barre_metre">Barres / mètres (fer)</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Détermine comment le stock sera géré pour les produits de cette sous-catégorie.
                    </p>
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
                    <Label htmlFor="is_active">Active</Label>
                    <Switch
                      id="is_active"
                      checked={formData.is_active}
                      onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                      Annuler
                    </Button>
                    <Button type="submit">
                      {editingSousCategorie ? 'Mettre à jour' : 'Créer'}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="hidden sm:table-cell w-8"></TableHead>
                    <TableHead className="hidden sm:table-cell">Ordre</TableHead>
                    <TableHead>Nom</TableHead>
                    <TableHead className="hidden md:table-cell">Catégorie</TableHead>
                    <TableHead className="hidden sm:table-cell">Type stock</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sousCategories.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                        Aucune sous-catégorie trouvée
                      </TableCell>
                    </TableRow>
                  ) : (
                    <SortableContext items={sousCategories.map(sc => sc.id)} strategy={verticalListSortingStrategy}>
                      {sousCategories.map((sc) => (
                        <SortableSubcategoryRow
                          key={sc.id}
                          sousCategorie={sc}
                          getCategoryName={getCategoryName}
                          getStockTypeLabel={getStockTypeLabel}
                          onEdit={handleEdit}
                          onDelete={(item) => setDeleteDialog({
                            open: true,
                            id: item.id,
                            name: item.nom
                          })}
                          onManageSpecs={onSelectSubcategory}
                        />
                      ))}
                    </SortableContext>
                  )}
                </TableBody>
              </Table>
            </DndContext>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={deleteDialog.open} onOpenChange={(open) => setDeleteDialog(prev => ({ ...prev, open }))}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer la suppression</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer la sous-catégorie "{deleteDialog.name}" ?
              Les spécifications associées seront également supprimées.
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
