import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface Category {
  id: string;
  nom: string;
  description: string | null;
  slug: string;
  is_active: boolean;
  ordre: number;
  created_at: string;
  updated_at: string;
}

export interface SousCategorie {
  id: string;
  categorie_id: string;
  nom: string;
  description: string | null;
  slug: string;
  is_active: boolean;
  ordre: number;
  stock_type: 'quantity' | 'boite_m2' | 'barre_metre';
  created_at: string;
  updated_at: string;
  category?: Category;
}

export interface SpecificationModele {
  id: string;
  sous_categorie_id: string;
  nom_champ: string;
  type_champ: 'text' | 'number' | 'select' | 'boolean';
  label: string;
  obligatoire: boolean;
  options: string[] | null;
  unite: string | null;
  ordre: number;
  created_at: string;
}

export const useCategories = () => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCategories = async () => {
    try {
      setLoading(true);
      const { data, error: fetchError } = await supabase
        .from('categories')
        .select('*')
        .order('ordre', { ascending: true });

      if (fetchError) throw fetchError;
      setCategories(data || []);
    } catch (err: any) {
      setError(err.message);
      console.error('Error fetching categories:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();

    // Setup realtime subscription
    const channel = supabase
      .channel('categories-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'categories' }, () => {
        fetchCategories();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return { categories, loading, error, refetch: fetchCategories };
};

export const useSousCategories = (categorieId?: string) => {
  const [sousCategories, setSousCategories] = useState<SousCategorie[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSousCategories = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('sous_categories')
        .select(`
          *,
          category:categories(*)
        `)
        .order('ordre', { ascending: true });

      if (categorieId) {
        query = query.eq('categorie_id', categorieId);
      }

      const { data, error: fetchError } = await query;

      if (fetchError) throw fetchError;
      
      // Cast stock_type to the expected type
      const typedData = (data || []).map(item => ({
        ...item,
        stock_type: item.stock_type as 'quantity' | 'boite_m2' | 'barre_metre'
      }));
      
      setSousCategories(typedData);
    } catch (err: any) {
      setError(err.message);
      console.error('Error fetching sous-categories:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSousCategories();

    // Setup realtime subscription
    const channel = supabase
      .channel('sous-categories-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sous_categories' }, () => {
        fetchSousCategories();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [categorieId]);

  return { sousCategories, loading, error, refetch: fetchSousCategories };
};

export const useSpecificationsModeles = (sousCategorieId?: string) => {
  const [specifications, setSpecifications] = useState<SpecificationModele[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSpecifications = async () => {
    if (!sousCategorieId) {
      setSpecifications([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const { data, error: fetchError } = await supabase
        .from('specifications_modeles')
        .select('*')
        .eq('sous_categorie_id', sousCategorieId)
        .order('ordre', { ascending: true });

      if (fetchError) throw fetchError;
      
      // Cast type_champ and options to the expected types
      const typedData = (data || []).map(item => ({
        ...item,
        type_champ: item.type_champ as 'text' | 'number' | 'select' | 'boolean',
        options: item.options as string[] | null
      }));
      
      setSpecifications(typedData);
    } catch (err: any) {
      setError(err.message);
      console.error('Error fetching specifications:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSpecifications();
  }, [sousCategorieId]);

  return { specifications, loading, error, refetch: fetchSpecifications };
};
