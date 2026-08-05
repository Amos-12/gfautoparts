import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.58.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const STRIPE_PLANS: Record<string, { price_id: string; name: string }> = {
  basic: { price_id: "price_1T8mnKAOoIXoYDc8xUbIfLlU", name: "Basic" },
  pro: { price_id: "price_1T8mnuAOoIXoYDc8iRjrdyIC", name: "Pro" },
  premium: { price_id: "price_1T8mq4AOoIXoYDc8SRmqM10l", name: "Premium" },
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    const { plan_id, payment_method } = await req.json();

    if (!plan_id || !payment_method) {
      throw new Error("plan_id and payment_method are required");
    }

    // Authenticate user via auth header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      throw new Error("User not authenticated - no auth header");
    }

    // Create a user-scoped client to validate the JWT
    const supabaseAuth = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: userData, error: authError } = await supabaseAuth.auth.getUser();
    if (authError || !userData?.user?.email) {
      console.error("Auth error:", authError?.message);
      throw new Error("User not authenticated - invalid or expired session. Please log in again.");
    }
    const user = userData.user;

    // Get user's company
    const { data: profile } = await supabaseClient
      .from("profiles")
      .select("company_id")
      .eq("user_id", user.id)
      .single();

    if (!profile?.company_id) throw new Error("No company found");

    // Fetch exchange rate from saas_settings
    const { data: settingsData } = await supabaseClient
      .from("saas_settings")
      .select("setting_value")
      .eq("setting_key", "payment_exchange_rate")
      .single();

    const usdHtgRate = (settingsData?.setting_value as any)?.usd_htg_rate || 132.0;
    console.log("Using USD/HTG exchange rate:", usdHtgRate);

    const origin = req.headers.get("origin") || "https://id-preview--964f3753-4441-40ac-acf5-cd66e737e71f.lovable.app";

    if (payment_method === "stripe") {
      const plan = STRIPE_PLANS[plan_id];
      if (!plan) throw new Error(`Invalid plan: ${plan_id}`);

      const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
        apiVersion: "2025-08-27.basil",
      });

      // Check for existing Stripe customer
      const customers = await stripe.customers.list({ email: user.email, limit: 1 });
      let customerId: string | undefined;
      if (customers.data.length > 0) {
        customerId = customers.data[0].id;
      }

      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        customer_email: customerId ? undefined : user.email,
        line_items: [{ price: plan.price_id, quantity: 1 }],
        mode: "subscription",
        success_url: `${origin}/payment-success?session_id={CHECKOUT_SESSION_ID}&plan=${plan_id}`,
        cancel_url: `${origin}/`,
        metadata: {
          company_id: profile.company_id,
          plan_id: plan_id,
          user_id: user.id,
        },
      });

      // Create pending payment record using service role
      const supabaseAdmin = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
      );

      await supabaseAdmin.from("payments").insert({
        company_id: profile.company_id,
        amount: plan_id === "basic" ? 19 : plan_id === "pro" ? 39 : 59,
        currency: "USD",
        payment_method: "stripe",
        payment_reference: session.id,
        status: "pending",
        plan_id: plan_id,
        billing_period: "monthly",
      });

      return new Response(JSON.stringify({ url: session.url }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    if (payment_method === "moncash") {
      // MonCash integration
      const clientId = Deno.env.get("MONCASH_CLIENT_ID");
      const clientSecret = Deno.env.get("MONCASH_CLIENT_SECRET");

      if (!clientId || !clientSecret) {
        throw new Error("MonCash credentials not configured");
      }

      // Check for cached valid token
      const { data: cachedToken } = await supabaseClient
        .from("saas_settings")
        .select("setting_value")
        .eq("setting_key", "moncash_token_cache")
        .single();

      let accessToken: string | null = null;
      const now = Date.now();

      // Use cached token if still valid (with 5 min buffer)
      if (cachedToken?.setting_value) {
        const tokenData = cachedToken.setting_value as any;
        if (tokenData.access_token && tokenData.expires_at && tokenData.expires_at > now + 300000) {
          accessToken = tokenData.access_token;
          console.log("Using cached MonCash token");
        }
      }

      // Get new token if no valid cached token
      if (!accessToken) {
        console.log("Fetching new MonCash token");
        const authResponse = await fetch("https://sandbox.moncashbutton.digicelgroup.com/Api/oauth/token", {
          method: "POST",
          headers: {
            "Authorization": `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: "scope=read,write&grant_type=client_credentials",
        });
        const authData = await authResponse.json();

        console.log("MonCash Auth Response:", { 
          status: authResponse.status, 
          hasToken: !!authData.access_token,
          error: authData.error 
        });

        if (!authData.access_token) {
          throw new Error(`Failed to get MonCash token: ${JSON.stringify(authData)}`);
        }

        accessToken = authData.access_token;

        // Cache token (MonCash tokens typically expire in 3600 seconds)
        const expiresIn = authData.expires_in || 3600;
        const expiresAt = now + (expiresIn * 1000);

        await supabaseClient
          .from("saas_settings")
          .upsert({
            setting_key: "moncash_token_cache",
            setting_value: {
              access_token: accessToken,
              expires_at: expiresAt,
              obtained_at: now,
            },
            description: "Cached MonCash OAuth token",
          }, { onConflict: "setting_key" });

        console.log("Cached new MonCash token, expires in", expiresIn, "seconds");
      }

      // Convert USD to HTG using configured rate
      const amountUSD = plan_id === "basic" ? 19 : plan_id === "pro" ? 39 : 59;
      const amount = Math.round(amountUSD * usdHtgRate); // MonCash expects integer HTG
      const orderId = `SM-${profile.company_id.slice(0, 8)}-${Date.now()}`;

      console.log(`MonCash payment: ${amountUSD} USD × ${usdHtgRate} = ${amount} HTG`);

      // Create payment
      const paymentResponse = await fetch("https://sandbox.moncashbutton.digicelgroup.com/Api/v1/CreatePayment", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ amount, orderId }),
      });
      const paymentData = await paymentResponse.json();

      console.log("MonCash CreatePayment Response:", { 
        status: paymentResponse.status, 
        data: paymentData 
      });

      if (!paymentData.payment_token) {
        throw new Error(`Failed to create MonCash payment: ${JSON.stringify(paymentData)}`);
      }

      // Store pending payment
      const supabaseAdmin = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
      );

      await supabaseAdmin.from("payments").insert({
        company_id: profile.company_id,
        amount,
        currency: "HTG",
        payment_method: "moncash",
        payment_reference: orderId,
        status: "pending",
        plan_id: plan_id,
        billing_period: "monthly",
        metadata: { payment_token: paymentData.payment_token },
      });

      const redirectUrl = `https://sandbox.moncashbutton.digicelgroup.com/Moncash-middleware/Payment/Redirect?token=${paymentData.payment_token}`;

      return new Response(JSON.stringify({ url: redirectUrl }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    if (payment_method === "natcash") {
      // NatCash - placeholder for when API credentials are available
      throw new Error("NatCash integration coming soon. Please use Stripe or MonCash.");
    }

    throw new Error(`Unknown payment method: ${payment_method}`);
  } catch (error) {
    console.error("Error in create-checkout:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
