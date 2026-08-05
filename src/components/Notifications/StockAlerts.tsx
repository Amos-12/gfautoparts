import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Bell, 
  Package, 
  AlertTriangle, 
  CheckCircle, 
  RefreshCw,
  ArrowUpCircle,
  ArrowDownCircle,
  Settings2
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface StockMovement {
  id: string;
  product_id: string;
  movement_type: string;
  quantity: number;
  previous_quantity: number;
  new_quantity: number;
  reason: string;
  created_at: string;
  created_by: string;
  products?: {
    name: string;
    alert_threshold: number;
  };
}

interface Product {
  id: string;
  name: string;
  quantity: number;
  alert_threshold: number;
  category: string;
}

export const StockAlerts = () => {
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [lowStockProducts, setLowStockProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      await Promise.all([
        fetchStockMovements(),
        fetchLowStockProducts()
      ]);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: "Erreur",
        description: "Impossible de charger les notifications",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchStockMovements = async () => {
    const { data, error } = await supabase
      .from('stock_movements')
      .select(`
        *,
        products (
          name,
          alert_threshold
        )
      `)
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) throw error;
    setMovements(data || []);
  };

  const fetchLowStockProducts = async () => {
    const { data: products, error } = await supabase
      .from('products')
      .select('*')
      .eq('is_active', true);

    if (error) throw error;

    const lowStock = (products || []).filter(
      product => product.quantity <= product.alert_threshold
    );
    
    setLowStockProducts(lowStock);
  };

  const getMovementBadge = (type: string, quantity: number) => {
    switch (type) {
      case 'in':
        return (
          <Badge className="bg-green-600 text-white text-[10px] sm:text-xs">
            <ArrowUpCircle className="w-3 h-3 mr-1" />
            +{quantity}
          </Badge>
        );
      case 'out':
        return (
          <Badge className="bg-red-600 text-white text-[10px] sm:text-xs">
            <ArrowDownCircle className="w-3 h-3 mr-1" />
            -{Math.abs(quantity)}
          </Badge>
        );
      case 'adjustment':
        return (
          <Badge className="bg-blue-600 text-white text-[10px] sm:text-xs">
            <Settings2 className="w-3 h-3 mr-1" />
            {quantity >= 0 ? '+' : ''}{quantity}
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary" className="text-[10px] sm:text-xs">
            {quantity}
          </Badge>
        );
    }
  };

  const getMovementIcon = (type: string) => {
    switch (type) {
      case 'in':
        return <ArrowUpCircle className="w-4 h-4 sm:w-5 sm:h-5 text-green-600" />;
      case 'out':
        return <ArrowDownCircle className="w-4 h-4 sm:w-5 sm:h-5 text-red-600" />;
      case 'adjustment':
        return <Settings2 className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />;
      default:
        return <Package className="w-4 h-4 sm:w-5 sm:h-5" />;
    }
  };

  const formatDateCompact = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit'
    });
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-6 h-6 sm:w-8 sm:h-8 text-primary animate-spin" />
        <span className="ml-2 text-sm sm:text-base text-muted-foreground">Chargement...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg sm:text-2xl font-bold">Notifications et Alertes</h2>
        <Button onClick={fetchData} variant="outline" size="sm" className="h-8 sm:h-9">
          <RefreshCw className="w-3 h-3 sm:w-4 sm:h-4 sm:mr-2" />
          <span className="hidden sm:inline">Actualiser</span>
        </Button>
      </div>

      {/* Alertes Stock Faible */}
      {lowStockProducts.length > 0 && (
        <Alert className="border-warning p-3 sm:p-4">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="text-xs sm:text-sm">
            <strong>Alerte Stock Faible:</strong> {lowStockProducts.length} produit(s) nécessitent un réapprovisionnement.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Produits en Stock Faible */}
        <Card className="shadow-lg">
          <CardHeader className="p-3 sm:p-6">
            <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
              <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5 text-warning" />
              Stock Faible ({lowStockProducts.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-2 sm:p-6 pt-0 sm:pt-0">
            {lowStockProducts.length === 0 ? (
              <div className="text-center py-6 sm:py-8 text-muted-foreground">
                <CheckCircle className="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-3 sm:mb-4 text-success opacity-50" />
                <p className="text-xs sm:text-sm">Tous les produits ont un stock suffisant</p>
              </div>
            ) : (
              <div className="space-y-2 sm:space-y-3 max-h-96 overflow-y-auto">
                {lowStockProducts.map((product) => (
                  <div 
                    key={product.id} 
                    className="flex items-center justify-between p-2 sm:p-3 border rounded-lg bg-warning/5"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-xs sm:text-sm truncate">{product.name}</div>
                      <div className="text-[10px] sm:text-sm text-muted-foreground hidden sm:block">
                        Catégorie: {product.category}
                      </div>
                    </div>
                    <div className="text-right ml-2 flex-shrink-0">
                      <div className="font-bold text-warning text-xs sm:text-sm">
                        {product.quantity} unités
                      </div>
                      <div className="text-[10px] sm:text-xs text-muted-foreground">
                        Seuil: {product.alert_threshold}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Mouvements de Stock Récents */}
        <Card className="shadow-lg">
          <CardHeader className="p-3 sm:p-6">
            <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
              <Bell className="w-4 h-4 sm:w-5 sm:h-5" />
              Mouvements Récents ({movements.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-2 sm:p-6 pt-0 sm:pt-0">
            {movements.length === 0 ? (
              <div className="text-center py-6 sm:py-8 text-muted-foreground">
                <Package className="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-3 sm:mb-4 opacity-50" />
                <p className="text-xs sm:text-sm">Aucun mouvement de stock récent</p>
              </div>
            ) : (
              <div className="space-y-2 sm:space-y-3 max-h-96 overflow-y-auto">
                {movements.map((movement) => (
                  <div 
                    key={movement.id} 
                    className="flex items-center justify-between p-2 sm:p-3 border rounded-lg hover:bg-accent transition-smooth"
                  >
                    <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                      <div className="flex items-center justify-center w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-secondary flex-shrink-0">
                        {getMovementIcon(movement.movement_type)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-medium text-xs sm:text-sm truncate">
                          {movement.products?.name || 'Produit inconnu'}
                        </div>
                        <div className="text-[10px] sm:text-xs text-muted-foreground truncate hidden sm:block">
                          {movement.reason}
                        </div>
                        <div className="text-[10px] sm:text-xs text-muted-foreground">
                          <span className="sm:hidden">{formatDateCompact(movement.created_at)} {formatTime(movement.created_at)}</span>
                          <span className="hidden sm:inline">{new Date(movement.created_at).toLocaleString('fr-FR')}</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right ml-2 flex-shrink-0">
                      {getMovementBadge(movement.movement_type, movement.quantity)}
                      <div className="text-[10px] sm:text-xs text-muted-foreground mt-1">
                        {movement.previous_quantity} → {movement.new_quantity}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
