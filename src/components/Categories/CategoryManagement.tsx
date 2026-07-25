import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FolderTree, Plus, Edit, Trash2, Layers, Settings, GripVertical } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { useCategories, useSousCategories, Category, SousCategorie } from '@/hooks/useCategories';
import { SubcategoryManagement } from './SubcategoryManagement';
import { SpecificationFieldsManager } from './SpecificationFieldsManager';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { usePagination } from '@/hooks/usePagination';
import { TablePagination } from '@/components/ui/table-pagination';

interface SortableRowProps {
  category: Category;
  getSousCategoriesCount: (id: string) => number;
  onEdit: (category: Category) => void;
  onDelete: (category: Category) => void;
  onViewSubcategories: (category: Category) => void;
}

const SortableCategoryRow = ({ category, getSousCategoriesCount, onEdit, onDelete, onViewSubcategories }: SortableRowProps) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: category.id });
  
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
      <TableCell className="hidden sm:table-cell text-xs sm:text-sm p-1 sm:p-2">{category.ordre}</TableCell>
      <TableCell className="font-medium text-xs sm:text-sm p-1 sm:p-2">{category.nom}</TableCell>
      <TableCell className="hidden md:table-cell text-muted-foreground text-xs sm:text-sm p-1 sm:p-2">{category.slug}</TableCell>
      <TableCell className="hidden sm:table-cell p-1 sm:p-2">
        <Badge variant="secondary" className="text-[10px] sm:text-xs">
          {getSousCategoriesCount(category.id)}
        </Badge>
      </TableCell>
      <TableCell className="p-1 sm:p-2">
        <Badge variant={category.is_active ? "default" : "secondary"} className="text-[10px] sm:text-xs">
          {category.is_active ? 'Active' : 'Inactive'}
        </Badge>
      </TableCell>
      <TableCell className="text-right p-1 sm:p-2">
        <div className="flex justify-end gap-0.5 sm:gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 sm:h-8 sm:w-8 p-0"
            onClick={() => onViewSubcategories(category)}
          >
            <Layers className="h-3 w-3 sm:h-4 sm:w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 sm:h-8 sm:w-8 p-0"
            onClick={() => onEdit(category)}
          >
            <Edit className="h-3 w-3 sm:h-4 sm:w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 sm:h-8 sm:w-8 p-0"
            onClick={() => onDelete(category)}
          >
            <Trash2 className="h-3 w-3 sm:h-4 sm:w-4" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
};

