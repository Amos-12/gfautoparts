import { useState, useCallback, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogFooter 
} from '@/components/ui/dialog';
import { 
  Barcode, 
  Package, 
  Check, 
  X, 
  AlertTriangle,
  RefreshCw,
  History,
  Minus,
  Plus,
  ScanLine,
  Wifi,
  WifiOff,
  FileText,
  Clock,
  Loader2,
  Volume2,
  VolumeX
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { useBarcodeScanner } from '@/hooks/useBarcodeScanner';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { useInventorySounds } from '@/hooks/useInventorySounds';
import { generateInventoryReport, InventoryReportData, CompanySettings } from '@/lib/pdfGenerator';

interface Product {
  id: string;
  name: string;
  barcode?: string;
  category: string;
  quantity: number;
  stock_boite?: number;
  stock_barre?: number;
  surface_par_boite?: number;
  alert_threshold: number;
  unit: string;
}

interface ScannedItem {
  product: Product;
  scannedAt: Date;
  expectedStock: number;
  actualStock: number | null;
  verified: boolean;
  adjusted: boolean;
  stockUnit: string;
  pendingSync?: boolean;
}

interface PendingOperation {
  id: string;
  type: 'adjustment' | 'verification';
  productId: string;
  productName: string;
  previousValue: number;
  newValue: number;
  reason: string;
  timestamp: Date;
  stockUnit: string;
  category: string;
}

const PENDING_OPS_KEY = 'inventory_pending_ops';
const SESSION_START_KEY = 'inventory_session_start';

const SOUND_ENABLED_KEY = 'inventory_sound_enabled';

export const QuickInventoryMode = () => {
  const { user, profile } = useAuth();
  const isOnline = useOnlineStatus();
  const { playScan, playVerified, playAdjusted, playError } = useInventorySounds();
  const [isActive, setIsActive] = useState(false);
  const [sessionStart, setSessionStart] = useState<Date | null>(null);
  const [scannedItems, setScannedItems] = useState<ScannedItem[]>([]);
  const [currentProduct, setCurrentProduct] = useState<Product | null>(null);
  const [adjustmentDialog, setAdjustmentDialog] = useState(false);
  const [newStockValue, setNewStockValue] = useState('');
  const [adjustmentReason, setAdjustmentReason] = useState('');
  const [manualBarcode, setManualBarcode] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [pendingOperations, setPendingOperations] = useState<PendingOperation[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [companySettings, setCompanySettings] = useState<CompanySettings | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(() => {
    const saved = localStorage.getItem(SOUND_ENABLED_KEY);
    return saved !== 'false';
  });

  // Save sound preference
  useEffect(() => {
    localStorage.setItem(SOUND_ENABLED_KEY, String(soundEnabled));
  }, [soundEnabled]);

  // Load pending operations and session from localStorage
  useEffect(() => {
    const savedOps = localStorage.getItem(PENDING_OPS_KEY);
    if (savedOps) {
      try {
        const parsed = JSON.parse(savedOps);
        setPendingOperations(parsed.map((op: any) => ({
          ...op,
          timestamp: new Date(op.timestamp)
        })));
      } catch (e) {
        console.error('Error parsing pending operations:', e);
      }
    }

    const savedSession = localStorage.getItem(SESSION_START_KEY);
    if (savedSession) {
      setSessionStart(new Date(savedSession));
    }
  }, []);

  // Load company settings for PDF generation
  useEffect(() => {
    const fetchCompanySettings = async () => {
      const { data } = await supabase
        .from('company_settings')
        .select('*')
        .limit(1)
        .maybeSingle();
      if (data) {
        setCompanySettings(data as CompanySettings);
      }
    };
    fetchCompanySettings();
  }, []);

  // Sync pending operations when online
  useEffect(() => {
    if (isOnline && pendingOperations.length > 0 && !isSyncing) {
      syncPendingOperations();
    }
  }, [isOnline, pendingOperations.length]);

  // Sync pending operations to database
  const syncPendingOperations = async () => {
    if (!user || pendingOperations.length === 0) return;
    
    setIsSyncing(true);
    let successCount = 0;
    const failedOps: PendingOperation[] = [];

    for (const op of pendingOperations) {
      try {
        // Determine which field to update based on category
        let updateData: any = {};
        if (op.category === 'ceramique') {
          updateData.stock_boite = op.newValue;
        } else if (op.category === 'fer') {
          updateData.stock_barre = op.newValue;
        } else {
          updateData.quantity = op.newValue;
        }

        // Update product stock
        const { error: updateError } = await supabase
          .from('products')
          .update(updateData)
          .eq('id', op.productId);

        if (updateError) {
          throw updateError;
        }

        // Log stock movement
        await supabase.from('stock_movements').insert({
          product_id: op.productId,
          movement_type: 'inventory_adjustment',
          quantity: Math.abs(op.newValue - op.previousValue),
          previous_quantity: op.previousValue,
          new_quantity: op.newValue,
          reason: `${op.reason} (sync hors-ligne)`,
          created_by: user.id
        });

        // Log activity
        await supabase.from('activity_logs').insert({
          user_id: user.id,
          action_type: 'stock_adjusted',
          entity_type: 'product',
          entity_id: op.productId,
          description: `Ajustement inventaire (sync): ${op.productName} de ${op.previousValue} à ${op.newValue} ${op.stockUnit}`,
          metadata: {
            product_name: op.productName,
            previous_stock: op.previousValue,
            new_stock: op.newValue,
            reason: op.reason,
            synced_from_offline: true
          }
        });

        successCount++;

        // Update scanned items to remove pending sync flag
        setScannedItems(prev => prev.map(item =>
          item.product.id === op.productId
            ? { ...item, pendingSync: false }
            : item
        ));
      } catch (error) {
        console.error('Sync error for operation:', op.id, error);
        failedOps.push(op);
      }
    }

    // Update pending operations
    setPendingOperations(failedOps);
    if (failedOps.length === 0) {
      localStorage.removeItem(PENDING_OPS_KEY);
    } else {
      localStorage.setItem(PENDING_OPS_KEY, JSON.stringify(failedOps));
    }

    setIsSyncing(false);

    toast({
      title: "Synchronisation terminée",
      description: `${successCount}/${pendingOperations.length} opération(s) synchronisée(s)`,
      variant: failedOps.length > 0 ? "destructive" : "default"
    });
  };

  // Get stock info based on category
  const getStockInfo = (product: Product) => {
    if (product.category === 'ceramique' && product.stock_boite !== null && product.stock_boite !== undefined) {
      const m2 = product.surface_par_boite ? product.stock_boite * product.surface_par_boite : product.stock_boite;
      return { value: product.stock_boite, displayValue: m2.toFixed(2), unit: 'boîtes', displayUnit: 'm²' };
    }
    if (product.category === 'fer' && product.stock_barre !== null && product.stock_barre !== undefined) {
      return { value: product.stock_barre, displayValue: product.stock_barre.toString(), unit: 'barres', displayUnit: 'barres' };
    }
    return { value: product.quantity, displayValue: product.quantity.toString(), unit: product.unit || 'unités', displayUnit: product.unit || 'unités' };
  };

  // Handle barcode scan
  const handleBarcodeScan = useCallback(async (barcode: string) => {
    if (!isActive) return;
    
    try {
      const { data: product, error } = await supabase
        .from('products')
        .select('*')
        .eq('barcode', barcode)
        .maybeSingle();

      if (error) throw error;

      if (!product) {
        if (soundEnabled) playError();
        toast({
          title: "Produit non trouvé",
          description: `Aucun produit avec le code-barres: ${barcode}`,
          variant: "destructive"
        });
        return;
      }

      const stockInfo = getStockInfo(product as Product);
      
      // Check if already scanned
      const existingIndex = scannedItems.findIndex(item => item.product.id === product.id);
      
      if (existingIndex >= 0) {
        // Re-scan: open adjustment dialog
        if (soundEnabled) playScan();
        setCurrentProduct(product as Product);
        setNewStockValue(stockInfo.value.toString());
        setAdjustmentDialog(true);
        toast({
          title: "Produit déjà scanné",
          description: "Voulez-vous ajuster le stock ?",
        });
      } else {
        // New scan: add to list
        const newItem: ScannedItem = {
          product: product as Product,
          scannedAt: new Date(),
          expectedStock: stockInfo.value,
          actualStock: null,
          verified: false,
          adjusted: false,
          stockUnit: stockInfo.unit
        };
        
        if (soundEnabled) playScan();
        setScannedItems(prev => [newItem, ...prev]);
        setCurrentProduct(product as Product);
        setNewStockValue(stockInfo.value.toString());
        setAdjustmentDialog(true);
        
        toast({
          title: "Produit scanné",
          description: product.name,
        });
      }
    } catch (error) {
      if (soundEnabled) playError();
      console.error('Error fetching product:', error);
      toast({
        title: "Erreur",
        description: "Impossible de récupérer le produit",
        variant: "destructive"
      });
    }
  }, [isActive, scannedItems, soundEnabled, playScan, playError]);

  // Enable barcode scanner
  useBarcodeScanner({
    onScan: handleBarcodeScan,
    enabled: isActive && !adjustmentDialog,
    minLength: 5,
    maxTimeBetweenKeys: 50
  });

  // Handle manual barcode entry
  const handleManualEntry = () => {
    if (manualBarcode.trim().length >= 5) {
      handleBarcodeScan(manualBarcode.trim());
      setManualBarcode('');
    }
  };

  // Start session
  const startSession = () => {
    const start = new Date();
    setSessionStart(start);
    localStorage.setItem(SESSION_START_KEY, start.toISOString());
    setIsActive(true);
  };

  // Stop session
  const stopSession = () => {
    setIsActive(false);
  };

  // Verify stock (mark as correct without adjustment)
  const verifyStock = (productId: string) => {
    if (soundEnabled) playVerified();
    setScannedItems(prev => prev.map(item => 
      item.product.id === productId 
        ? { ...item, verified: true, actualStock: item.expectedStock }
        : item
    ));
    setAdjustmentDialog(false);
    setCurrentProduct(null);
    toast({
      title: "Stock vérifié",
      description: "Le stock correspond à l'inventaire",
    });
  };

  // Adjust stock (online or offline)
  const adjustStock = async () => {
    if (!currentProduct || !user) return;
    
    const newValue = parseFloat(newStockValue);
    if (isNaN(newValue) || newValue < 0) {
      if (soundEnabled) playError();
      toast({
        title: "Valeur invalide",
        description: "Veuillez entrer une valeur numérique positive",
        variant: "destructive"
      });
      return;
    }

    setIsProcessing(true);
    
    try {
      const stockInfo = getStockInfo(currentProduct);
      const previousValue = stockInfo.value;

      if (!isOnline) {
        // OFFLINE MODE: Store operation locally
        const pendingOp: PendingOperation = {
          id: crypto.randomUUID(),
          type: 'adjustment',
          productId: currentProduct.id,
          productName: currentProduct.name,
          previousValue: previousValue,
          newValue: newValue,
          reason: adjustmentReason || 'Ajustement inventaire rapide',
          timestamp: new Date(),
          stockUnit: stockInfo.unit,
          category: currentProduct.category
        };

        const newPendingOps = [...pendingOperations, pendingOp];
        setPendingOperations(newPendingOps);
        localStorage.setItem(PENDING_OPS_KEY, JSON.stringify(newPendingOps));

        // Update local UI
        setScannedItems(prev => prev.map(item => 
          item.product.id === currentProduct.id 
            ? { 
                ...item, 
                verified: true, 
                adjusted: newValue !== previousValue,
                actualStock: newValue,
                pendingSync: true
              }
            : item
        ));

        if (soundEnabled) playAdjusted();
        toast({
          title: "Enregistré hors-ligne",
          description: "L'ajustement sera synchronisé dès la connexion rétablie",
        });
      } else {
        // ONLINE MODE: Update database directly
        let updateData: any = {};
        if (currentProduct.category === 'ceramique') {
          updateData.stock_boite = newValue;
        } else if (currentProduct.category === 'fer') {
          updateData.stock_barre = newValue;
        } else {
          updateData.quantity = newValue;
        }

        const { error: updateError } = await supabase
          .from('products')
          .update(updateData)
          .eq('id', currentProduct.id);

        if (updateError) throw updateError;

        // Log stock movement
        await supabase.from('stock_movements').insert({
          product_id: currentProduct.id,
          movement_type: 'inventory_adjustment',
          quantity: Math.abs(newValue - previousValue),
          previous_quantity: previousValue,
          new_quantity: newValue,
          reason: adjustmentReason || 'Ajustement inventaire rapide',
          created_by: user.id
        });

        // Log activity
        await supabase.from('activity_logs').insert({
          user_id: user.id,
          action_type: 'stock_adjusted',
          entity_type: 'product',
          entity_id: currentProduct.id,
          description: `Ajustement inventaire: ${currentProduct.name} de ${previousValue} à ${newValue} ${stockInfo.unit}`,
          metadata: {
            product_name: currentProduct.name,
            previous_stock: previousValue,
            new_stock: newValue,
            reason: adjustmentReason
          }
        });

        // Update scanned items
        setScannedItems(prev => prev.map(item => 
          item.product.id === currentProduct.id 
            ? { 
                ...item, 
                verified: true, 
                adjusted: newValue !== previousValue,
                actualStock: newValue,
                product: { ...item.product, ...updateData }
              }
            : item
        ));

        if (soundEnabled) playAdjusted();
        toast({
          title: "Stock ajusté",
          description: `${currentProduct.name}: ${previousValue} → ${newValue} ${stockInfo.unit}`,
        });
      }

      setAdjustmentDialog(false);
      setCurrentProduct(null);
      setNewStockValue('');
      setAdjustmentReason('');
    } catch (error) {
      if (soundEnabled) playError();
      console.error('Error adjusting stock:', error);
      toast({
        title: "Erreur",
        description: "Impossible d'ajuster le stock",
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Reset session
  const resetSession = () => {
    setScannedItems([]);
    setCurrentProduct(null);
    setNewStockValue('');
    setAdjustmentReason('');
    setSessionStart(null);
    localStorage.removeItem(SESSION_START_KEY);
  };

  // Generate PDF report
  const generateReport = () => {
    if (!companySettings || scannedItems.length === 0) {
      toast({
        title: "Impossible de générer le rapport",
        description: "Aucun produit scanné ou paramètres de l'entreprise non disponibles",
        variant: "destructive"
      });
      return;
    }

    const reportData: InventoryReportData = {
      sessionStart: sessionStart || new Date(),
      sessionEnd: new Date(),
      operatorName: profile?.full_name || user?.email || 'Inconnu',
      scannedItems: scannedItems.map(item => ({
        productName: item.product.name,
        barcode: item.product.barcode,
        category: item.product.category,
        expectedStock: item.expectedStock,
        actualStock: item.actualStock,
        verified: item.verified,
        adjusted: item.adjusted,
        stockUnit: item.stockUnit,
        pendingSync: item.pendingSync
      })),
      stats: {
        total: scannedItems.length,
        verified: scannedItems.filter(i => i.verified && !i.adjusted).length,
        adjusted: scannedItems.filter(i => i.adjusted).length,
        pending: scannedItems.filter(i => !i.verified).length,
        pendingSync: scannedItems.filter(i => i.pendingSync).length
      }
    };

    generateInventoryReport(reportData, companySettings);

    toast({
      title: "Rapport généré",
      description: "Le fichier PDF a été téléchargé",
    });
  };

  // Stats
  const stats = {
    total: scannedItems.length,
    verified: scannedItems.filter(i => i.verified && !i.adjusted).length,
    adjusted: scannedItems.filter(i => i.adjusted).length,
    pending: scannedItems.filter(i => !i.verified).length,
    pendingSync: pendingOperations.length
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <CardTitle className="flex items-center gap-2">
                <ScanLine className="w-5 h-5" />
                Mode Inventaire Rapide
              </CardTitle>
              {/* Online/Offline status */}
              <Badge variant={isOnline ? "outline" : "destructive"} className="gap-1">
                {isOnline ? (
                  <>
                    <Wifi className="w-3 h-3" />
                    En ligne
                  </>
                ) : (
                  <>
                    <WifiOff className="w-3 h-3" />
                    Hors-ligne
                  </>
                )}
              </Badge>
              {/* Pending sync indicator */}
              {stats.pendingSync > 0 && (
                <Badge variant="secondary" className="gap-1">
                  {isSyncing ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Clock className="w-3 h-3" />
                  )}
                  {stats.pendingSync} en attente
                </Badge>
              )}
            </div>
            <div className="flex gap-2 flex-wrap">
              {/* Sound toggle */}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSoundEnabled(!soundEnabled)}
                title={soundEnabled ? "Désactiver les sons" : "Activer les sons"}
              >
                {soundEnabled ? (
                  <Volume2 className="w-4 h-4" />
                ) : (
                  <VolumeX className="w-4 h-4 text-muted-foreground" />
                )}
              </Button>
              {scannedItems.length > 0 && (
                <Button variant="outline" onClick={generateReport} className="gap-2">
                  <FileText className="w-4 h-4" />
                  Rapport PDF
                </Button>
              )}
              <Button
                variant={isActive ? "destructive" : "default"}
                onClick={() => isActive ? stopSession() : startSession()}
                className="gap-2"
              >
                {isActive ? (
                  <>
                    <X className="w-4 h-4" />
                    Arrêter
                  </>
                ) : (
                  <>
                    <Barcode className="w-4 h-4" />
                    Démarrer
                  </>
                )}
              </Button>
              {scannedItems.length > 0 && (
                <Button variant="outline" onClick={resetSession} className="gap-2">
                  <RefreshCw className="w-4 h-4" />
                  Réinitialiser
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isActive ? (
            <div className="space-y-4">
              {/* Scanner status */}
              <div className="flex items-center justify-center p-6 border-2 border-dashed border-primary/50 rounded-lg bg-primary/5">
                <div className="text-center">
                  <Barcode className="w-12 h-12 mx-auto text-primary animate-pulse" />
                  <p className="mt-2 font-medium text-primary">Scanner prêt</p>
                  <p className="text-sm text-muted-foreground">
                    Scannez un code-barres ou entrez-le manuellement
                  </p>
                </div>
              </div>

              {/* Manual entry */}
              <div className="flex gap-2">
                <Input
                  placeholder="Entrer le code-barres manuellement..."
                  value={manualBarcode}
                  onChange={(e) => setManualBarcode(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleManualEntry()}
                  className="flex-1"
                />
                <Button onClick={handleManualEntry} disabled={manualBarcode.length < 5}>
                  Rechercher
                </Button>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <div className="p-3 rounded-lg bg-muted text-center">
                  <div className="text-2xl font-bold">{stats.total}</div>
                  <div className="text-xs text-muted-foreground">Scannés</div>
                </div>
                <div className="p-3 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 text-center">
                  <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">{stats.verified}</div>
                  <div className="text-xs text-emerald-600 dark:text-emerald-500">Vérifiés</div>
                </div>
                <div className="p-3 rounded-lg bg-amber-100 dark:bg-amber-900/30 text-center">
                  <div className="text-2xl font-bold text-amber-700 dark:text-amber-400">{stats.adjusted}</div>
                  <div className="text-xs text-amber-600 dark:text-amber-500">Ajustés</div>
                </div>
                <div className="p-3 rounded-lg bg-sky-100 dark:bg-sky-900/30 text-center">
                  <div className="text-2xl font-bold text-sky-700 dark:text-sky-400">{stats.pending}</div>
                  <div className="text-xs text-sky-600 dark:text-sky-500">En attente</div>
                </div>
                {stats.pendingSync > 0 && (
                  <div className="p-3 rounded-lg bg-orange-100 dark:bg-orange-900/30 text-center">
                    <div className="text-2xl font-bold text-orange-700 dark:text-orange-400">{stats.pendingSync}</div>
                    <div className="text-xs text-orange-600 dark:text-orange-500">À sync</div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Package className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Cliquez sur "Démarrer" pour activer le mode inventaire rapide</p>
              <p className="text-sm mt-1">Scannez les produits pour vérifier et ajuster les stocks</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Scanned items list */}
      {scannedItems.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <History className="w-4 h-4" />
              Produits scannés ({scannedItems.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[400px]">
              <div className="space-y-2">
                {scannedItems.map((item, index) => {
                  const stockInfo = getStockInfo(item.product);
                  return (
                    <div 
                      key={`${item.product.id}-${index}`}
                      className={`p-3 rounded-lg border ${
                        item.pendingSync
                          ? 'border-orange-300 bg-orange-50 dark:bg-orange-900/20'
                          : item.adjusted 
                            ? 'border-amber-300 bg-amber-50 dark:bg-amber-900/20' 
                            : item.verified 
                              ? 'border-emerald-300 bg-emerald-50 dark:bg-emerald-900/20'
                              : 'border-border bg-muted/50'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium truncate">{item.product.name}</span>
                            {item.pendingSync && (
                              <Badge variant="outline" className="bg-orange-100 text-orange-700 border-orange-300">
                                <Clock className="w-3 h-3 mr-1" />
                                Sync
                              </Badge>
                            )}
                            {item.verified && !item.adjusted && !item.pendingSync && (
                              <Badge variant="outline" className="bg-emerald-100 text-emerald-700 border-emerald-300">
                                <Check className="w-3 h-3 mr-1" />
                                Vérifié
                              </Badge>
                            )}
                            {item.adjusted && !item.pendingSync && (
                              <Badge variant="outline" className="bg-amber-100 text-amber-700 border-amber-300">
                                <AlertTriangle className="w-3 h-3 mr-1" />
                                Ajusté
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                            {item.product.barcode && (
                              <code className="text-xs bg-muted px-1 rounded">{item.product.barcode}</code>
                            )}
                            <span>
                              Stock: {item.adjusted 
                                ? `${item.expectedStock} → ${item.actualStock}` 
                                : stockInfo.displayValue
                              } {stockInfo.displayUnit}
                            </span>
                          </div>
                        </div>
                        {!item.verified && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setCurrentProduct(item.product);
                              setNewStockValue(stockInfo.value.toString());
                              setAdjustmentDialog(true);
                            }}
                          >
                            Vérifier
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Adjustment Dialog */}
      <Dialog open={adjustmentDialog} onOpenChange={setAdjustmentDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Vérification du stock</DialogTitle>
          </DialogHeader>
          {currentProduct && (
            <div className="space-y-4">
              <div className="p-3 rounded-lg bg-muted">
                <div className="font-medium">{currentProduct.name}</div>
                {currentProduct.barcode && (
                  <code className="text-xs text-muted-foreground">{currentProduct.barcode}</code>
                )}
              </div>

              {!isOnline && (
                <div className="p-3 rounded-lg bg-orange-100 dark:bg-orange-900/30 border border-orange-300">
                  <div className="flex items-center gap-2 text-orange-700 dark:text-orange-400">
                    <WifiOff className="w-4 h-4" />
                    <span className="text-sm font-medium">Mode hors-ligne</span>
                  </div>
                  <p className="text-xs text-orange-600 dark:text-orange-500 mt-1">
                    Les modifications seront synchronisées dès la connexion rétablie
                  </p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground text-xs">Stock système</Label>
                  <div className="text-2xl font-bold">
                    {getStockInfo(currentProduct).displayValue}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {getStockInfo(currentProduct).displayUnit}
                  </div>
                </div>
                <div>
                  <Label htmlFor="actual-stock">Stock réel</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <Button
                      size="icon"
                      variant="outline"
                      onClick={() => setNewStockValue(prev => Math.max(0, parseFloat(prev) - 1).toString())}
                    >
                      <Minus className="w-4 h-4" />
                    </Button>
                    <Input
                      id="actual-stock"
                      type="number"
                      step="0.01"
                      min="0"
                      value={newStockValue}
                      onChange={(e) => setNewStockValue(e.target.value)}
                      className="text-center text-lg font-bold"
                    />
                    <Button
                      size="icon"
                      variant="outline"
                      onClick={() => setNewStockValue(prev => (parseFloat(prev) + 1).toString())}
                    >
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                  <div className="text-sm text-muted-foreground mt-1">
                    {getStockInfo(currentProduct).unit}
                  </div>
                </div>
              </div>

              {parseFloat(newStockValue) !== getStockInfo(currentProduct).value && (
                <div className="space-y-2">
                  <Label htmlFor="reason">Raison de l'ajustement</Label>
                  <Input
                    id="reason"
                    placeholder="Ex: Erreur de saisie, casse, vol..."
                    value={adjustmentReason}
                    onChange={(e) => setAdjustmentReason(e.target.value)}
                  />
                </div>
              )}
            </div>
          )}
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setAdjustmentDialog(false);
                setCurrentProduct(null);
              }}
              className="w-full sm:w-auto"
            >
              Annuler
            </Button>
            {currentProduct && parseFloat(newStockValue) === getStockInfo(currentProduct).value ? (
              <Button
                onClick={() => verifyStock(currentProduct.id)}
                className="w-full sm:w-auto gap-2 bg-emerald-600 hover:bg-emerald-700"
              >
                <Check className="w-4 h-4" />
                Stock correct
              </Button>
            ) : (
              <Button
                onClick={adjustStock}
                disabled={isProcessing}
                className="w-full sm:w-auto gap-2 bg-amber-600 hover:bg-amber-700"
              >
                {isProcessing ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <AlertTriangle className="w-4 h-4" />
                )}
                Ajuster le stock
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
