import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SaleItem {
  id: string;
  product_id: string;
  quantity: number;
  product_name: string;
}

interface Product {
  id: string;
  name: string;
  category: string;
  quantity: number;
  stock_barre?: number;
  stock_boite?: number;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Authorization header manquant');
    }

    // Verify user authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      throw new Error('Non authentifié');
    }

    // Verify admin role
    const { data: roleData, error: roleError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (roleError || roleData?.role !== 'admin') {
      throw new Error('Seuls les administrateurs peuvent supprimer des ventes');
    }

    // Get sale ID from request body
    const { saleId } = await req.json();
    if (!saleId) {
      throw new Error('ID de vente manquant');
    }

    console.log('Starting sale deletion for sale:', saleId);

    // 1. Get all sale items for this sale
    const { data: saleItems, error: itemsError } = await supabase
      .from('sale_items')
      .select('id, product_id, quantity, product_name')
      .eq('sale_id', saleId);

    if (itemsError) {
      console.error('Error fetching sale items:', itemsError);
      throw new Error('Impossible de récupérer les articles de la vente');
    }

    if (!saleItems || saleItems.length === 0) {
      console.log('No sale items found for sale:', saleId);
    }

    let restoredProductsCount = 0;

    // 2. Restore stock for each product
    for (const item of (saleItems as SaleItem[])) {
      console.log(`Restoring stock for product ${item.product_id}, quantity: ${item.quantity}`);

      // Get product details
      const { data: product, error: productError } = await supabase
        .from('products')
        .select('id, name, category, quantity, stock_barre, stock_boite')
        .eq('id', item.product_id)
        .single();

      if (productError) {
        console.error(`Error fetching product ${item.product_id}:`, productError);
        continue;
      }

      const productData = product as Product;
      const previousQuantity = productData.quantity;
      const previousStockBarre = productData.stock_barre || 0;
      const previousStockBoite = productData.stock_boite || 0;

      // Determine which field to update based on category
      let updateData: any = {};
      let newQuantity = previousQuantity;
      let newStockBarre = previousStockBarre;
      let newStockBoite = previousStockBoite;

      if (productData.category === 'fer') {
        newStockBarre = previousStockBarre + item.quantity;
        updateData.stock_barre = newStockBarre;
      } else if (productData.category === 'ceramique') {
        newStockBoite = previousStockBoite + item.quantity;
        updateData.stock_boite = newStockBoite;
      } else {
        newQuantity = previousQuantity + item.quantity;
        updateData.quantity = newQuantity;
      }

      // Update product stock
      const { error: updateError } = await supabase
        .from('products')
        .update(updateData)
        .eq('id', item.product_id);

      if (updateError) {
        console.error(`Error updating product ${item.product_id}:`, updateError);
        continue;
      }

      // Create stock movement record for restoration
      const { error: movementError } = await supabase
        .from('stock_movements')
        .insert({
          product_id: item.product_id,
          movement_type: 'in',
          quantity: item.quantity,
          previous_quantity: productData.category === 'fer' ? previousStockBarre : 
                            (productData.category === 'ceramique' ? previousStockBoite : previousQuantity),
          new_quantity: productData.category === 'fer' ? newStockBarre : 
                       (productData.category === 'ceramique' ? newStockBoite : newQuantity),
          reason: `Restauration stock - Suppression vente #${saleId.substring(0, 8)}`,
          created_by: user.id,
          sale_id: null
        });

      if (movementError) {
        console.error(`Error creating stock movement for product ${item.product_id}:`, movementError);
      } else {
        restoredProductsCount++;
        console.log(`Stock restored for product ${item.product_id}`);
      }
    }

    // 3. Delete sale items
    const { error: deleteSaleItemsError } = await supabase
      .from('sale_items')
      .delete()
      .eq('sale_id', saleId);

    if (deleteSaleItemsError) {
      console.error('Error deleting sale items:', deleteSaleItemsError);
      throw new Error('Impossible de supprimer les articles de la vente');
    }

    // 4. Update stock_movements to remove sale_id reference
    const { error: updateMovementsError } = await supabase
      .from('stock_movements')
      .update({ sale_id: null })
      .eq('sale_id', saleId);

    if (updateMovementsError) {
      console.error('Error updating stock movements:', updateMovementsError);
    }

    // 5. Delete the sale
    const { error: deleteSaleError } = await supabase
      .from('sales')
      .delete()
      .eq('id', saleId);

    if (deleteSaleError) {
      console.error('Error deleting sale:', deleteSaleError);
      throw new Error('Impossible de supprimer la vente');
    }

    // 6. Log the action
    const { error: logError } = await supabase
      .from('activity_logs')
      .insert({
        user_id: user.id,
        action_type: 'sale_deleted',
        entity_type: 'sale',
        entity_id: saleId,
        description: `Vente supprimée avec restauration de ${restoredProductsCount} produit(s)`,
        metadata: {
          sale_id: saleId,
          restored_products: restoredProductsCount,
          total_items: saleItems?.length || 0
        }
      });

    if (logError) {
      console.error('Error logging activity:', logError);
    }

    console.log(`Sale ${saleId} deleted successfully. Restored ${restoredProductsCount} products.`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Vente supprimée avec succès. ${restoredProductsCount} produit(s) remis en stock.`,
        restoredProducts: restoredProductsCount
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );

  } catch (error) {
    console.error('Error in delete-sale function:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Erreur lors de la suppression de la vente'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      }
    );
  }
});
