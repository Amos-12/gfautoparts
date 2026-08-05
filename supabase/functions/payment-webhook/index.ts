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

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    const contentType = req.headers.get("content-type") || "";

    // Stripe webhook (signature verification)
    if (contentType.includes("application/json") && req.headers.get("stripe-signature")) {
      const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
        apiVersion: "2025-08-27.basil",
      });

      const body = await req.text();
      const sig = req.headers.get("stripe-signature")!;
      const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");

      let event: Stripe.Event;
      if (webhookSecret) {
        event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
      } else {
        event = JSON.parse(body);
      }

      if (event.type === "checkout.session.completed") {
        const session = event.data.object as Stripe.Checkout.Session;
        const companyId = session.metadata?.company_id;
        const planId = session.metadata?.plan_id;

        if (companyId && planId) {
          await activateSubscription(supabase, companyId, planId, "stripe", session.id, session.amount_total ? session.amount_total / 100 : 0);
        }
      }

      if (event.type === "invoice.paid") {
        const invoice = event.data.object as Stripe.Invoice;
        const subscription = await stripe.subscriptions.retrieve(invoice.subscription as string);
        const companyId = subscription.metadata?.company_id;
        const planId = subscription.metadata?.plan_id;

        if (companyId && planId) {
          await activateSubscription(supabase, companyId, planId, "stripe", invoice.id, invoice.amount_paid / 100);
        }
      }

      return new Response(JSON.stringify({ received: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Manual verification (for MonCash callbacks or polling)
    const { payment_reference, payment_method } = await req.json();

    if (payment_method === "moncash" && payment_reference) {
      // Verify MonCash payment
      const clientId = Deno.env.get("MONCASH_CLIENT_ID");
      const clientSecret = Deno.env.get("MONCASH_CLIENT_SECRET");

      if (!clientId || !clientSecret) throw new Error("MonCash not configured");

      const authResponse = await fetch("https://sandbox.moncashbutton.digicelgroup.com/Api/oauth/token", {
        method: "POST",
        headers: {
          "Authorization": `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: "scope=read,write&grant_type=client_credentials",
      });
      const authData = await authResponse.json();

      const verifyResponse = await fetch("https://sandbox.moncashbutton.digicelgroup.com/Api/v1/RetrieveOrderPayment", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${authData.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ orderId: payment_reference }),
      });
      const verifyData = await verifyResponse.json();

      if (verifyData.payment?.message === "successful") {
        // Find the pending payment
        const { data: payment } = await supabase
          .from("payments")
          .select("*")
          .eq("payment_reference", payment_reference)
          .eq("status", "pending")
          .single();

        if (payment) {
          await activateSubscription(supabase, payment.company_id, payment.plan_id, "moncash", payment_reference, payment.amount);
        }

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ success: false, message: "Payment not verified" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    throw new Error("Invalid request");
  } catch (error) {
    console.error("Error in payment-webhook:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});

async function activateSubscription(
  supabase: any,
  companyId: string,
  planId: string,
  paymentMethod: string,
  reference: string,
  amount: number
) {
  const now = new Date();
  const endDate = new Date(now);
  endDate.setDate(endDate.getDate() + 30);

  const limits = PLAN_LIMITS[planId] || PLAN_LIMITS.basic;

  // Update company subscription
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
    .eq("payment_reference", reference)
    .eq("status", "pending");

  // Generate invoice number
  const invoiceNumber = `INV-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}-${companyId.slice(0, 6).toUpperCase()}`;

  // Create invoice
  await supabase.from("subscription_invoices").insert({
    company_id: companyId,
    invoice_number: invoiceNumber,
    amount,
    currency: paymentMethod === "moncash" ? "HTG" : "USD",
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
    description: `Abonnement ${planId} activé via ${paymentMethod}`,
    metadata: { plan_id: planId, payment_method: paymentMethod, amount },
  });
}
