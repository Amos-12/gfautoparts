/**
 * Supabase/PostgREST renvoie au maximum 1000 lignes par requête.
 * Ce helper pagine automatiquement avec .range() jusqu'à récupérer
 * l'intégralité des lignes correspondant à la requête.
 *
 * Usage :
 *   const products = await fetchAllRows(
 *     () => supabase.from('products').select('*').eq('is_active', true).order('name')
 *   );
 */
export async function fetchAllRows<T = any>(
    buildQuery: () => any,
    pageSize = 1000
  ): Promise<T[]> {
    const all: T[] = [];
    let from = 0;
  
    // Sécurité : évite une boucle infinie si la base renvoie toujours une page pleine
    const maxIterations = 200;
  
    for (let i = 0; i < maxIterations; i++) {
      const { data, error } = await buildQuery().range(from, from + pageSize - 1);
      if (error) throw error;
  
      const rows = (data || []) as T[];
      all.push(...rows);
  
      if (rows.length < pageSize) break;
      from += pageSize;
    }
  
    return all;
  }
  