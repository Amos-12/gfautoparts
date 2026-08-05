import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface SaleItem {
  product_id: string
  product_name: string
  quantity: number
  unit: string
  unit_price: number
  subtotal: number
  currency?: 'USD' | 'HTG'
}

interface SaleRequest {
  customer_name: string | null
  payment_method: string
  total_amount: number
  subtotal: number
  discount_type: 'percentage' | 'amount' | 'none'
  discount_value: number
  discount_amount: number
  discount_currency?: 'USD' | 'HTG'
  customer_address?: string | null
  items: SaleItem[]
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // STEP 1: Validate environment variables
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    
    console.log('🔧 Environment check:', {
      hasUrl: !!supabaseUrl,
      hasServiceKey: !!supabaseServiceKey,
      urlPrefix: supabaseUrl?.substring(0, 30) + '...'
    })
    
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('❌ Missing environment variables!')
      console.error('SUPABASE_URL present:', !!supabaseUrl)
      console.error('SUPABASE_SERVICE_ROLE_KEY present:', !!supabaseServiceKey)
      throw new Error('Configuration error: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Please configure these secrets in your Supabase project settings.')
    }

    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        persistSession: false,
      },
    })

    // STEP 2: Validate authorization
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      console.error('❌ No authorization header provided')
      throw new Error('Missing authorization header')
    }

    const jwt = authHeader.replace('Bearer ', '')
    console.log('🔐 Validating JWT...')
    
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(jwt)
    
    if (authError) {
      console.error('❌ Auth error:', authError.message)
      throw new Error(`Authentication failed: ${authError.message}`)
    }
    
    if (!user) {
      console.error('❌ No user found from JWT')
      throw new Error('Unauthorized: Invalid token')
    }

    console.log('✅ User authenticated:', user.id)

    // STEP 3: Parse and validate request body
    let saleData: SaleRequest
    try {
      saleData = await req.json()
    } catch (parseError) {
      console.error('❌ Failed to parse request body:', parseError)
      throw new Error('Invalid request body: Expected JSON')
    }

    if (!saleData.items || saleData.items.length === 0) {
      throw new Error('Invalid sale: No items provided')
    }

    console.log('📦 Processing sale:', {
      itemCount: saleData.items.length,
      totalAmount: saleData.total_amount,
      customer: saleData.customer_name || 'Anonymous'
    })

    // STEP 4: Validate stock availability for all items before processing
    console.log('🔍 Validating stock for all items...')
    for (const item of saleData.items) {
      const { data: product, error: productError } = await supabaseClient
        .from('products')
        .select('quantity, stock_boite, stock_barre, category, name, surface_par_boite')
        .eq('id', item.product_id)
        .single()

      if (productError) {
        console.error('❌ Product fetch error:', productError)
        throw new Error(`Product ${item.product_name} not found: ${productError.message}`)
      }

      // Check the appropriate stock field based on product category (aligné avec le frontend)
      let availableStock: number
      if (product.category === 'ceramique' && product.stock_boite !== null && product.stock_boite > 0 && product.surface_par_boite) {
        // stock_boite est en BOÎTES - multiplier par surface_par_boite pour obtenir m²
        const surfaceParBoite = product.surface_par_boite
        const stockDisponibleM2 = product.stock_boite * surfaceParBoite
        console.log(`🔍 Céramique validation: ${product.stock_boite} boîtes × ${surfaceParBoite} m²/boîte = ${stockDisponibleM2.toFixed(2)} m² disponibles, demandé=${item.quantity} m²`)
        
        if (item.quantity > stockDisponibleM2) {
          throw new Error(`Stock insuffisant pour ${item.product_name}. Disponible: ${stockDisponibleM2.toFixed(2)} m², Demandé: ${item.quantity} m²`)
        }
        continue // Skip the generic check below
      } else if (product.category === 'fer' && product.stock_barre !== null && product.stock_barre > 0) {
        availableStock = product.stock_barre
      } else if (product.stock_barre !== null && product.stock_barre > 0) {
        availableStock = product.stock_barre
      } else {
        availableStock = product.quantity
      }

      if (availableStock < item.quantity) {
        throw new Error(`Stock insuffisant pour ${item.product_name}. Disponible: ${availableStock}, Demandé: ${item.quantity}`)
      }
    }

    console.log('✅ Stock validation passed for all items')

    // STEP 5: Create sale record
    console.log('📝 Creating sale record...')
    const { data: sale, error: saleError } = await supabaseClient
      .from('sales')
      .insert([{
        customer_name: saleData.customer_name,
        seller_id: user.id,
        total_amount: saleData.total_amount,
        subtotal: saleData.subtotal,
        discount_type: saleData.discount_type,
        discount_value: saleData.discount_value,
        discount_amount: saleData.discount_amount,
        discount_currency: saleData.discount_currency || 'HTG',
        notes: saleData.customer_address,
        payment_method: saleData.payment_method,
      }])
      .select()
      .single()

    if (saleError) {
      console.error('❌ Sale creation error:', saleError)
      throw new Error(`Failed to create sale: ${saleError.message}`)
    }

    console.log('✅ Sale created:', sale.id)

    // Exchange rate used to normalize purchase price currency (fallback 132)
    let usdHtgRate = 132
    {
      const { data: settingsRow } = await supabaseClient
        .from('company_settings')
        .select('usd_htg_rate')
        .limit(1)
        .maybeSingle()
      const rate = Number(settingsRow?.usd_htg_rate)
      if (Number.isFinite(rate) && rate > 0) usdHtgRate = rate
    }

    // STEP 6: Process each item
    for (const item of saleData.items) {
      console.log(`📦 Processing item: ${item.product_name}`)
      console.log(`   📥 Données reçues du frontend:`)
      console.log(`      - quantity: ${item.quantity} (type: ${typeof item.quantity})`)
      console.log(`      - unit: ${item.unit}`)
      console.log(`      - unit_price: ${item.unit_price}`)
      console.log(`      - subtotal: ${item.subtotal}`)
      
      // Get current product with all fields including purchase_price
      const { data: currentProduct, error: fetchError } = await supabaseClient
        .from('products')
        .select('quantity, stock_boite, stock_barre, category, purchase_price, surface_par_boite, currency')
        .eq('id', item.product_id)
        .single()

      if (fetchError) {
        console.error('❌ Product fetch error:', fetchError)
        throw new Error(`Failed to fetch product ${item.product_name}: ${fetchError.message}`)
      }

      // ---- Normalize purchase price (currency + unit) before computing profit ----
      const saleCurrency = (item.currency || 'HTG') as 'USD' | 'HTG'
      const productCurrency = ((currentProduct as any).currency || saleCurrency) as 'USD' | 'HTG'
      let purchasePriceAtSale = Number(currentProduct.purchase_price) || 0

      // 1) Currency: bring the purchase price into the sale line currency
      if (purchasePriceAtSale > 0 && productCurrency !== saleCurrency) {
        purchasePriceAtSale = productCurrency === 'USD'
          ? purchasePriceAtSale * usdHtgRate
          : purchasePriceAtSale / usdHtgRate
        console.log(`   💱 Prix d'achat converti ${productCurrency}→${saleCurrency}: ${purchasePriceAtSale}`)
      }

      // 2) Unit: ceramic is sold per m². If the purchase price was entered per box,
      //    convert it to a per-m² price using surface_par_boite.
      const surfaceParBoite = Number((currentProduct as any).surface_par_boite) || 0
      if (
        currentProduct.category === 'ceramique' &&
        surfaceParBoite > 0 &&
        purchasePriceAtSale > item.unit_price &&
        purchasePriceAtSale / surfaceParBoite <= item.unit_price
      ) {
        purchasePriceAtSale = purchasePriceAtSale / surfaceParBoite
        console.log(`   📐 Prix d'achat céramique ramené au m²: ${purchasePriceAtSale}`)
      }

      // 3) Safety net: never record a purchase price that is not a finite positive number
      if (!Number.isFinite(purchasePriceAtSale) || purchasePriceAtSale < 0) {
        purchasePriceAtSale = 0
      }

      const profitAmount = (item.unit_price - purchasePriceAtSale) * item.quantity
      if (profitAmount < 0) {
        console.warn(`   ⚠️ Bénéfice négatif pour ${item.product_name}: vente ${item.unit_price} ${saleCurrency} < achat ${purchasePriceAtSale} ${saleCurrency}`)
      }

      // Insert sale item with profit data, currency and unit
      const { error: itemError } = await supabaseClient
        .from('sale_items')
        .insert([{
          sale_id: sale.id,
          product_id: item.product_id,
          product_name: item.product_name,
          quantity: item.quantity,
          unit: item.unit,
          unit_price: item.unit_price,
          subtotal: item.subtotal,
          purchase_price_at_sale: purchasePriceAtSale,
          profit_amount: profitAmount,
          currency: item.currency || 'HTG'
        }])

      if (itemError) {
        console.error('❌ Sale item error:', itemError)
        throw new Error(`Failed to create sale item for ${item.product_name}: ${itemError.message}`)
      }

      // Determine which stock field to update based on category
      let previousQuantity: number
      let newQuantity: number
      let updateData: Record<string, number> = {}
      let stockField: string

      // Céramique: utiliser stock_boite seulement si > 0 et surface_par_boite défini
      if (currentProduct.category === 'ceramique' && currentProduct.stock_boite !== null && currentProduct.stock_boite > 0 && currentProduct.surface_par_boite) {
        // Fonction d'arrondi pour éviter les erreurs de virgule flottante
        const round2 = (val: number) => Math.round(val * 100) / 100
        
        // stock_boite est en BOÎTES - convertir en m², soustraire, reconvertir en boîtes
        const surfaceParBoite = currentProduct.surface_par_boite
        // ARRONDIR CHAQUE VALEUR INTERMÉDIAIRE pour éviter accumulation d'erreurs
        const stockActuelM2 = round2(currentProduct.stock_boite * surfaceParBoite)
        const nouveauStockM2 = round2(stockActuelM2 - item.quantity)
        const nouveauStockBoite = round2(nouveauStockM2 / surfaceParBoite)
        
        previousQuantity = stockActuelM2
        newQuantity = nouveauStockM2
        
        console.log(`🔧 Céramique "${item.product_name}":`)
        console.log(`   - Stock DB (boîtes): ${currentProduct.stock_boite}`)
        console.log(`   - Surface/boîte: ${surfaceParBoite} m²`)
        console.log(`   - Stock actuel: ${stockActuelM2.toFixed(4)} m² (${previousQuantity.toFixed(2)} m² arrondi)`)
        console.log(`   - Quantité vendue: ${item.quantity} m²`)
        console.log(`   - Nouveau stock: ${nouveauStockM2.toFixed(4)} m² (${newQuantity.toFixed(2)} m² arrondi)`)
        console.log(`   - Nouveau stock_boite: ${nouveauStockBoite} boîtes`)
        
        updateData = { stock_boite: nouveauStockBoite }
        stockField = 'stock_boite'
      } else if (currentProduct.category === 'fer' && currentProduct.stock_barre !== null && currentProduct.stock_barre > 0) {
        previousQuantity = currentProduct.stock_barre
        newQuantity = previousQuantity - item.quantity
        updateData = { stock_barre: newQuantity }
        stockField = 'stock_barre'
      } else if (currentProduct.stock_barre !== null && currentProduct.stock_barre > 0) {
        previousQuantity = currentProduct.stock_barre
        newQuantity = previousQuantity - item.quantity
        updateData = { stock_barre: newQuantity }
        stockField = 'stock_barre'
      } else {
        previousQuantity = currentProduct.quantity
        newQuantity = previousQuantity - item.quantity
        updateData = { quantity: newQuantity }
        stockField = 'quantity'
      }

      console.log(`📊 Updating ${stockField}: ${previousQuantity} -> ${newQuantity}`)

      // Update product stock
      const { error: updateError } = await supabaseClient
        .from('products')
        .update(updateData)
        .eq('id', item.product_id)

      if (updateError) {
        console.error('❌ Product update error:', updateError)
        throw new Error(`Failed to update stock for ${item.product_name}: ${updateError.message}`)
      }

      // Record stock movement
      const { error: movementError } = await supabaseClient
        .from('stock_movements')
        .insert([{
          product_id: item.product_id,
          movement_type: 'out',
          quantity: -item.quantity,
          previous_quantity: previousQuantity,
          new_quantity: newQuantity,
          reason: `Vente #${sale.id}`,
          sale_id: sale.id,
          created_by: user.id,
        }])

      if (movementError) {
        console.error('❌ Stock movement error:', movementError)
        throw new Error(`Failed to record stock movement for ${item.product_name}: ${movementError.message}`)
      }

      console.log(`✅ Item processed: ${item.product_name}`)
    }

    // STEP 7: Create activity log (non-blocking)
    try {
      const { data: profile } = await supabaseClient
        .from('profiles')
        .select('full_name')
        .eq('user_id', user.id)
        .single()

      await supabaseClient
        .from('activity_logs')
        .insert({
          user_id: user.id,
          action_type: 'sale_created',
          entity_type: 'sale',
          entity_id: sale.id,
          description: `Vente de ${saleData.total_amount.toFixed(2)} ${saleData.discount_currency || 'HTG'} créée par ${profile?.full_name || 'Vendeur'} pour ${saleData.customer_name || 'Client anonyme'}`,
          metadata: {
            total_amount: saleData.total_amount,
            currency: saleData.discount_currency || 'HTG',
            items_count: saleData.items.length,
            payment_method: saleData.payment_method
          }
        })
    } catch (logError) {
      console.error('⚠️ Failed to create activity log (non-critical):', logError)
    }

    console.log('🎉 Sale completed successfully!')

    return new Response(
      JSON.stringify({
        success: true,
        sale: sale,
        message: 'Vente enregistrée avec succès'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    const errorStack = error instanceof Error ? error.stack : undefined
    
    console.error('🔴 SALE PROCESSING FAILED')
    console.error('Error message:', errorMessage)
    console.error('Error stack:', errorStack)
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMessage,
        details: errorStack,
        timestamp: new Date().toISOString()
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})
