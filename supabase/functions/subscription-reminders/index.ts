import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.58.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    const today = new Date();
    const todayStr = today.toISOString().split("T")[0];

    // Fetch all active companies
    const { data: companies, error } = await supabase
      .from("companies")
      .select("id, name, subscription_end, subscription_plan, is_active, last_reminder_sent")
      .eq("is_active", true);

    if (error) throw error;

    let reminders_sent = 0;
    let deactivated = 0;

    for (const company of companies || []) {
      if (!company.subscription_end) continue;

      const endDate = new Date(company.subscription_end);
      const daysRemaining = Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

      // Skip if already sent reminder today
      if (company.last_reminder_sent === todayStr) continue;

      // J-7, J-3, J-1 reminders
      if ([7, 3, 1].includes(daysRemaining)) {
        const urgency = daysRemaining === 1 ? "urgent" : daysRemaining === 3 ? "warning" : "info";

        await supabase.from("activity_logs").insert({
          company_id: company.id,
          action_type: "settings_updated",
          entity_type: "subscription_reminder",
          description: `Rappel: Votre abonnement ${company.subscription_plan} expire dans ${daysRemaining} jour${daysRemaining > 1 ? "s" : ""}`,
          metadata: { days_remaining: daysRemaining, urgency, plan: company.subscription_plan },
        });

        await supabase
          .from("companies")
          .update({ last_reminder_sent: todayStr })
          .eq("id", company.id);

        reminders_sent++;
      }

      // Deactivate expired subscriptions (with 3 day grace period)
      if (daysRemaining < -3) {
        await supabase
          .from("companies")
          .update({ is_active: false })
          .eq("id", company.id);

        await supabase.from("activity_logs").insert({
          company_id: company.id,
          action_type: "settings_updated",
          entity_type: "subscription",
          description: `Abonnement expiré - entreprise désactivée après période de grâce`,
          metadata: { expired_plan: company.subscription_plan, deactivated_at: todayStr },
        });

        deactivated++;
      }
    }

    return new Response(
      JSON.stringify({ success: true, reminders_sent, deactivated, checked: companies?.length || 0 }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in subscription-reminders:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