export const CategoryManagement = () => {
  const { categories, loading, refetch } = useCategories();
  const { sousCategories, refetch: refetchSousCategories } = useSousCategories();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<{open: boolean, categoryId: string | null, categoryName: string}>({
    open: false, 
    categoryId: null,
    categoryName: ''
  });
  const [activeTab, setActiveTab] = useState('categories');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [selectedSousCategoryId, setSelectedSousCategoryId] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    nom: '',
    description: '',
    slug: '',
    is_active: true,
    ordre: 0
  });

  const resetForm = () => {
    setFormData({
      nom: '',
      description: '',
      slug: '',
      is_active: true,
      ordre: categories.length
    });
    setEditingCategory(null);
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
    
    try {
      const slug = formData.slug || generateSlug(formData.nom);
      const { data: { user } } = await supabase.auth.getUser();
      
      if (editingCategory) {
        const { error } = await supabase
          .from('categories')
          .update({
            nom: formData.nom,
            description: formData.description || null,
            slug,
            is_active: formData.is_active,
            ordre: formData.ordre
          })
          .eq('id', editingCategory.id);

        if (error) throw error;

        // Log activity
        await supabase.from('activity_logs').insert({
          user_id: user?.id,
          action_type: 'category_updated' as any,
          entity_type: 'category',
          entity_id: editingCategory.id,
          description: `Catégorie "${formData.nom}" modifiée`,
          metadata: {
            category_name: formData.nom,
            previous_values: { nom: editingCategory.nom, is_active: editingCategory.is_active },
            new_values: { nom: formData.nom, is_active: formData.is_active }
          }
        });
        
        toast({
          title: "Catégorie mise à jour",
          description: `La catégorie "${formData.nom}" a été modifiée.`
        });
      } else {
        const { data: newCategory, error } = await supabase
          .from('categories')
          .insert({
            nom: formData.nom,
            description: formData.description || null,
            slug,
            is_active: formData.is_active,
            ordre: formData.ordre
          })
          .select()
          .single();

        if (error) throw error;

        // Log activity
        await supabase.from('activity_logs').insert({
          user_id: user?.id,
          action_type: 'category_created' as any,
          entity_type: 'category',
          entity_id: newCategory?.id,
          description: `Catégorie "${formData.nom}" créée`,
          metadata: { category_name: formData.nom, slug }
        });
        
        toast({
          title: "Catégorie créée",
          description: `La catégorie "${formData.nom}" a été ajoutée.`
        });
      }

      setIsDialogOpen(false);
      resetForm();
      refetch();
    } catch (error: any) {
      console.error('Error saving category:', error);
      toast({
        title: "Erreur",
        description: error.message || "Impossible de sauvegarder la catégorie.",
        variant: "destructive"
      });
    }
  };

  const handleEdit = (category: Category) => {
    setEditingCategory(category);
    setFormData({
      nom: category.nom,
      description: category.description || '',
      slug: category.slug,
      is_active: category.is_active,
      ordre: category.ordre
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteDialog.categoryId) return;

    try {
      // Check if category has products
      const { data: products } = await supabase
        .from('products')
        .select('id')
        .eq('categorie_id', deleteDialog.categoryId)
        .limit(1);

      if (products && products.length > 0) {
        toast({
          title: "Impossible de supprimer",
          description: "Cette catégorie contient des produits. Supprimez d'abord les produits.",
          variant: "destructive"
        });
        setDeleteDialog({ open: false, categoryId: null, categoryName: '' });
        return;
      }

      // Check if category has subcategories
      const { data: subCategories } = await supabase
        .from('sous_categories')
        .select('id')
        .eq('categorie_id', deleteDialog.categoryId)
        .limit(1);

      if (subCategories && subCategories.length > 0) {
        toast({
          title: "Impossible de supprimer",
          description: "Cette catégorie contient des sous-catégories. Supprimez d'abord les sous-catégories.",
          variant: "destructive"
        });
        setDeleteDialog({ open: false, categoryId: null, categoryName: '' });
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();

      const { error } = await supabase
        .from('categories')
        .delete()
        .eq('id', deleteDialog.categoryId);

      if (error) throw error;

      // Log activity
      await supabase.from('activity_logs').insert({
        user_id: user?.id,
        action_type: 'category_deleted' as any,
        entity_type: 'category',
        entity_id: deleteDialog.categoryId,
        description: `Catégorie "${deleteDialog.categoryName}" supprimée`,
        metadata: { category_name: deleteDialog.categoryName }
      });

      toast({
        title: "Catégorie supprimée",
        description: `La catégorie "${deleteDialog.categoryName}" a été supprimée.`
      });
      
      refetch();
    } catch (error: any) {
      console.error('Error deleting category:', error);
      toast({
        title: "Erreur",
        description: error.message || "Impossible de supprimer la catégorie.",
        variant: "destructive"
      });
    } finally {
      setDeleteDialog({ open: false, categoryId: null, categoryName: '' });
    }
  };

  const getSousCategoriesCount = (categoryId: string) => {
    return sousCategories.filter(sc => sc.categorie_id === categoryId).length;
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (!over || active.id === over.id) return;

    const oldIndex = categories.findIndex(c => c.id === active.id);
    const newIndex = categories.findIndex(c => c.id === over.id);
    
    const reorderedCategories = arrayMove(categories, oldIndex, newIndex);
    
    // Update ordre in database for all affected items
    try {
      const updates = reorderedCategories.map((cat, index) => 
        supabase.from('categories').update({ ordre: index }).eq('id', cat.id)
      );
      
      await Promise.all(updates);
      refetch();
      
      toast({
        title: "Ordre mis à jour",
        description: "L'ordre des catégories a été modifié."
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
    <div className="space-y-3 sm:space-y-6">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3 h-auto p-0.5 sm:p-1">
          <TabsTrigger value="categories" className="flex items-center gap-1 sm:gap-2 py-1.5 sm:py-2 text-[10px] sm:text-sm">
            <FolderTree className="h-3 w-3 sm:h-4 sm:w-4" />
            <span className="hidden sm:inline">Catégories</span>
            <span className="sm:hidden">Cat.</span>
          </TabsTrigger>
          <TabsTrigger value="subcategories" className="flex items-center gap-1 sm:gap-2 py-1.5 sm:py-2 text-[10px] sm:text-sm">
            <Layers className="h-3 w-3 sm:h-4 sm:w-4" />
            <span className="hidden sm:inline">Sous-cat.</span>
            <span className="sm:hidden">S-Cat.</span>
          </TabsTrigger>
          <TabsTrigger value="specifications" className="flex items-center gap-1 sm:gap-2 py-1.5 sm:py-2 text-[10px] sm:text-sm">
            <Settings className="h-3 w-3 sm:h-4 sm:w-4" />
            <span className="hidden sm:inline">Spécifications</span>
            <span className="sm:hidden">Specs</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="categories" className="mt-2 sm:mt-4">
          <Card>
            <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-4 p-3 sm:p-6">
              <CardTitle className="flex items-center gap-2 text-sm sm:text-lg">
                <FolderTree className="h-4 w-4 sm:h-5 sm:w-5" />
                <span className="hidden sm:inline">Gestion des Catégories</span>
                <span className="sm:hidden">Catégories</span>
              </CardTitle>
              <Dialog open={isDialogOpen} onOpenChange={(open) => {
                setIsDialogOpen(open);
                if (!open) resetForm();
              }}>
                <DialogTrigger asChild>
                  <Button className="w-full sm:w-auto h-8 sm:h-10 text-xs sm:text-sm">
                    <Plus className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                    <span className="hidden sm:inline">Nouvelle Catégorie</span>
                    <span className="sm:hidden">Nouvelle</span>
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-[95vw] sm:max-w-lg max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle className="text-base sm:text-lg">
                      {editingCategory ? 'Modifier la Catégorie' : 'Nouvelle Catégorie'}
                    </DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleSubmit} className="space-y-4">
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
                        rows={3}
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
                        {editingCategory ? 'Mettre à jour' : 'Créer'}
                      </Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent className="p-2 sm:p-6">
              <div className="overflow-x-auto -mx-2 sm:mx-0">
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="hidden sm:table-cell w-8"></TableHead>
                        <TableHead className="hidden sm:table-cell text-xs sm:text-sm">Ordre</TableHead>
                        <TableHead className="text-xs sm:text-sm">Nom</TableHead>
                        <TableHead className="hidden md:table-cell text-xs sm:text-sm">Slug</TableHead>
                        <TableHead className="hidden sm:table-cell text-xs sm:text-sm">S-Cat.</TableHead>
                        <TableHead className="text-xs sm:text-sm">Statut</TableHead>
                        <TableHead className="text-right text-xs sm:text-sm">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <SortableContext items={categories.map(c => c.id)} strategy={verticalListSortingStrategy}>
                        {categories.map((category) => (
                          <SortableCategoryRow
                            key={category.id}
                            category={category}
                            getSousCategoriesCount={getSousCategoriesCount}
                            onEdit={handleEdit}
                            onDelete={(cat) => setDeleteDialog({
                              open: true,
                              categoryId: cat.id,
                              categoryName: cat.nom
                            })}
                            onViewSubcategories={(cat) => {
                              setSelectedCategoryId(cat.id);
                              setActiveTab('subcategories');
                            }}
                          />
                        ))}
                      </SortableContext>
                    </TableBody>
                  </Table>
                </DndContext>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="subcategories">
          <SubcategoryManagement 
            selectedCategoryId={selectedCategoryId}
            onSelectCategory={setSelectedCategoryId}
            onSelectSubcategory={(id) => {
              setSelectedSousCategoryId(id);
              setActiveTab('specifications');
            }}
          />
        </TabsContent>

        <TabsContent value="specifications">
          <SpecificationFieldsManager
            selectedSousCategorieId={selectedSousCategoryId}
            onSelectSousCategorie={setSelectedSousCategoryId}
          />
        </TabsContent>
      </Tabs>

      <AlertDialog open={deleteDialog.open} onOpenChange={(open) => setDeleteDialog(prev => ({ ...prev, open }))}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer la suppression</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer la catégorie "{deleteDialog.categoryName}" ?
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
    </div>
  );
};
