import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.58.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PLAN_LIMITS: Record<string, { max_users: number; max_products: number }> = {
  basic: { max_users: 5, max_products: 200 },
  pro: { max_users: 15, max_products: 1000 },
  premium: { max_users: 999, max_products: 999999 },
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { session_id } = await req.json();
    if (!session_id) throw new Error("session_id is required");

    // Retrieve Stripe session
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    const session = await stripe.checkout.sessions.retrieve(session_id);
    console.log("Stripe session status:", session.payment_status, "metadata:", session.metadata);

    if (session.payment_status !== "paid") {
      return new Response(JSON.stringify({ 
        success: false, 
        status: session.payment_status,
        message: "Payment not yet completed" 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const companyId = session.metadata?.company_id;
    const planId = session.metadata?.plan_id;

    if (!companyId || !planId) {
      throw new Error("Missing metadata in Stripe session");
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Check if already activated (idempotency)
    const { data: company } = await supabase
      .from("companies")
      .select("subscription_plan, subscription_start")
      .eq("id", companyId)
      .single();

    const today = new Date().toISOString().split("T")[0];
    const alreadyActivated = company?.subscription_plan === planId && company?.subscription_start === today;

    if (alreadyActivated) {
      console.log("Subscription already activated today, skipping");
      return new Response(JSON.stringify({ 
        success: true, 
        already_active: true,
        plan: planId 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Activate subscription
    const now = new Date();
    const endDate = new Date(now);
    endDate.setDate(endDate.getDate() + 30);
    const limits = PLAN_LIMITS[planId] || PLAN_LIMITS.basic;

    await supabase
      .from("companies")
      .update({
        subscription_plan: planId,
        subscription_start: now.toISOString().split("T")[0],
        subscription_end: endDate.toISOString().split("T")[0],
        is_active: true,
        max_users: limits.max_users,
        max_products: limits.max_products,
        last_reminder_sent: null,
      })
      .eq("id", companyId);

    // Update payment status
    await supabase
      .from("payments")
      .update({ status: "completed", completed_at: now.toISOString() })
      .eq("payment_reference", session_id)
      .eq("status", "pending");

    // Create invoice
    const invoiceNumber = `INV-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}-${companyId.slice(0, 6).toUpperCase()}`;
    const amount = session.amount_total ? session.amount_total / 100 : 0;

    await supabase.from("subscription_invoices").insert({
      company_id: companyId,
      invoice_number: invoiceNumber,
      amount,
      currency: "USD",
      plan_name: planId,
      period_start: now.toISOString().split("T")[0],
      period_end: endDate.toISOString().split("T")[0],
      status: "paid",
    });

    // Log activity
    await supabase.from("activity_logs").insert({
      company_id: companyId,
      action_type: "settings_updated",
      entity_type: "subscription",
      description: `Abonnement ${planId} activé via stripe`,
      metadata: { plan_id: planId, payment_method: "stripe", amount },
    });

    console.log("Subscription activated:", { companyId, planId });

    return new Response(JSON.stringify({ 
      success: true, 
      plan: planId 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in verify-checkout-session:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
