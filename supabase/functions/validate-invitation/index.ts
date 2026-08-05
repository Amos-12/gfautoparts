import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

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

    const { invitation_code } = await req.json();

    if (!invitation_code || typeof invitation_code !== 'string') {
      throw new Error("Code d'invitation requis");
    }

    const { data: company, error } = await supabase
      .from('companies')
      .select('id, name, is_active')
      .eq('invitation_code', invitation_code.trim())
      .maybeSingle();

    if (error) throw error;

    if (!company) {
      throw new Error("Code d'invitation invalide");
    }

    if (!company.is_active) {
      throw new Error('Cette entreprise est actuellement suspendue');
    }

    return new Response(
      JSON.stringify({
        company_id: company.id,
        company_name: company.name,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Erreur de validation",
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
