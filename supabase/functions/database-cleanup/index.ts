import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('🔍 Vérification de la taille de la base de données...');

    // Vérifier la taille de la BD
    const { data: sizeData, error: sizeError } = await supabase.rpc('check_database_size');

    if (sizeError) {
      console.error('Erreur lors de la vérification:', sizeError);
      throw sizeError;
    }

    console.log('📊 Taille actuelle:', sizeData);

    // Si le nettoyage est nécessaire
    if (sizeData.needs_cleanup) {
      console.log('🧹 Seuil atteint (80%), déclenchement du nettoyage...');

      const { data: cleanupData, error: cleanupError } = await supabase.rpc('cleanup_old_data');

      if (cleanupError) {
        console.error('Erreur lors du nettoyage:', cleanupError);
        throw cleanupError;
      }

      console.log('✅ Nettoyage terminé:', cleanupData);

      return new Response(
        JSON.stringify({
          message: 'Nettoyage effectué avec succès',
          size_info: sizeData,
          cleanup_result: cleanupData
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    } else {
      console.log(`✅ Aucun nettoyage nécessaire (${sizeData.usage_percent}% utilisé)`);

      return new Response(
        JSON.stringify({
          message: 'Aucun nettoyage nécessaire',
          size_info: sizeData
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }
  } catch (error: any) {
    console.error('❌ Erreur lors du nettoyage automatique:', error);
    return new Response(
      JSON.stringify({ error: error?.message || 'Unknown error' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
