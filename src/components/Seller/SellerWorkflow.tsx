import { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { 
  ShoppingCart, 
  Package, 
  Search,
  Plus,
  Minus,
  Receipt,
  CheckCircle,
  ArrowRight,
  AlertCircle,
  FileText,
  Printer,
  Trash2,
  ChevronDown,
  Barcode,
  Grid3X3,
  List,
  Keyboard,
  X,
  Calculator
} from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { generateReceipt, generateInvoice } from '@/lib/pdfGenerator';
import jsPDF from 'jspdf';
import logo from '@/assets/logo.png';
import { useCategories, useSousCategories } from '@/hooks/useCategories';
import { useBarcodeScanner } from '@/hooks/useBarcodeScanner';
import { useInventorySounds } from '@/hooks/useInventorySounds';
import { CartSection } from './CartSection';
import { useConfetti } from '@/hooks/useConfetti';
import { useCurrencyCalculations } from '@/hooks/useCurrencyCalculations';
import { useCompanySettings } from '@/hooks/useCompanySettings';

interface Product {
  id: string;
  name: string;
  barcode?: string;
  category: string;
  unit: string;
  price: number;
  quantity: number;
  alert_threshold: number;
  is_active: boolean;
  sale_type: 'retail' | 'wholesale';
  currency: 'USD' | 'HTG';
  // Ceramic-specific fields
  dimension?: string;
  surface_par_boite?: number;
  prix_m2?: number;
  stock_boite?: number;
  // Iron bar-specific fields
  diametre?: string;
  longueur_barre?: number;
  longueur_barre_ft?: number;
  prix_par_metre?: number;
  prix_par_barre?: number;
  stock_barre?: number;
  decimal_autorise?: boolean;
  bars_per_ton?: number;  // Number of bars per metric ton (for iron category)
  // Energy-specific fields
  type_energie?: any;
  puissance?: any;
  voltage?: any;
  capacite?: any;
  // Blocs-specific fields
  bloc_type?: string;
  bloc_poids?: number;
  // Vêtements-specific fields
  vetement_taille?: string;
  vetement_genre?: string;
  vetement_couleur?: string;
  // Électroménager-specific fields
  electromenager_sous_categorie?: string;
  electromenager_marque?: string;
  electromenager_modele?: string;
  electromenager_garantie_mois?: number;
  electromenager_niveau_sonore_db?: number;
  electromenager_classe_energie?: string;
  electromenager_couleur?: string;
  electromenager_materiau?: string;
  electromenager_installation?: string;
  // Dynamic specifications (JSONB)
  specifications_techniques?: Record<string, any>;
}

interface CartItem extends Product {
  cartQuantity: number;
  displayUnit?: string; // For ceramics: "m²", For iron: "barre"
  actualPrice?: number; // Calculated price for ceramics
  sourceUnit?: 'barre' | 'tonne'; // Track original input unit for iron
  sourceValue?: number; // Track original input value for iron
}

type WorkflowStep = 'products' | 'cart' | 'checkout' | 'success';

interface SellerWorkflowProps {
  onSaleComplete?: () => void;
  initialCart?: CartItem[];
  initialCustomerName?: string;
}

export const SellerWorkflow = ({ onSaleComplete, initialCart, initialCustomerName }: SellerWorkflowProps) => {
  const { user } = useAuth();
  const { categories: dynamicCategories } = useCategories();
  const { sousCategories: dynamicSousCategories } = useSousCategories();
  
  // Centralized hooks
  const { settings: companySettingsHook } = useCompanySettings();
  const currencyCalc = useCurrencyCalculations();
  
  const [currentStep, setCurrentStep] = useState<WorkflowStep>(initialCart && initialCart.length > 0 ? 'cart' : 'products');
  const [transitionDirection, setTransitionDirection] = useState<'forward' | 'backward'>('forward');
  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>(initialCart || []);
  const [searchTerm, setSearchTerm] = useState('');
  const [saleTypeFilter, setSaleTypeFilter] = useState<'all' | 'retail' | 'wholesale'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [sousCategoryFilter, setSousCategoryFilter] = useState<string>('all');
  const [authorizedCategories, setAuthorizedCategories] = useState<string[]>([]);
  const [customerName, setCustomerName] = useState(initialCustomerName || '');
  const [customerAddress, setCustomerAddress] = useState('');
  const [discountType, setDiscountType] = useState<'none' | 'percentage' | 'amount'>('none');
  const [discountValue, setDiscountValue] = useState('0');
  const [isProcessing, setIsProcessing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [completedSale, setCompletedSale] = useState<any>(null);
  const [customQuantityDialog, setCustomQuantityDialog] = useState<{open: boolean, product: Product | null}>({open: false, product: null});
  const [customQuantityValue, setCustomQuantityValue] = useState('');
  const [quantityUnit, setQuantityUnit] = useState<'barre' | 'tonne'>('barre');
  const [paymentMethod, setPaymentMethod] = useState<'espece' | 'cheque' | 'virement'>('espece');
  const [companySettings, setCompanySettings] = useState<any>(null);
  const [viewMode, setViewMode] = useState<'cards' | 'list'>('cards');
  const [cartPulse, setCartPulse] = useState(false);
  const [showShortcutsHelp, setShowShortcutsHelp] = useState(false);
  const [discountError, setDiscountError] = useState<string | null>(null);

  // Step transition helpers
  const getStepOrder = (step: WorkflowStep): number => {
    const order: Record<WorkflowStep, number> = { products: 0, cart: 1, checkout: 2, success: 3 };
    return order[step];
  };

  const handleStepChange = useCallback((newStep: WorkflowStep) => {
    const currentOrder = getStepOrder(currentStep);
    const newOrder = getStepOrder(newStep);
    setTransitionDirection(newOrder > currentOrder ? 'forward' : 'backward');
    setCurrentStep(newStep);
  }, [currentStep]);

  const getStepAnimationClass = () => {
    return transitionDirection === 'forward' 
      ? 'animate-slide-in-right' 
      : 'animate-slide-in-left';
  };

  // Dynamic categories for filtering
  const availableDynamicCategories = useMemo(() => {
    return [{ id: 'all', nom: 'Toutes les catégories' }, ...dynamicCategories];
  }, [dynamicCategories]);

  const availableSousCategories = useMemo(() => {
    if (categoryFilter === 'all') {
      return [{ id: 'all', nom: 'Toutes les sous-catégories' }, ...dynamicSousCategories];
    }
    const filtered = dynamicSousCategories.filter(sc => sc.categorie_id === categoryFilter);
    return [{ id: 'all', nom: 'Toutes les sous-catégories' }, ...filtered];
  }, [categoryFilter, dynamicSousCategories]);

  // Reset sous-category when category changes
  useEffect(() => {
    setSousCategoryFilter('all');
  }, [categoryFilter]);

  // Utility function to format amounts with space as thousands separator and currency
  const formatAmount = (amount: number, currency: 'USD' | 'HTG' | boolean = true): string => {
    const formatted = amount.toLocaleString('fr-FR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
      useGrouping: true
    }).replace(/\s/g, ' '); // Ensure space separator
    
    if (currency === false) return formatted;
    if (currency === 'USD') return `$${formatted}`;
    return `${formatted} HTG`;
  };

  // Utility function to convert decimal tonnage to fractional display
  const getTonnageLabel = (tonnage: number): string => {
    const integerPart = Math.floor(tonnage);
    const decimalPart = tonnage - integerPart;
    
    let fractionStr = '';
    if (Math.abs(decimalPart - 0.25) < 0.01) {
      fractionStr = '1/4';
    } else if (Math.abs(decimalPart - 0.5) < 0.01) {
      fractionStr = '1/2';
    } else if (Math.abs(decimalPart - 0.75) < 0.01) {
      fractionStr = '3/4';
    } else if (decimalPart > 0.01) {
      fractionStr = decimalPart.toFixed(2);
    }
    
    if (integerPart > 0) {
      return fractionStr ? `${integerPart} ${fractionStr} tonne${tonnage > 1 ? 's' : ''}` : `${integerPart} tonne${integerPart > 1 ? 's' : ''}`;
    } else {
      return fractionStr ? `${fractionStr} tonne` : `${tonnage.toFixed(2)} tonne${tonnage > 1 ? 's' : ''}`;
    }
  };

  // Convert tonnage to number of bars based on bars_per_ton (ROUNDED TO INTEGER)
  const tonnageToBarres = (tonnage: number, barsPerTon: number): number => {
    return Math.round(tonnage * barsPerTon); // Always return integer bars
  };

  // Utility function to round to 2 decimals (fixes floating point precision issues)
  const roundTo2Decimals = (value: number): number => {
    return Math.round(value * 100) / 100;
  };

  // Convert bars to tonnage for display
  const barresToTonnage = (barres: number, barsPerTon: number): number => {
    return barres / barsPerTon;
  };

  // Load company settings once on mount
  useEffect(() => {
    fetchCompanySettings();
  }, []);

  // Load authorized categories when user is available
  useEffect(() => {
    if (user?.id) {
      loadAuthorizedCategories();
    }
  }, [user?.id]);

  // Fetch products when authorized categories change + Realtime sync
  useEffect(() => {
    fetchProducts();
    
    // Écouter les changements en temps réel sur la table products
    const channel = supabase
      .channel('seller-products-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'products' },
        (payload) => {
          console.log('🔄 Stock updated (seller):', payload);
          fetchProducts();
        }
      )
      .subscribe();
    
    return () => {
      supabase.removeChannel(channel);
    };
  }, [authorizedCategories]);

  // Rafraîchissement périodique des produits (toutes les 30 secondes) pour sync multi-utilisateurs
  useEffect(() => {
    const interval = setInterval(() => {
      if (currentStep === 'products' && !isProcessing) {
        console.log('🔄 Rafraîchissement automatique des produits...');
        fetchProducts();
      }
    }, 30000);
    
    return () => clearInterval(interval);
  }, [currentStep, isProcessing, authorizedCategories]);

  const loadAuthorizedCategories = async () => {
    if (!user?.id) {
      console.log('⚠️ No user ID available yet');
      return; // Don't set anything, wait for user
    }
    
    try {
      console.log('🔍 Loading categories for user:', user.id);
      const { data, error } = await supabase
        .from('seller_authorized_categories')
        .select('category')
        .eq('user_id', user.id);

      if (error) throw error;
      
      if (data && data.length > 0) {
        // Seller has specific category restrictions
        setAuthorizedCategories(data.map(d => d.category));
      } else {
        // Seller has no restrictions = empty array (all categories)
        setAuthorizedCategories([]);
      }
    } catch (error) {
      console.error('Error loading authorized categories:', error);
      // Default to all categories on error
      setAuthorizedCategories([]);
    }
  };

  const fetchCompanySettings = async () => {
    try {
      const { data, error } = await supabase
        .from('company_settings')
        .select('*')
        .limit(1)
        .single();
      
      if (data) setCompanySettings(data);
    } catch (error) {
      console.error('Error fetching company settings:', error);
    }
  };

  // Sound effects for barcode scanning
  const { playScan, playError, playSuccess } = useInventorySounds();
  
  // Confetti animation for successful sales
  const { triggerConfetti } = useConfetti();

  // Barcode scan handler
  const handleBarcodeScan = useCallback((barcode: string) => {
    if (currentStep !== 'products') return;
    
    const product = products.find(p => p.barcode === barcode);
    if (product) {
      // Play success sound
      playScan();
      
      // Haptic vibration on mobile (short vibration for success)
      if ('vibrate' in navigator) {
        navigator.vibrate(50);
      }
      
      // Clear search field after successful scan
      setSearchTerm('');
      
      // For ceramics and iron, open quantity dialog
      if (product.category === 'ceramique' || product.category === 'fer') {
        setCustomQuantityDialog({ open: true, product });
        setQuantityUnit('barre');
      } else {
        // For other products, add directly to cart
        addToCart(product, 1);
      }
      toast({
        title: "Produit scanné",
        description: product.name,
      });
    } else {
      // Play error sound
      playError();
      
      // Haptic vibration on mobile (longer vibration for error)
      if ('vibrate' in navigator) {
        navigator.vibrate([100, 50, 100]);
      }
      
      toast({
        title: "Code-barres non reconnu",
        description: `Aucun produit trouvé avec le code: ${barcode}`,
        variant: "destructive"
      });
    }
  }, [products, currentStep]);

  // Enable barcode scanner when on products step
  useBarcodeScanner({
    onScan: handleBarcodeScan,
    enabled: currentStep === 'products' && !customQuantityDialog.open,
    minLength: 5,
    maxTimeBetweenKeys: 50
  });

  // Keyboard shortcuts: Ctrl+L toggle view, Ctrl+P go to cart, Escape go back, Ctrl+? help, Ctrl+N new sale
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if in input/textarea (except for shortcuts modal)
      const target = e.target as HTMLElement;
      const isInput = ['INPUT', 'TEXTAREA'].includes(target.tagName);
      
      // Ctrl+? or Ctrl+/ to show shortcuts help
      if (e.ctrlKey && (e.key === '?' || e.key === '/')) {
        e.preventDefault();
        setShowShortcutsHelp(prev => !prev);
        return;
      }
      
      // Ctrl+N for new sale (only on success step)
      if (e.ctrlKey && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        if (currentStep === 'success') {
          resetWorkflow();
        }
        return;
      }
      
      if (e.ctrlKey && e.key.toLowerCase() === 'l') {
        e.preventDefault();
        if (currentStep === 'products') {
          setViewMode(prev => prev === 'cards' ? 'list' : 'cards');
        }
      }
      if (e.ctrlKey && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        if (currentStep === 'products' && cart.length > 0) {
          handleStepChange('cart');
        }
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        if (showShortcutsHelp) {
          setShowShortcutsHelp(false);
        } else if (!isInput) {
          if (currentStep === 'cart') {
            handleStepChange('products');
          } else if (currentStep === 'checkout') {
            handleStepChange('cart');
          }
        }
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentStep, cart.length, showShortcutsHelp]);

  useEffect(() => {
    const filtered = products.filter(product => {
      // Match by name, category, OR barcode
      const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (product.barcode && product.barcode.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchesSaleType = saleTypeFilter === 'all' || product.sale_type === saleTypeFilter;
      
      // Dynamic category filter using categorie_id
      const matchesCategory = categoryFilter === 'all' || 
        (product as any).categorie_id === categoryFilter ||
        product.category === categoryFilter; // Fallback for old enum-based products
      
      // Dynamic sous-category filter
      const matchesSousCategory = sousCategoryFilter === 'all' || 
        (product as any).sous_categorie_id === sousCategoryFilter;
      
      return matchesSearch && matchesSaleType && matchesCategory && matchesSousCategory;
    });
    setFilteredProducts(filtered);
  }, [searchTerm, saleTypeFilter, categoryFilter, sousCategoryFilter, products]);

  const fetchProducts = async () => {
    try {
      let query = supabase
        .from('products')
        .select('*')
        .eq('is_active', true);
      
      // Filter by authorized categories if restrictions exist (non-empty array)
      if (authorizedCategories.length > 0) {
        query = query.in('category', authorizedCategories as any);
      }
      
      const { data, error } = await query.order('name');

      if (error) throw error;
      
      // Filter products with available stock and cast currency
      const availableProducts = (data || []).filter((product) => {
        let hasStock = false;
        
        if (product.category === 'ceramique') {
          hasStock = (product.stock_boite || 0) > 0;
          if (hasStock) {
            console.log('✅ Ceramique available:', product.name, 'stock_boite:', product.stock_boite);
          }
        } else if (product.category === 'fer') {
          hasStock = (product.stock_barre || 0) > 0;
        } else {
          hasStock = product.quantity > 0;
        }
        
        return hasStock;
      }).map(p => ({
        ...p,
        currency: (p.currency === 'USD' ? 'USD' : 'HTG') as 'USD' | 'HTG'
      }));
    
      const byCat = availableProducts.reduce((acc: any, p) => {
        acc[p.category] = (acc[p.category] || 0) + 1;
        return acc;
      }, {});
      console.log(byCat);
      
      setProducts(availableProducts as Product[]);
    } catch (error) {
      console.error('Error fetching products:', error);
      toast({
        title: "Erreur",
        description: "Impossible de charger les produits",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const addToCart = (product: Product, customQty?: number, inputUnit?: 'barre' | 'tonne') => {
    // For ceramics, open dialog to get m² needed
    if (product.category === 'ceramique' && !customQty) {
      setCustomQuantityDialog({open: true, product});
      setQuantityUnit('barre'); // Reset unit
      return;
    }

    // For iron bars, open dialog if no custom quantity provided
    if (product.category === 'fer' && !customQty) {
      setCustomQuantityDialog({open: true, product});
      setQuantityUnit('barre'); // Default to barre
      return;
    }

    let quantityToAdd = customQty || 1;
    let actualPrice = product.price;
    let displayUnit = product.unit;
    let sourceUnit: 'barre' | 'tonne' | undefined;
    let sourceValue: number | undefined;

    // Calculate for ceramics - keep exact decimal quantities
    if (product.category === 'ceramique' && product.surface_par_boite && product.prix_m2) {
      const surfaceNeeded = customQty || 0;
      quantityToAdd = surfaceNeeded; // Store m² directly in cartQuantity
      actualPrice = surfaceNeeded * product.prix_m2; // Price based on exact surface needed
      displayUnit = 'm²';
    }

    // Calculate for iron bars - handle BOTH barre and tonne inputs
    if (product.category === 'fer' && product.prix_par_barre) {
      if (inputUnit === 'tonne') {
        // User selected tonnage input
        if (!product.bars_per_ton) {
          toast({
            title: "Configuration manquante",
            description: "Barres/tonne non défini pour ce diamètre. Impossible d'utiliser l'unité tonne.",
            variant: "destructive"
          });
          return;
        }
        const tonnageInput = customQty || 0;
        quantityToAdd = tonnageToBarres(tonnageInput, product.bars_per_ton); // Convert to INTEGER bars
        actualPrice = product.prix_par_barre * quantityToAdd; // Price per bar * number of bars
        displayUnit = 'barre'; // Standardize display unit
        sourceUnit = 'tonne';
        sourceValue = tonnageInput;
      } else {
        // User selected barres input (default)
        quantityToAdd = Math.max(1, Math.round(customQty || 1)); // Ensure integer
        actualPrice = product.prix_par_barre * quantityToAdd;
        displayUnit = 'barre';
        sourceUnit = 'barre';
        sourceValue = quantityToAdd;
      }
    }
    
    // Calculate for vêtements - standard pricing
    if (product.category === 'vetements') {
      quantityToAdd = customQty || 1;
      actualPrice = product.price * quantityToAdd;
      displayUnit = product.unit;
    }
    // Calculate for all other categories (électroménager, blocs, énergie, etc.)
    else if (product.category !== 'ceramique' && product.category !== 'fer') {
      quantityToAdd = customQty || 1;
      actualPrice = product.price * quantityToAdd;
      displayUnit = product.unit;
    }

    // Get available stock based on category (stock_boite is in BOXES, multiply by surface_par_boite to get m²)
    const availableStock = product.category === 'ceramique' 
                          ? roundTo2Decimals((product.stock_boite || 0) * (product.surface_par_boite || 1))
                          : product.category === 'fer' 
                            ? (product.stock_barre || 0) 
                            : product.quantity;

    // For iron, validate against stock in bars
    if (product.category === 'fer' && quantityToAdd > availableStock) {
      toast({
        title: "Stock insuffisant",
        description: `Stock disponible: ${availableStock} barres`,
        variant: "destructive"
      });
      return;
    }

    setCart(prevCart => {
      const existingItem = prevCart.find(item => item.id === product.id);
      
      if (existingItem) {
        const newCartQuantity = existingItem.cartQuantity + quantityToAdd;
        
        if (newCartQuantity > availableStock) {
          toast({
            title: "Stock insuffisant",
            description: `Stock disponible : ${availableStock} ${product.category === 'fer' ? 'barres' : displayUnit}`,
            variant: "destructive"
          });
          return prevCart;
        }
        
        return prevCart.map(item =>
          item.id === product.id
            ? { 
                ...item, 
                cartQuantity: newCartQuantity, 
                actualPrice: product.category === 'ceramique' && product.prix_m2
                  ? product.prix_m2 * newCartQuantity
                  : product.category === 'fer' && product.prix_par_barre 
                    ? product.prix_par_barre * newCartQuantity
                    : product.price * newCartQuantity,
                displayUnit,
                sourceUnit,
                sourceValue
              }
            : item
        );
      } else {
        // Validate stock for new items
        if (quantityToAdd > availableStock) {
          toast({
            title: "Stock insuffisant",
            description: `Quantité demandée : ${quantityToAdd}\nStock disponible : ${availableStock} ${product.category === 'fer' ? 'barres' : displayUnit}`,
            variant: "destructive"
          });
          return prevCart;
        }
        
        return [...prevCart, { 
          ...product, 
          cartQuantity: quantityToAdd,
          actualPrice,
          displayUnit,
          sourceUnit,
          sourceValue
        }];
      }
    });

    // Trigger pulse animation on cart button
    setCartPulse(true);
    setTimeout(() => setCartPulse(false), 600);

    setCustomQuantityDialog({open: false, product: null});
    setCustomQuantityValue('');
    setQuantityUnit('barre'); // Reset to default
  };

  const handleCustomQuantitySubmit = () => {
    const product = customQuantityDialog.product;
    if (!product || !customQuantityValue) return;

    const qty = parseFloat(customQuantityValue);
    if (isNaN(qty) || qty <= 0) {
      toast({
        title: "Quantité invalide",
        description: "Veuillez entrer une quantité valide",
        variant: "destructive"
      });
      return;
    }

    // Pass the selected unit for iron products
    if (product.category === 'fer') {
      addToCart(product, qty, quantityUnit);
    } else {
      addToCart(product, qty);
    }
  };

  const removeFromCart = (productId: string) => {
    setCart(prevCart => prevCart.filter(item => item.id !== productId));
    toast({
      title: "Article retiré",
      description: "L'article a été supprimé du panier",
    });
  };

  const handleDirectQuantityChange = (productId: string, newValue: string) => {
    setCart(prevCart => {
      const item = prevCart.find(i => i.id === productId);
      if (!item) return prevCart;
      
      // Use parseFloat for ceramics (m²), parseInt for others
      const newQty = item.category === 'ceramique' 
        ? parseFloat(newValue) || 0 
        : parseInt(newValue) || 0;
      
      // Validation minimum
      if (newQty < 0.01) {
        toast({
          title: "Quantité invalide",
          description: "La quantité doit être supérieure à 0",
          variant: "destructive"
        });
        return prevCart;
      }
      
      return prevCart.map(cartItem => {
        if (cartItem.id !== productId) return cartItem;
        
        // Déterminer le stock disponible selon la catégorie (stock_boite en BOÎTES × surface_par_boite = m²)
        let availableStock: number;
        if (cartItem.category === 'ceramique') {
          availableStock = roundTo2Decimals((cartItem.stock_boite || 0) * (cartItem.surface_par_boite || 1));
        } else if (cartItem.category === 'fer') {
          availableStock = cartItem.stock_barre || 0;
        } else {
          availableStock = cartItem.quantity;
        }
        
        // Vérifier si la quantité demandée est disponible
        if (newQty > availableStock) {
          toast({
            title: "Stock insuffisant",
            description: cartItem.category === 'ceramique' 
              ? `Stock disponible : ${availableStock.toFixed(2)} m²`
              : `Stock disponible : ${availableStock} ${cartItem.unit}`,
            variant: "destructive"
          });
          return cartItem; // Ne pas modifier
        }
        
        // Calculer le nouveau prix selon la catégorie
        let actualPrice: number;
        
        if (item.category === 'ceramique') {
          actualPrice = (item.prix_m2 || item.price) * newQty;
        } else if (item.category === 'fer') {
          actualPrice = (item.prix_par_barre || item.price) * newQty;
        } else {
          actualPrice = item.price * newQty;
        }
        
        return {
          ...item,
          cartQuantity: newQty,
          actualPrice: actualPrice
        };
      });
    });
  };

  const updateQuantity = (productId: string, change: number) => {
    setCart(prevCart => {
      return prevCart.map(item => {
        if (item.id === productId) {
          // For ceramics, prevent direct +/- as quantity is in m² - user should re-enter surface
          if (item.category === 'ceramique') {
            toast({
              title: "Modification non autorisée",
              description: "Pour les céramiques, veuillez supprimer et ajouter à nouveau avec la surface correcte",
              variant: "destructive"
            });
            return item;
          }
          
          const newQuantity = Math.max(0, item.cartQuantity + change);
          if (newQuantity === 0) {
            return null; // Will be filtered out
          }
          
          // Check stock availability based on category
          const availableStock = item.category === 'fer' ? (item.stock_barre || 0) : item.quantity;
          
          if (newQuantity > availableStock) {
            toast({
              title: "Stock insuffisant",
              description: `Stock disponible : ${availableStock}`,
              variant: "destructive"
            });
            return item;
          }
          
          // Recalculate price and display unit based on category
          let actualPrice = item.price * newQuantity;
          let displayUnit = item.unit;
          
          // Recalculate for iron bars (always work with integer bars)
          if (item.category === 'fer' && item.prix_par_barre) {
            actualPrice = item.prix_par_barre * newQuantity;
            displayUnit = 'barre';
          }
          
          // Recalculate for clothing - standard pricing
          else if (item.category === 'vetements') {
            actualPrice = item.price * newQuantity;
            displayUnit = item.unit;
          }
          
          return { ...item, cartQuantity: newQuantity, actualPrice, displayUnit };
        }
        return item;
      }).filter(Boolean) as CartItem[];
    });
  };

  const getTotalAmount = () => {
    return cart.reduce((total, item) => {
      const price = item.actualPrice !== undefined ? item.actualPrice : (item.price * item.cartQuantity);
      return total + price;
    }, 0);
  };

  const getSubtotal = () => {
    return getTotalAmount();
  };

  // Get totals by currency
  const getTotalsByCurrency = () => {
    let totalUSD = 0;
    let totalHTG = 0;
    
    cart.forEach(item => {
      const price = item.actualPrice !== undefined ? item.actualPrice : (item.price * item.cartQuantity);
      if (item.currency === 'USD') {
        totalUSD += price;
      } else {
        totalHTG += price;
      }
    });
    
    return { totalUSD, totalHTG };
  };

  // Calculate unified total in preferred currency (before discount) using centralized hook
  const getUnifiedTotal = () => {
    if (!currencyCalc) {
      // Fallback if hook not ready
      const { totalUSD, totalHTG } = getTotalsByCurrency();
      const rate = companySettings?.usd_htg_rate || 132;
      const displayCurrency = companySettings?.default_display_currency || 'HTG';
      
      if (displayCurrency === 'HTG') {
        return { amount: totalHTG + (totalUSD * rate), currency: 'HTG' as const };
      } else {
        return { amount: totalUSD + (totalHTG / rate), currency: 'USD' as const };
      }
    }
    
    // Convert cart items to SaleItemForCalc format
    const saleItems = cart.map(item => ({
      subtotal: item.actualPrice !== undefined ? item.actualPrice : (item.price * item.cartQuantity),
      currency: (item.currency || 'HTG') as 'USD' | 'HTG',
      profit_amount: 0
    }));
    
    const result = currencyCalc.calculateUnifiedSubtotal(saleItems);
    return { amount: result.unified, currency: result.displayCurrency };
  };

  // Calculate unified total WITH discount AND TVA applied (final TTC amount to pay)
  const getUnifiedFinalTotal = () => {
    if (!currencyCalc) {
      // Fallback calculation
      const { totalUSD, totalHTG } = getTotalsByCurrency();
      const rate = companySettings?.usd_htg_rate || 132;
      const displayCurrency = companySettings?.default_display_currency || 'HTG';
      const discountAmount = getDiscountAmount();
      const tvaRate = companySettings?.tva_rate || 0;
      
      if (displayCurrency === 'HTG') {
        const unifiedHTG = totalHTG + (totalUSD * rate);
        const afterDiscount = Math.max(0, unifiedHTG - discountAmount);
        const tva = afterDiscount * (tvaRate / 100);
        return { amount: afterDiscount + tva, currency: 'HTG' as const };
      } else {
        const unifiedUSD = totalUSD + (totalHTG / rate);
        const rate2 = companySettings?.usd_htg_rate || 132;
        const discountInUSD = discountAmount / rate2;
        const afterDiscount = Math.max(0, unifiedUSD - discountInUSD);
        const tva = afterDiscount * (tvaRate / 100);
        return { amount: afterDiscount + tva, currency: 'USD' as const };
      }
    }
    
    // Use centralized hook for calculation
    const saleItems = cart.map(item => ({
      subtotal: item.actualPrice !== undefined ? item.actualPrice : (item.price * item.cartQuantity),
      currency: (item.currency || 'HTG') as 'USD' | 'HTG',
      profit_amount: 0
    }));
    
    // Calculate actual discount amount based on type
    const discVal = parseFloat(discountValue) || 0;
    const unifiedSubtotal = currencyCalc.calculateUnifiedSubtotal(saleItems).unified;
    const actualDiscountAmount = discountType === 'percentage'
      ? Math.min(unifiedSubtotal * (discVal / 100), unifiedSubtotal)
      : Math.min(discVal, unifiedSubtotal);
    
    const result = currencyCalc.calculateTotalTTC({
      items: saleItems,
      discountAmount: actualDiscountAmount
    });
    
    return { amount: result.totalTTC, currency: result.currency };
  };

  // Calculate discount amount based on UNIFIED total (properly converted)
  const getDiscountAmount = () => {
    const { amount: unifiedSubtotal } = getUnifiedTotal();
    const discVal = parseFloat(discountValue) || 0;
    
    if (discountType === 'percentage') {
      // Percentage of the unified total
      return Math.min(unifiedSubtotal * (discVal / 100), unifiedSubtotal);
    } else if (discountType === 'amount') {
      // Fixed amount - user enters in display currency
      return Math.min(discVal, unifiedSubtotal);
    }
    return 0;
  };

  // Validate discount value and return error message if invalid
  const validateDiscount = (value: string, type: 'percentage' | 'amount' | 'none'): string | null => {
    if (type === 'none') return null;
    
    const { amount: unifiedSubtotal } = getUnifiedTotal();
    const discVal = parseFloat(value) || 0;
    const displayCurrency = companySettings?.default_display_currency || 'HTG';
    
    if (discVal < 0) {
      return 'La valeur doit être positive';
    }
    
    if (type === 'percentage') {
      if (discVal > 100) {
        return 'Le pourcentage ne peut pas dépasser 100%';
      }
    } else if (type === 'amount') {
      if (discVal > unifiedSubtotal) {
        return `La remise ne peut pas dépasser ${formatAmount(unifiedSubtotal, displayCurrency)}`;
      }
    }
    return null;
  };

  // Handler for discount value change with validation
  const handleDiscountValueChange = (value: string) => {
    setDiscountValue(value);
    const error = validateDiscount(value, discountType);
    setDiscountError(error);
  };

  // Handler for discount type change with validation
  const handleDiscountTypeChange = (type: 'none' | 'percentage' | 'amount') => {
    setDiscountType(type);
    if (type === 'none') {
      setDiscountValue('0');
      setDiscountError(null);
    } else {
      const error = validateDiscount(discountValue, type);
      setDiscountError(error);
    }
  };

  const getFinalTotal = () => {
    return Math.max(0, getSubtotal() - getDiscountAmount());
  };

  const processSale = async () => {
    if (!user || cart.length === 0) return;

    setIsProcessing(true);

    try {
      // Use unified total (properly converted to display currency) for all calculations
      const { amount: unifiedSubtotal, currency: displayCurrency } = getUnifiedTotal();
      const discountAmount = getDiscountAmount();
      const afterDiscount = Math.max(0, unifiedSubtotal - discountAmount);
      const tvaRate = companySettings?.tva_rate || 0;
      const tvaAmount = afterDiscount * (tvaRate / 100);
      const totalAmount = afterDiscount + tvaAmount;  // Total TTC in display currency

      // === VALIDATION EN TEMPS RÉEL DU STOCK ===
      // Récupérer les données fraîches de la base pour tous les produits du panier
      const productIds = cart.map(item => item.id);
      const { data: freshProducts, error: fetchError } = await supabase
        .from('products')
        .select('id, name, category, stock_boite, surface_par_boite, stock_barre, quantity')
        .in('id', productIds);

      if (fetchError) {
        throw new Error(`Erreur de vérification du stock: ${fetchError.message}`);
      }

      // Créer une map pour accès rapide
      const freshProductMap = new Map(freshProducts?.map(p => [p.id, p]) || []);

      // Valider le stock en temps réel pour chaque article
      const stockErrors: string[] = [];
      
      for (const cartItem of cart) {
        const freshProduct = freshProductMap.get(cartItem.id);
        
        if (!freshProduct) {
          stockErrors.push(`${cartItem.name}: produit introuvable`);
          continue;
        }

        if (cartItem.category === 'ceramique') {
          const stockActuelM2 = roundTo2Decimals(
            (freshProduct.stock_boite || 0) * (freshProduct.surface_par_boite || 1)
          );
          
          if (cartItem.cartQuantity > stockActuelM2) {
            stockErrors.push(`${cartItem.name}: Stock actuel ${stockActuelM2} m², demandé ${cartItem.cartQuantity} m²`);
          }
          
          console.log(`🔍 Validation temps réel "${cartItem.name}": DB=${stockActuelM2} m², Panier=${cartItem.cartQuantity} m²`);
        } else if (cartItem.category === 'fer') {
          const stockActuelBarres = freshProduct.stock_barre || 0;
          
          if (cartItem.cartQuantity > stockActuelBarres) {
            stockErrors.push(`${cartItem.name}: Stock actuel ${stockActuelBarres} barres, demandé ${cartItem.cartQuantity} barres`);
          }
        } else {
          const stockActuel = freshProduct.quantity || 0;
          
          if (cartItem.cartQuantity > stockActuel) {
            stockErrors.push(`${cartItem.name}: Stock actuel ${stockActuel}, demandé ${cartItem.cartQuantity}`);
          }
        }
      }

      if (stockErrors.length > 0) {
        throw new Error(`Stock insuffisant:\n${stockErrors.join('\n')}`);
      }

      console.log('✅ Validation temps réel du stock passée:', {
        itemCount: cart.length,
        totalAmount: totalAmount,
        hasDiscount: discountType !== 'none'
      });

      // Prepare sale data for Edge Function
      const saleRequest = {
        customer_name: customerName.trim() || null,
        customer_address: customerAddress.trim() ? customerAddress.trim() : null,
        payment_method: paymentMethod,
        subtotal: unifiedSubtotal,
        discount_type: discountType,
        discount_value: parseFloat(discountValue) || 0,
        discount_amount: discountAmount,
        discount_currency: displayCurrency,
        total_amount: totalAmount,
        items: cart.map(item => {
          // Pour les céramiques : envoyer directement les m² (pas de conversion en boîtes)
          let quantityToSend = item.cartQuantity;
          if (item.category === 'ceramique') {
            console.log(`🔄 Céramique: envoi de ${quantityToSend} m² directement (pas de conversion)`);
          }
          
          return {
            product_id: item.id,
            product_name: item.name,
            quantity: quantityToSend, // En m² pour céramique, sinon quantité normale
            unit: item.category === 'fer' ? 'barre' : (item.category === 'ceramique' ? 'm²' : (item.displayUnit || item.unit)),
            unit_price: item.actualPrice !== undefined ? item.actualPrice / item.cartQuantity : item.price,
            subtotal: item.actualPrice !== undefined ? item.actualPrice : (item.price * item.cartQuantity),
            currency: item.currency || 'HTG'
          };
        })
      };

      console.log('📦 Sale payload:', JSON.stringify(saleRequest, null, 2));

      // Get the current session to pass auth token
      let { data: { session } } = await supabase.auth.getSession();
      
      // If session is missing or expired, try to refresh
      if (!session) {
        console.log('🔄 Session manquante, tentative de rafraîchissement...');
        const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
        
        if (refreshError || !refreshData.session) {
          console.error('❌ Impossible de rafraîchir la session:', refreshError);
          toast({
            title: "Session expirée",
            description: "Redirection vers la page de connexion...",
            variant: "destructive"
          });
          // Redirect to auth page after a short delay
          setTimeout(() => {
            window.location.href = '/auth';
          }, 1500);
          return;
        }
        session = refreshData.session;
        console.log('✅ Session rafraîchie avec succès');
      }

      // Call Edge Function to process sale with auth header
      const { data, error } = await supabase.functions.invoke('process-sale', {
        body: saleRequest,
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      });

      if (error) {
        console.error('🔴 Edge Function Error Details:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        });
        throw new Error(`Erreur serveur (${error.code || 'UNKNOWN'}): ${error.message || 'Service temporairement indisponible. Réessayez dans quelques instants.'}`);
      }
      
      if (!data.success) {
        throw new Error(data.error || 'Échec du traitement de la vente');
      }

      toast({
        title: "Vente enregistrée",
        description: `Vente de ${formatAmount(totalAmount)} enregistrée avec succès`,
      });

      handleStepChange('success');
      triggerConfetti();
      playSuccess();
      
      // Store calculated values for consistent display on success page
      setCompletedSale({
        ...data.sale,
        payment_method: paymentMethod,
        customer_address: customerAddress.trim() || null,
        // Store calculated values to avoid recalculation issues
        calculated_total: totalAmount,
        calculated_discount: discountAmount,
        calculated_subtotal: unifiedSubtotal,
        calculated_currency: displayCurrency,
        items: cart.map(item => {
          const itemTotal = item.actualPrice !== undefined ? item.actualPrice : (item.price * item.cartQuantity);
          const unitPrice = item.actualPrice !== undefined ? (item.actualPrice / item.cartQuantity) : item.price;
          return {
            name: item.name,
            quantity: item.cartQuantity,
            unit: item.displayUnit || item.unit,
            dimension: item.dimension,
            diametre: item.diametre,
            unit_price: unitPrice,
            total: itemTotal,
            currency: item.currency
          };
        })
      });
      
      // Refresh products
      fetchProducts();
      
      // Call parent callback
      onSaleComplete?.();

    } catch (error) {
      console.error('🔴 Erreur détaillée lors du traitement de la vente:', error);
      console.error('🔴 Stack trace:', error instanceof Error ? error.stack : 'N/A');
      console.error('🔴 Cart contents:', JSON.stringify(cart, null, 2));
      
      let errorTitle = "❌ Échec de la vente";
      let errorDescription = "";
      
      if (error instanceof Error) {
        const errorMsg = error.message.toLowerCase();
        
        // Quantité invalide (22P02 error)
        if (errorMsg.includes('22p02') || errorMsg.includes('invalid input syntax for type integer')) {
          errorTitle = "❌ Quantité invalide";
          errorDescription = "Quantité invalide (décimale) détectée. Les barres doivent être entières. Utilisez les boutons tonne: ils arrondissent automatiquement au nombre de barres.";
        }
        // Stock insuffisant
        else if (errorMsg.includes('stock') || errorMsg.includes('insufficient')) {
          errorTitle = "❌ Stock insuffisant";
          errorDescription = `Un ou plusieurs produits n'ont pas assez de stock disponible.\n\nDétails: ${error.message}`;
        } 
        // Problème de session/authentification
        else if (errorMsg.includes('session') || errorMsg.includes('auth') || errorMsg.includes('token')) {
          errorTitle = "🔐 Erreur d'authentification";
          errorDescription = `Votre session a expiré. Veuillez vous reconnecter et réessayer.\n\nDétails: ${error.message}`;
        } 
        // Problème réseau
        else if (errorMsg.includes('network') || errorMsg.includes('fetch') || errorMsg.includes('connection')) {
          errorTitle = "🌐 Problème de connexion";
          errorDescription = `Impossible de contacter le serveur. Vérifiez votre connexion internet.\n\nDétails: ${error.message}`;
        }
        // Erreur serveur
        else if (errorMsg.includes('serveur') || errorMsg.includes('server') || errorMsg.includes('service')) {
          errorTitle = "⚠️ Erreur serveur";
          errorDescription = `Le serveur a rencontré une erreur lors du traitement.\n\nDétails: ${error.message}\n\nVeuillez réessayer dans quelques instants.`;
        }
        // Erreur inconnue
        else {
          errorTitle = "❌ Erreur inattendue";
          errorDescription = `Une erreur s'est produite lors de l'enregistrement de la vente.\n\n📋 Détails techniques:\n${error.message}\n\n💡 Suggestion: Vérifiez les logs de la console (F12) pour plus d'informations.`;
        }
      } else {
        errorDescription = "Erreur inconnue. Contactez le support technique.";
      }
      
      toast({
        title: errorTitle,
        description: errorDescription,
        variant: "destructive",
        duration: 8000, // 8 secondes pour lire
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const resetWorkflow = () => {
    handleStepChange('products');
    setCart([]);
    setCustomerName('');
    setCustomerAddress('');
    setSearchTerm('');
    setSaleTypeFilter('all');
    setCategoryFilter('all');
    setDiscountType('none');
    setDiscountValue('0');
    setPaymentMethod('espece');
    setCompletedSale(null);
    onSaleComplete?.();
  };

  const printReceipt58mm = async () => {
    if (!completedSale || !companySettings) return;
    
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('user_id', user?.id)
      .single();
    
    generateReceipt(
      completedSale,
      companySettings,
      cart,
      profile?.full_name || 'Vendeur',
      58
    );
  };

  const printReceipt80mm = async () => {
    if (!completedSale || !companySettings) return;
    
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('user_id', user?.id)
      .single();
    
    generateReceipt(
      completedSale,
      companySettings,
      cart,
      profile?.full_name || 'Vendeur',
      80
    );
  };

  const printInvoice = async () => {
    if (!completedSale || !companySettings) return;
    
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('user_id', user?.id)
      .single();
    
    generateInvoice(
      completedSale,
      companySettings,
      cart,
      profile?.full_name || 'Vendeur'
    );
  };

  const categories = [
    { value: 'alimentaires', label: 'Alimentaires' },
    { value: 'boissons', label: 'Boissons' },
    { value: 'gazeuses', label: 'Gazeuses' },
    { value: 'electronique', label: 'Électronique' },
    { value: 'ceramique', label: 'Céramique' },
    { value: 'fer', label: 'Fer / Acier' },
    { value: 'materiaux_de_construction', label: 'Matériaux de construction' },
    { value: 'energie', label: 'Énergie' },
    { value: 'blocs', label: 'Blocs' },
    { value: 'vetements', label: 'Vêtements' },
    { value: 'electromenager', label: 'Électroménager' },
    { value: 'autres', label: 'Autres' }
  ];

  // Liste dynamique des catégories disponibles avec produits
  const availableCategories = useMemo(() => {
    let categoriesWithProducts = new Set(products.map(p => p.category));
    
    // Filter by authorized categories if restrictions exist (non-empty array)
    const hasRestrictions = authorizedCategories.length > 0;
    if (hasRestrictions) {
      categoriesWithProducts = new Set(
        Array.from(categoriesWithProducts).filter(cat => 
          authorizedCategories.includes(cat)
        )
      );
    }
    
    return [
      { value: 'all', label: 'Toutes les catégories' },
      ...categories.filter(cat => categoriesWithProducts.has(cat.value))
    ];
  }, [products, authorizedCategories]);

  const steps = [
    { id: 'products', label: 'Sélection Produits', icon: Package },
    { id: 'cart', label: 'Panier', icon: ShoppingCart },
    { id: 'checkout', label: 'Finalisation', icon: Receipt },
    { id: 'success', label: 'Confirmation', icon: CheckCircle }
  ];

  const getCurrentStepIndex = () => steps.findIndex(step => step.id === currentStep);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Package className="w-8 h-8 text-primary animate-pulse" />
        <span className="ml-2 text-muted-foreground">Chargement...</span>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Workflow Progress - Compact */}
      <Card className="shadow-lg">
        <CardContent className="p-2 sm:p-3">
          <div className="flex items-center justify-between gap-2">
            {/* Help button */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowShortcutsHelp(true)}
              className="h-8 w-8 p-0 shrink-0"
              title="Raccourcis clavier (Ctrl+?)"
            >
              <Keyboard className="w-4 h-4" />
            </Button>
            {steps.map((step, index) => {
              const StepIcon = step.icon;
              const isActive = step.id === currentStep;
              const isCompleted = index < getCurrentStepIndex();
              
              return (
                <div key={step.id} className="flex items-center">
                  <div
                    className={`flex items-center justify-center w-8 h-8 rounded-full border-2 transition-all duration-500 ease-out ${
                      isActive
                        ? 'border-primary bg-primary text-primary-foreground scale-110'
                        : isCompleted
                        ? 'border-success bg-success text-success-foreground'
                        : 'border-muted-foreground text-muted-foreground'
                    }`}
                  >
                    <StepIcon className={`w-4 h-4 transition-transform duration-300 ${isActive ? 'scale-110' : ''}`} />
                  </div>
                  <span className={`hidden sm:block ml-2 text-xs font-medium transition-all duration-300 ${isActive ? 'text-primary scale-105' : isCompleted ? 'text-success' : 'text-muted-foreground'}`}>
                    {step.label}
                  </span>
                  {index < steps.length - 1 && (
                    <ArrowRight className="hidden sm:block w-4 h-4 mx-2 text-muted-foreground" />
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Step Content */}
      {currentStep === 'products' && (
        <Card className={`shadow-lg flex flex-col h-[calc(100vh-120px)] min-h-[600px] ${getStepAnimationClass()}`}>
          <CardHeader className="pb-2 space-y-2 shrink-0">
            <CardTitle className="flex items-center gap-2 text-base">
              <Package className="w-4 h-4" />
              Sélection des Produits
            </CardTitle>
            <div className="space-y-2">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Rechercher ou scanner un code-barres..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 pr-24 h-9"
                  data-barcode-input="true"
                />
                <Badge 
                  variant="outline" 
                  className="absolute right-2 top-1.5 text-xs bg-primary/10 text-primary border-primary/30"
                >
                  <Barcode className="w-3 h-3 mr-1" />
                  Scanner prêt
                </Badge>
              </div>
              
              {/* Tous les filtres sur une seule ligne */}
              <div className="flex flex-wrap items-center gap-2 py-1">
                {/* Boutons type de vente */}
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant={saleTypeFilter === 'all' ? 'default' : 'outline'}
                    onClick={() => setSaleTypeFilter('all')}
                    className="h-8"
                  >
                    Tous
                  </Button>
                  <Button
                    size="sm"
                    variant={saleTypeFilter === 'retail' ? 'default' : 'outline'}
                    onClick={() => setSaleTypeFilter('retail')}
                    className="h-8"
                  >
                    Détail
                  </Button>
                  <Button
                    size="sm"
                    variant={saleTypeFilter === 'wholesale' ? 'default' : 'outline'}
                    onClick={() => setSaleTypeFilter('wholesale')}
                    className="h-8"
                  >
                    Gros
                  </Button>
                </div>
                
                {/* Séparateur vertical */}
                <div className="h-6 w-px bg-border mx-1 hidden sm:block" />
                
                {/* Dropdown Catégorie */}
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="w-[140px] h-8">
                    <SelectValue placeholder="Catégorie" />
                  </SelectTrigger>
                  <SelectContent className="z-50 bg-popover">
                    {availableDynamicCategories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.nom}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                {/* Dropdown Sous-catégorie */}
                <Select value={sousCategoryFilter} onValueChange={setSousCategoryFilter}>
                  <SelectTrigger className="w-[150px] h-8">
                    <SelectValue placeholder="Sous-catégorie" />
                  </SelectTrigger>
                  <SelectContent className="z-50 bg-popover">
                    {availableSousCategories.map((sc) => (
                      <SelectItem key={sc.id} value={sc.id}>
                        {sc.nom}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="flex justify-between items-center px-1">
                <Badge variant="secondary" className="text-sm">
                  {filteredProducts.length} produit{filteredProducts.length > 1 ? 's' : ''}
                </Badge>
                
                {/* View mode toggle with shortcut hint */}
                <div className="flex items-center gap-2">
                  <div className="flex gap-1 bg-muted p-0.5 rounded-lg">
                    <Button
                      size="sm"
                      variant={viewMode === 'cards' ? 'default' : 'ghost'}
                      onClick={() => setViewMode('cards')}
                      className="h-7 px-2"
                    >
                      <Grid3X3 className="w-3.5 h-3.5 mr-1" />
                      <span className="hidden sm:inline text-xs">Cartes</span>
                    </Button>
                    <Button
                      size="sm"
                      variant={viewMode === 'list' ? 'default' : 'ghost'}
                      onClick={() => setViewMode('list')}
                      className="h-7 px-2"
                    >
                      <List className="w-3.5 h-3.5 mr-1" />
                      <span className="hidden sm:inline text-xs">Liste</span>
                    </Button>
                  </div>
                  <span className="hidden lg:inline text-xs text-muted-foreground">Ctrl+L</span>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex-1 pb-4 flex flex-col min-h-0">
            {viewMode === 'cards' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 flex-1 overflow-y-auto min-h-0">
              {filteredProducts.map((product) => {
                const cartItem = cart.find(item => item.id === product.id);
                let availableStock = product.quantity;
                let stockLabel = product.unit;
                
                // For ceramics, stock_boite is in BOXES - multiply by surface_par_boite to get m²
                if (product.category === 'ceramique' && product.stock_boite !== undefined) {
                  const totalM2 = roundTo2Decimals((product.stock_boite || 0) * (product.surface_par_boite || 1));
                  const cartQuantityM2 = cartItem?.cartQuantity || 0;
                  const surfaceDisponible = roundTo2Decimals(Math.max(0, totalM2 - cartQuantityM2));
                  availableStock = surfaceDisponible;
                  stockLabel = 'm²';
                }
                
                // For iron bars
                if (product.category === 'fer' && product.stock_barre !== undefined) {
                  availableStock = product.stock_barre;
                  stockLabel = 'barres';
                }
                
                const cartQuantity = cartItem?.cartQuantity || 0;
                // For ceramics, convert boxes to m² then subtract cart quantity
                const remainingStock = product.category === 'ceramique'
                  ? roundTo2Decimals((product.stock_boite || 0) * (product.surface_par_boite || 1) - cartQuantity)
                  : availableStock - cartQuantity;
                
                return (
                  <Card 
                    key={product.id} 
                    className="border hover:shadow-xl hover:scale-[1.02] hover:border-primary/50 transition-all duration-300 cursor-pointer group"
                  >
                    <CardContent className="p-4">
                      <div className="space-y-3">
                        <div>
                          <h4 className="font-semibold text-base">{product.name}</h4>
                          
                          {/* Product specifications as horizontal colored badges */}
                          <div className="flex flex-wrap gap-1 mt-2">
                            {/* Ceramic specs */}
                            {product.category === 'ceramique' && (
                              <>
                                {product.dimension && (
                                  <Badge variant="outline" className="text-[10px] bg-blue-500/10 text-blue-600 border-blue-500/30">
                                    📐 {product.dimension}
                                  </Badge>
                                )}
                                {product.surface_par_boite && (
                                  <Badge variant="outline" className="text-[10px] bg-cyan-500/10 text-cyan-600 border-cyan-500/30">
                                    📦 {product.surface_par_boite} m²/boîte
                                  </Badge>
                                )}
                              </>
                            )}
                            
                            {/* Iron bar specs */}
                            {product.category === 'fer' && (
                              <>
                                {product.diametre && (
                                  <Badge variant="outline" className="text-[10px] bg-orange-500/10 text-orange-600 border-orange-500/30">
                                    ⭕ {product.diametre}
                                  </Badge>
                                )}
                                {product.longueur_barre_ft && (
                                  <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-600 border-amber-500/30">
                                    📏 {product.longueur_barre_ft} ft
                                  </Badge>
                                )}
                              </>
                            )}
                            
                            {/* Energy specs */}
                            {product.category === 'energie' && (
                              <>
                                {product.type_energie && (
                                  <Badge variant="outline" className="text-[10px] bg-yellow-500/10 text-yellow-600 border-yellow-500/30">
                                    ⚡ {product.type_energie}
                                  </Badge>
                                )}
                                {product.puissance && (
                                  <Badge variant="outline" className="text-[10px] bg-red-500/10 text-red-600 border-red-500/30">
                                    💪 {product.puissance}W
                                  </Badge>
                                )}
                                {product.voltage && (
                                  <Badge variant="outline" className="text-[10px] bg-purple-500/10 text-purple-600 border-purple-500/30">
                                    🔌 {product.voltage}V
                                  </Badge>
                                )}
                                {product.capacite && (
                                  <Badge variant="outline" className="text-[10px] bg-green-500/10 text-green-600 border-green-500/30">
                                    🔋 {product.capacite}Ah
                                  </Badge>
                                )}
                              </>
                            )}

                            {/* Blocs specs */}
                            {product.category === 'blocs' && (
                              <>
                                {product.bloc_type && (
                                  <Badge variant="outline" className="text-[10px] bg-stone-500/10 text-stone-600 border-stone-500/30">
                                    🧱 {product.bloc_type}
                                  </Badge>
                                )}
                                {product.bloc_poids && (
                                  <Badge variant="outline" className="text-[10px] bg-gray-500/10 text-gray-600 border-gray-500/30">
                                    ⚖️ {product.bloc_poids} kg
                                  </Badge>
                                )}
                              </>
                            )}

                            {/* Vêtements specs */}
                            {product.category === 'vetements' && (
                              <>
                                {product.vetement_taille && (
                                  <Badge variant="outline" className="text-[10px] bg-pink-500/10 text-pink-600 border-pink-500/30">
                                    📏 {product.vetement_taille}
                                  </Badge>
                                )}
                                {product.vetement_genre && (
                                  <Badge variant="outline" className="text-[10px] bg-violet-500/10 text-violet-600 border-violet-500/30">
                                    👤 {product.vetement_genre}
                                  </Badge>
                                )}
                                {product.vetement_couleur && (
                                  <Badge variant="outline" className="text-[10px] bg-rose-500/10 text-rose-600 border-rose-500/30">
                                    🎨 {product.vetement_couleur}
                                  </Badge>
                                )}
                              </>
                            )}

                            {/* Électroménager specs */}
                            {product.category === 'electromenager' && (
                              <>
                                {product.electromenager_marque && (
                                  <Badge variant="outline" className="text-[10px] bg-indigo-500/10 text-indigo-600 border-indigo-500/30">
                                    🏭 {product.electromenager_marque}
                                  </Badge>
                                )}
                                {product.electromenager_modele && (
                                  <Badge variant="outline" className="text-[10px] bg-slate-500/10 text-slate-600 border-slate-500/30">
                                    📋 {product.electromenager_modele}
                                  </Badge>
                                )}
                                {product.puissance && (
                                  <Badge variant="outline" className="text-[10px] bg-red-500/10 text-red-600 border-red-500/30">
                                    💪 {product.puissance}W
                                  </Badge>
                                )}
                                {product.electromenager_classe_energie && (
                                  <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-600 border-emerald-500/30">
                                    ⚡ {product.electromenager_classe_energie}
                                  </Badge>
                                )}
                              </>
                            )}

                            {/* Électronique specs */}
                            {product.category === 'electronique' && (
                              <>
                                {product.electromenager_marque && (
                                  <Badge variant="outline" className="text-[10px] bg-indigo-500/10 text-indigo-600 border-indigo-500/30">
                                    🏭 {product.electromenager_marque}
                                  </Badge>
                                )}
                                {product.electromenager_modele && (
                                  <Badge variant="outline" className="text-[10px] bg-slate-500/10 text-slate-600 border-slate-500/30">
                                    📋 {product.electromenager_modele}
                                  </Badge>
                                )}
                                {product.capacite && (
                                  <Badge variant="outline" className="text-[10px] bg-green-500/10 text-green-600 border-green-500/30">
                                    💾 {product.capacite}
                                  </Badge>
                                )}
                                {product.electromenager_couleur && (
                                  <Badge variant="outline" className="text-[10px] bg-rose-500/10 text-rose-600 border-rose-500/30">
                                    🎨 {product.electromenager_couleur}
                                  </Badge>
                                )}
                              </>
                            )}

                            {/* Dynamic specifications from specifications_techniques - minimum 4 specs */}
                            {product.specifications_techniques && 
                             Object.entries(product.specifications_techniques)
                               .filter(([_, value]) => value !== null && value !== '' && value !== undefined)
                               .slice(0, 4)
                               .map(([key, value]) => (
                                 <Badge key={key} variant="outline" className="text-[10px] bg-teal-500/10 text-teal-600 border-teal-500/30">
                                   ℹ️ {String(value)}
                                 </Badge>
                               ))
                            }
                          </div>
                          
                          <div className="flex items-center gap-2 text-sm flex-wrap mt-2">
                            <Badge variant="outline" className="text-xs">
                              {categories.find(c => c.value === product.category)?.label}
                            </Badge>
                            <Badge variant={product.sale_type === 'retail' ? 'default' : 'secondary'} className="text-xs">
                              {product.sale_type === 'retail' ? 'Détail' : 'Gros'}
                            </Badge>
                          </div>
                          
                          {/* Pricing */}
                          <div className="mt-2">
                            {product.category === 'ceramique' && product.prix_m2 ? (
                              <div className="text-success font-bold text-lg">{formatAmount(product.prix_m2, product.currency)}/m²</div>
                           ) : product.category === 'fer' && product.prix_par_barre ? (
                              <div className="text-success font-bold text-lg">{formatAmount(product.prix_par_barre, product.currency)}/barre</div>
                            ) : product.category === 'vetements' ? (
                              <div className="text-success font-bold text-lg">{formatAmount(product.price, product.currency)}/{product.unit}</div>
                            ) : (
                              <div className="text-success font-bold text-lg">{formatAmount(product.price, product.currency)}</div>
                            )}
                          </div>
                          
                          {/* Stock info with clear movement display */}
                          <div className="flex items-center gap-2 text-sm mt-2 flex-wrap">
                            <Package className="w-4 h-4 text-muted-foreground" />
                            {product.category === 'ceramique' && product.surface_par_boite ? (
                              <>
                                <span className={remainingStock <= product.alert_threshold ? 'text-warning font-medium' : 'text-muted-foreground'}>
                                  {remainingStock.toFixed(2)} m² restants
                                </span>
                                {cartQuantity > 0 && (
                                  <Badge variant="secondary" className="text-xs bg-primary/10">
                                    -{cartQuantity.toFixed(2)} m² au panier
                                  </Badge>
                                )}
                              </>
                            ) : (
                              <>
                                <span className={remainingStock <= product.alert_threshold ? 'text-warning font-medium' : 'text-muted-foreground'}>
                                  {remainingStock} {stockLabel}
                                </span>
                                {cartQuantity > 0 && (
                                  <Badge variant="secondary" className="text-xs">
                                    {cartQuantity} au panier
                                  </Badge>
                                )}
                              </>
                            )}
                            {remainingStock <= product.alert_threshold && (
                              <AlertCircle className="w-4 h-4 text-warning" />
                            )}
                          </div>
                        </div>
                        <Button
                          size="sm"
                          onClick={() => addToCart(product)}
                          disabled={remainingStock === 0}
                          className="w-full"
                        >
                          <Plus className="w-4 h-4 mr-1" />
                          {product.category === 'ceramique' ? 'Entrer surface (m²)' : 
                           product.category === 'fer' ? 'Entrer nombre de barres' : 
                           'Ajouter au panier'}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
            ) : (
            /* List view */
            <div className="flex-1 overflow-y-auto min-h-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Produit</TableHead>
                    <TableHead className="hidden md:table-cell">Catégorie</TableHead>
                    <TableHead>Prix</TableHead>
                    <TableHead>Stock</TableHead>
                    <TableHead className="text-right w-20">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProducts.map((product) => {
                    const cartItem = cart.find(item => item.id === product.id);
                    let availableStock = product.quantity;
                    let stockLabel = product.unit;
                    
                    if (product.category === 'ceramique' && product.stock_boite !== undefined) {
                      const totalM2 = roundTo2Decimals((product.stock_boite || 0) * (product.surface_par_boite || 1));
                      const cartQuantityM2 = cartItem?.cartQuantity || 0;
                      availableStock = roundTo2Decimals(Math.max(0, totalM2 - cartQuantityM2));
                      stockLabel = 'm²';
                    }
                    
                    if (product.category === 'fer' && product.stock_barre !== undefined) {
                      availableStock = product.stock_barre;
                      stockLabel = 'barres';
                    }
                    
                    const cartQuantity = cartItem?.cartQuantity || 0;
                    const remainingStock = product.category === 'ceramique'
                      ? roundTo2Decimals((product.stock_boite || 0) * (product.surface_par_boite || 1) - cartQuantity)
                      : availableStock - cartQuantity;
                    
                    // Specs badges for list view
                    const getListSpecs = () => {
                      const specs: { emoji: string; value: string; color: string }[] = [];
                      
                      // Ceramic
                      if (product.category === 'ceramique') {
                        if (product.dimension) specs.push({ emoji: '📐', value: product.dimension, color: 'bg-blue-500/10 text-blue-600 border-blue-500/30' });
                        if (product.surface_par_boite) specs.push({ emoji: '📦', value: `${product.surface_par_boite} m²/boîte`, color: 'bg-cyan-500/10 text-cyan-600 border-cyan-500/30' });
                      }
                      
                      // Iron
                      if (product.category === 'fer') {
                        if (product.diametre) specs.push({ emoji: '⭕', value: product.diametre, color: 'bg-orange-500/10 text-orange-600 border-orange-500/30' });
                        if (product.longueur_barre_ft) specs.push({ emoji: '📏', value: `${product.longueur_barre_ft} ft`, color: 'bg-amber-500/10 text-amber-600 border-amber-500/30' });
                      }
                      
                      // Energy
                      if (product.category === 'energie') {
                        if (product.type_energie) specs.push({ emoji: '⚡', value: product.type_energie, color: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/30' });
                        if (product.puissance) specs.push({ emoji: '💪', value: `${product.puissance}W`, color: 'bg-red-500/10 text-red-600 border-red-500/30' });
                        if (product.voltage) specs.push({ emoji: '🔌', value: `${product.voltage}V`, color: 'bg-purple-500/10 text-purple-600 border-purple-500/30' });
                        if (product.capacite) specs.push({ emoji: '🔋', value: `${product.capacite}Ah`, color: 'bg-green-500/10 text-green-600 border-green-500/30' });
                      }
                      
                      // Blocs
                      if (product.category === 'blocs') {
                        if (product.bloc_type) specs.push({ emoji: '🧱', value: product.bloc_type, color: 'bg-stone-500/10 text-stone-600 border-stone-500/30' });
                        if (product.bloc_poids) specs.push({ emoji: '⚖️', value: `${product.bloc_poids} kg`, color: 'bg-gray-500/10 text-gray-600 border-gray-500/30' });
                      }
                      
                      // Vêtements
                      if (product.category === 'vetements') {
                        if (product.vetement_taille) specs.push({ emoji: '📏', value: product.vetement_taille, color: 'bg-pink-500/10 text-pink-600 border-pink-500/30' });
                        if (product.vetement_genre) specs.push({ emoji: '👤', value: product.vetement_genre, color: 'bg-violet-500/10 text-violet-600 border-violet-500/30' });
                        if (product.vetement_couleur) specs.push({ emoji: '🎨', value: product.vetement_couleur, color: 'bg-rose-500/10 text-rose-600 border-rose-500/30' });
                      }
                      
                      // Électroménager
                      if (product.category === 'electromenager') {
                        if (product.electromenager_marque) specs.push({ emoji: '🏭', value: product.electromenager_marque, color: 'bg-indigo-500/10 text-indigo-600 border-indigo-500/30' });
                        if (product.electromenager_modele) specs.push({ emoji: '📋', value: product.electromenager_modele, color: 'bg-slate-500/10 text-slate-600 border-slate-500/30' });
                        if (product.puissance) specs.push({ emoji: '💪', value: `${product.puissance}W`, color: 'bg-red-500/10 text-red-600 border-red-500/30' });
                        if (product.electromenager_classe_energie) specs.push({ emoji: '⚡', value: product.electromenager_classe_energie, color: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30' });
                      }
                      
                      // Électronique
                      if (product.category === 'electronique') {
                        if (product.electromenager_marque) specs.push({ emoji: '🏭', value: product.electromenager_marque, color: 'bg-indigo-500/10 text-indigo-600 border-indigo-500/30' });
                        if (product.electromenager_modele) specs.push({ emoji: '📋', value: product.electromenager_modele, color: 'bg-slate-500/10 text-slate-600 border-slate-500/30' });
                        if (product.capacite) specs.push({ emoji: '💾', value: `${product.capacite}`, color: 'bg-green-500/10 text-green-600 border-green-500/30' });
                        if (product.electromenager_couleur) specs.push({ emoji: '🎨', value: product.electromenager_couleur, color: 'bg-rose-500/10 text-rose-600 border-rose-500/30' });
                      }
                      
                      // Dynamic specs from specifications_techniques
                      if (product.specifications_techniques) {
                        Object.entries(product.specifications_techniques)
                          .filter(([_, value]) => value !== null && value !== '' && value !== undefined)
                          .slice(0, 4)
                          .forEach(([key, value]) => {
                            specs.push({ emoji: 'ℹ️', value: String(value), color: 'bg-teal-500/10 text-teal-600 border-teal-500/30' });
                          });
                      }
                      
                      return specs.slice(0, 4);
                    };
                    
                    const listSpecs = getListSpecs();
                    
                    return (
                      <TableRow key={product.id} className="hover:bg-muted/50">
                        <TableCell>
                          <div>
                            <span className="font-medium">{product.name}</span>
                            {listSpecs.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1">
                                {listSpecs.map((spec, idx) => (
                                  <Badge key={idx} variant="outline" className={`text-[10px] ${spec.color}`}>
                                    {spec.emoji} {spec.value}
                                  </Badge>
                                ))}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          <Badge variant="outline" className="text-xs">
                            {categories.find(c => c.value === product.category)?.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <span className="font-bold text-success text-sm">
                            {product.category === 'ceramique' && product.prix_m2 
                              ? formatAmount(product.prix_m2, product.currency) + '/m²'
                              : product.category === 'fer' && product.prix_par_barre
                                ? formatAmount(product.prix_par_barre, product.currency) + '/b'
                                : formatAmount(product.price, product.currency)
                            }
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 flex-wrap">
                            <span className={`text-sm ${remainingStock <= product.alert_threshold ? 'text-warning font-medium' : ''}`}>
                              {product.category === 'ceramique' ? remainingStock.toFixed(2) : remainingStock} {stockLabel}
                            </span>
                            {cartQuantity > 0 && (
                              <Badge variant="secondary" className="text-xs">
                                {product.category === 'ceramique' ? cartQuantity.toFixed(2) : cartQuantity} panier
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            onClick={() => addToCart(product)}
                            disabled={remainingStock === 0}
                            className="h-8 w-8 p-0"
                          >
                            <Plus className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            )}
            
          </CardContent>
        </Card>
      )}

      {currentStep === 'cart' && (
        <div className={getStepAnimationClass()}>
          <CartSection
            cart={cart}
            onContinueShopping={() => handleStepChange('products')}
            onCheckout={() => handleStepChange('checkout')}
          onRemoveItem={removeFromCart}
          onUpdateQuantity={updateQuantity}
          onDirectQuantityChange={handleDirectQuantityChange}
          onClearCart={() => setCart([])}
          formatAmount={formatAmount}
          getTotalAmount={getTotalAmount}
          getTotalsByCurrency={getTotalsByCurrency}
          getTonnageLabel={getTonnageLabel}
          barresToTonnage={barresToTonnage}
          companySettings={companySettings}
        />
        </div>
      )}

      {currentStep === 'checkout' && (
        <div className={`grid grid-cols-1 lg:grid-cols-3 gap-4 h-[calc(100vh-200px)] min-h-[500px] ${getStepAnimationClass()}`}>
          {/* Left Column - Client Info & Payment */}
          <div className="space-y-4">
            {/* Client Info Card */}
            <Card className="border-2 animate-fade-in-up" style={{ animationDelay: '0ms' }}>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <Package className="w-4 h-4 text-primary" />
                  </div>
                  Informations client
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="customer-name" className="text-xs text-muted-foreground">Nom (optionnel)</Label>
                  <Input
                    id="customer-name"
                    placeholder="Nom du client"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="h-9"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="customer-address" className="text-xs text-muted-foreground">Adresse (optionnel)</Label>
                  <Input
                    id="customer-address"
                    placeholder="Adresse du client"
                    value={customerAddress}
                    onChange={(e) => setCustomerAddress(e.target.value)}
                    className="h-9"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Payment Method Card */}
            <Card className="border-2 animate-fade-in-up" style={{ animationDelay: '100ms' }}>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <Receipt className="w-4 h-4 text-primary" />
                  </div>
                  Paiement
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Payment method as styled radio buttons */}
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { value: 'espece', label: 'Espèce', icon: '💵' },
                    { value: 'cheque', label: 'Chèque', icon: '📝' },
                    { value: 'virement', label: 'Virement', icon: '🏦' },
                  ].map((method) => (
                    <button
                      key={method.value}
                      onClick={() => setPaymentMethod(method.value as 'espece' | 'cheque' | 'virement')}
                      className={`flex flex-col items-center gap-1 p-3 rounded-lg border-2 transition-all ${
                        paymentMethod === method.value
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border hover:border-primary/50 hover:bg-muted/50'
                      }`}
                    >
                      <span className="text-xl">{method.icon}</span>
                      <span className="text-xs font-medium">{method.label}</span>
                    </button>
                  ))}
                </div>

                {/* Discount Section - Compact */}
                <div className="space-y-2 pt-2 border-t">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs text-muted-foreground">Remise</Label>
                    <div className="flex gap-1">
                      {['none', 'percentage', 'amount'].map((type) => (
                        <button
                          key={type}
                          onClick={() => handleDiscountTypeChange(type as 'none' | 'percentage' | 'amount')}
                          className={`px-2 py-1 text-xs rounded transition-all ${
                            discountType === type
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-muted hover:bg-muted/80'
                          }`}
                        >
                          {type === 'none' ? 'Aucune' : type === 'percentage' ? '%' : (companySettings?.default_display_currency || 'HTG')}
                        </button>
                      ))}
                    </div>
                  </div>
                  
                  {discountType !== 'none' && (
                    <div className="space-y-2">
                      <div className="flex gap-2">
                        {/* Quick discount buttons */}
                        {discountType === 'percentage' && (
                          <div className="flex gap-1 flex-wrap">
                            {[5, 10, 15, 20].map((pct) => (
                              <button
                                key={pct}
                                onClick={() => handleDiscountValueChange(pct.toString())}
                                className={`px-2 py-1 text-xs rounded border transition-all ${
                                  discountValue === pct.toString()
                                    ? 'border-primary bg-primary/10 text-primary'
                                    : 'border-border hover:border-primary/50'
                                }`}
                              >
                                {pct}%
                              </button>
                            ))}
                          </div>
                        )}
                        <Input
                          type="number"
                          min="0"
                          max={discountType === 'percentage' ? '100' : undefined}
                          step={discountType === 'percentage' ? '1' : '0.01'}
                          value={discountValue}
                          onChange={(e) => handleDiscountValueChange(e.target.value)}
                          placeholder="0"
                          className={`h-8 w-20 text-sm ${discountError ? 'border-destructive focus-visible:ring-destructive' : ''}`}
                        />
                      </div>
                      
                      {/* Real-time discount display */}
                      {parseFloat(discountValue) > 0 && (
                        <div className={`p-2 rounded-lg border ${discountError ? 'bg-destructive/10 border-destructive/30' : 'bg-muted/50 border-muted'}`}>
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground flex items-center gap-1">
                              <Calculator className="w-3 h-3" />
                              Remise calculée :
                            </span>
                            <span className={`font-semibold ${discountError ? 'text-destructive' : 'text-success'}`}>
                              -{formatAmount(getDiscountAmount(), companySettings?.default_display_currency || 'HTG')}
                            </span>
                          </div>
                          {discountType === 'percentage' && !discountError && (
                            <p className="text-xs text-muted-foreground mt-1">
                              {discountValue}% du sous-total unifié
                            </p>
                          )}
                        </div>
                      )}

                      {/* Error message */}
                      {discountError && (
                        <div className="flex items-center gap-1.5 text-destructive text-xs animate-in fade-in duration-200">
                          <AlertCircle className="w-3 h-3" />
                          <span>{discountError}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Center Column - Order Summary */}
          <Card className="border-2 flex flex-col lg:col-span-1 animate-fade-in-up" style={{ animationDelay: '150ms' }}>
            <CardHeader className="pb-2 border-b shrink-0">
              <CardTitle className="text-base flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <ShoppingCart className="w-4 h-4" />
                  Résumé
                </span>
                <Badge variant="secondary" className="text-xs">
                  {cart.length} article{cart.length > 1 ? 's' : ''}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 overflow-auto p-3">
              <div className="space-y-2">
                {cart.map((item) => {
                  const itemTotal = item.actualPrice !== undefined ? item.actualPrice : (item.price * item.cartQuantity);
                  const displayQuantity = item.category === 'ceramique' ? `${item.cartQuantity.toFixed(2)} m²` : `${item.cartQuantity} ${item.unit}`;
                  return (
                    <div key={item.id} className="flex items-center gap-2 p-2 rounded-lg bg-muted/30 border">
                      <div className="w-8 h-8 rounded bg-primary/10 flex items-center justify-center shrink-0">
                        <Package className="w-4 h-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{item.name}</p>
                        <p className="text-xs text-muted-foreground">{displayQuantity}</p>
                      </div>
                      <span className="text-sm font-semibold shrink-0">{formatAmount(itemTotal, item.currency)}</span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Right Column - Totals & Actions */}
          <div className="flex flex-col gap-4">
            {/* Totals Card */}
            <Card className="border-2 flex-1 animate-fade-in-up" style={{ animationDelay: '200ms' }}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Total</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {(() => {
                  const { totalUSD, totalHTG } = getTotalsByCurrency();
                  const hasMultipleCurrencies = totalUSD > 0 && totalHTG > 0;
                  const rate = companySettings?.usd_htg_rate || 132;
                  const displayCurrency = companySettings?.default_display_currency || 'HTG';
                  
                  const unifiedSubtotal = displayCurrency === 'HTG'
                    ? totalHTG + (totalUSD * rate)
                    : totalUSD + (totalHTG / rate);
                  
                  const discountAmount = getDiscountAmount();
                  const afterDiscount = unifiedSubtotal - discountAmount;
                  const tvaRate = companySettings?.tva_rate || 0;
                  const tvaAmount = afterDiscount * (tvaRate / 100);
                  const finalTTC = afterDiscount + tvaAmount;
                  
                  return (
                    <>
                      {/* Currency subtotals */}
                      {totalUSD > 0 && (
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Sous-total USD</span>
                          <Badge variant="outline" className="font-mono">{formatAmount(totalUSD, 'USD')}</Badge>
                        </div>
                      )}
                      {totalHTG > 0 && (
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Sous-total HTG</span>
                          <Badge variant="outline" className="font-mono">{formatAmount(totalHTG, 'HTG')}</Badge>
                        </div>
                      )}
                      
                      {hasMultipleCurrencies && (
                        <p className="text-xs text-muted-foreground italic text-center">
                          1 USD = {rate.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} HTG
                        </p>
                      )}
                      
                      <Separator />
                      
                      <div className="space-y-1.5 text-sm">
                        <div className="flex justify-between">
                          <span>Sous-total HT</span>
                          <span className="font-medium">{formatAmount(unifiedSubtotal, displayCurrency)}</span>
                        </div>
                        
                        {discountAmount > 0 && (
                          <div className="flex justify-between text-destructive">
                            <span>{discountType === 'percentage' ? `Remise (${discountValue}%)` : 'Remise'}</span>
                            <span>-{formatAmount(discountAmount, displayCurrency)}</span>
                          </div>
                        )}
                        
                        {tvaRate > 0 && (
                          <div className="flex justify-between text-muted-foreground">
                            <span>TCA ({tvaRate}%)</span>
                            <span>{formatAmount(tvaAmount, displayCurrency)}</span>
                          </div>
                        )}
                      </div>
                      
                      {/* Final Total - Prominent */}
                      <div className="bg-primary text-primary-foreground rounded-xl p-4 text-center mt-4">
                        <p className="text-xs opacity-80 mb-1">TOTAL TTC</p>
                        <p className="text-2xl font-bold">{formatAmount(finalTTC, displayCurrency)}</p>
                      </div>
                    </>
                  );
                })()}
              </CardContent>
            </Card>

            {/* Action Buttons - Sticky */}
            <div className="flex gap-2">
              <Button
                onClick={() => handleStepChange('cart')}
                variant="outline"
                className="flex-1"
              >
                ← Panier
              </Button>
              <Button
                onClick={processSale}
                disabled={isProcessing || !!discountError}
                className="flex-1 gap-2"
                variant="default"
              >
                {isProcessing ? 'Traitement...' : (
                  <>
                    Confirmer
                    <CheckCircle className="w-4 h-4" />
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {currentStep === 'success' && (
        <div className={`max-w-2xl mx-auto ${getStepAnimationClass()}`}>
          <Card className="shadow-2xl border-2 border-success/20 overflow-hidden">
            {/* Header avec animation */}
            <div className="bg-gradient-to-br from-success/10 via-success/5 to-transparent p-8 text-center relative">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,hsl(var(--success)/0.15),transparent_70%)]" />
              <div className="relative">
                <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-success/20 flex items-center justify-center animate-in zoom-in duration-700">
                  <CheckCircle className="w-12 h-12 text-success animate-in spin-in-180 duration-700" />
                </div>
                <h2 className="text-2xl font-bold text-foreground mb-2">Vente confirmée avec succès !</h2>
                <p className="text-muted-foreground">
                  Transaction enregistrée le {new Date().toLocaleDateString('fr-FR', { 
                    weekday: 'long', 
                    day: 'numeric', 
                    month: 'long', 
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </p>
              </div>
            </div>

            <CardContent className="p-6 space-y-6">
              {/* Récapitulatif de la vente */}
              <div className="bg-muted/50 rounded-xl p-5 space-y-4">
                <h3 className="font-semibold text-lg flex items-center gap-2">
                  <Receipt className="w-5 h-5 text-primary" />
                  Récapitulatif
                </h3>
                
                <div className="grid grid-cols-2 gap-4">
                  {customerName && (
                    <div className="col-span-2 sm:col-span-1">
                      <p className="text-xs text-muted-foreground uppercase tracking-wide">Client</p>
                      <p className="font-medium">{customerName}</p>
                    </div>
                  )}
                  <div className="col-span-2 sm:col-span-1">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Mode de paiement</p>
                    <p className="font-medium capitalize flex items-center gap-2">
                      {paymentMethod === 'espece' ? 'Espèces' : paymentMethod === 'cheque' ? 'Chèque' : 'Virement'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Articles</p>
                    <p className="font-medium">{completedSale?.items?.length || 0} produit(s)</p>
                  </div>
                  {(completedSale?.calculated_discount || 0) > 0 && (
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wide">Remise</p>
                      <p className="font-medium text-destructive">
                        -{formatAmount(completedSale?.calculated_discount || 0, completedSale?.calculated_currency || 'HTG')}
                      </p>
                    </div>
                  )}
                </div>

                {/* Total en vedette - use stored calculated values */}
                <div className="pt-4 border-t border-border">
                  <div className="flex items-center justify-between">
                    <span className="text-lg font-semibold">Total payé</span>
                    <span className="text-2xl font-bold text-success">
                      {formatAmount(completedSale?.calculated_total || 0, completedSale?.calculated_currency || 'HTG')}
                    </span>
                  </div>
                </div>
              </div>

              {/* Actions d'impression */}
              {completedSale && (
                <div className="space-y-3">
                  <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <Printer className="w-4 h-4" />
                    Options d'impression
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button 
                          variant="outline" 
                          className="w-full gap-2 h-12 hover:bg-muted/80 transition-colors"
                        >
                          <div className="flex flex-col items-start">
                            <span className="flex items-center gap-2">
                              <Receipt className="w-4 h-4" />
                              Reçu Thermique
                            </span>
                            <span className="text-[10px] text-muted-foreground">58mm / 80mm</span>
                          </div>
                          <ChevronDown className="w-4 h-4 ml-auto" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="center" className="w-48">
                        <DropdownMenuItem onClick={printReceipt58mm} className="gap-2">
                          <Printer className="w-4 h-4" />
                          Format 58 mm
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={printReceipt80mm} className="gap-2">
                          <Printer className="w-4 h-4" />
                          Format 80 mm
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                    
                    <Button 
                      onClick={printInvoice}
                      variant="outline" 
                      className="w-full gap-2 h-12 hover:bg-muted/80 transition-colors"
                    >
                      <div className="flex flex-col items-start">
                        <span className="flex items-center gap-2">
                          <FileText className="w-4 h-4" />
                          Facture A4
                        </span>
                        <span className="text-[10px] text-muted-foreground">Format standard</span>
                      </div>
                    </Button>

                    <Button 
                      onClick={resetWorkflow} 
                      className="w-full gap-2 h-12 bg-primary hover:bg-primary/90 transition-all hover:scale-[1.02]"
                    >
                      <Plus className="w-5 h-5" />
                      <span>Nouvelle vente</span>
                    </Button>
                  </div>
                </div>
              )}

              {/* Raccourci clavier */}
              <div className="text-center pt-2">
                <p className="text-xs text-muted-foreground">
                  Appuyez sur <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px] font-mono border">Ctrl+N</kbd> pour démarrer une nouvelle vente
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Custom Quantity Dialog */}
      <Dialog open={customQuantityDialog.open} onOpenChange={(open) => {
        if (!open) {
          setCustomQuantityDialog({open: false, product: null});
          setCustomQuantityValue('');
          setQuantityUnit('barre'); // Reset unit
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {customQuantityDialog.product?.category === 'ceramique' 
                ? 'Entrer la surface nécessaire' 
                : 'Entrer la quantité'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {customQuantityDialog.product && (
              <div className="p-3 border rounded-lg bg-muted/50">
                <p className="font-medium">{customQuantityDialog.product.name}</p>
                {customQuantityDialog.product.category === 'ceramique' && (
                  <>
                    <p className="text-sm text-muted-foreground">
                      Dimension: {customQuantityDialog.product.dimension}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Surface par boîte: {customQuantityDialog.product.surface_par_boite} m²
                    </p>
                    <p className="text-sm text-success">
                      Prix: {customQuantityDialog.product.prix_m2} HTG/m²
                    </p>
                  </>
                )}
                {customQuantityDialog.product.category === 'fer' && (
                  <>
                    <p className="text-sm text-muted-foreground">
                      Diamètre: {customQuantityDialog.product.diametre}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Longueur: {customQuantityDialog.product.longueur_barre_ft} ft par barre
                    </p>
                    <p className="text-sm text-success">
                      Prix: {customQuantityDialog.product.prix_par_barre} HTG/barre
                      {customQuantityDialog.product.bars_per_ton && (
                        <span className="text-xs text-muted-foreground block">
                          ({customQuantityDialog.product.bars_per_ton} barres/tonne)
                        </span>
                      )}
                    </p>
                  </>
                )}
              </div>
            )}
            
            {/* Unit selector for iron products */}
            {customQuantityDialog.product?.category === 'fer' && customQuantityDialog.product.bars_per_ton && (
              <div className="space-y-2">
                <Label>Unité</Label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={quantityUnit === 'barre' ? 'default' : 'outline'}
                    onClick={() => setQuantityUnit('barre')}
                    className="flex-1"
                  >
                    Barres
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={quantityUnit === 'tonne' ? 'default' : 'outline'}
                    onClick={() => setQuantityUnit('tonne')}
                    className="flex-1"
                  >
                    Tonnes
                  </Button>
                </div>
              </div>
            )}
            
            <div className="space-y-2">
              <Label htmlFor="custom-quantity">
                {customQuantityDialog.product?.category === 'ceramique' 
                  ? 'Surface nécessaire (m²)' 
                  : customQuantityDialog.product?.category === 'fer'
                    ? quantityUnit === 'barre' ? 'Quantité (barres)' : 'Quantité (tonnes)'
                    : 'Quantité'}
              </Label>
              
              {/* Quick fraction buttons for iron (only when tonne is selected) */}
              {customQuantityDialog.product?.category === 'fer' && quantityUnit === 'tonne' && (
                <div className="grid grid-cols-4 gap-2 mb-3">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setCustomQuantityValue('0.25')}
                    className="text-xs"
                  >
                    1/4 T
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setCustomQuantityValue('0.5')}
                    className="text-xs"
                  >
                    1/2 T
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setCustomQuantityValue('0.75')}
                    className="text-xs"
                  >
                    3/4 T
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setCustomQuantityValue('1')}
                    className="text-xs"
                  >
                    1 T
                  </Button>
                </div>
              )}
              
              <Input
                id="custom-quantity"
                type="number"
                step={customQuantityDialog.product?.category === 'fer' && quantityUnit === 'barre' ? '1' : '0.01'}
                min="0"
                value={customQuantityValue}
                onChange={(e) => setCustomQuantityValue(e.target.value)}
                placeholder={
                  customQuantityDialog.product?.category === 'ceramique' 
                    ? 'Ex: 15.5' 
                    : quantityUnit === 'barre' 
                      ? 'Ex: 10' 
                      : 'Ex: 0.5'
                }
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    handleCustomQuantitySubmit();
                  }
                }}
              />
              {customQuantityDialog.product?.category === 'ceramique' && customQuantityValue && (
                <p className="text-xs text-muted-foreground">
                  {customQuantityDialog.product.surface_par_boite && (
                    <> 
                      Boîtes nécessaires: {(parseFloat(customQuantityValue) / customQuantityDialog.product.surface_par_boite).toFixed(2)}
                      {' '}(≈ {parseFloat(customQuantityValue).toFixed(2)} m²)
                    </>
                  )}
                </p>
              )}
              {customQuantityDialog.product?.category === 'fer' && customQuantityValue && customQuantityDialog.product.bars_per_ton && (
                <p className="text-xs text-muted-foreground">
                  {quantityUnit === 'tonne' ? (
                    <>
                      <span className="block font-medium">{getTonnageLabel(parseFloat(customQuantityValue))}</span>
                      <span className="block">
                        ≈ {tonnageToBarres(parseFloat(customQuantityValue), customQuantityDialog.product.bars_per_ton)} barres (arrondi)
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="block">{parseFloat(customQuantityValue)} barres</span>
                      {parseFloat(customQuantityValue) % customQuantityDialog.product.bars_per_ton === 0 && (
                        <span className="block">
                          = {parseFloat(customQuantityValue) / customQuantityDialog.product.bars_per_ton} tonne{parseFloat(customQuantityValue) / customQuantityDialog.product.bars_per_ton > 1 ? 's' : ''}
                        </span>
                      )}
                    </>
                  )}
                </p>
              )}
            </div>
            <div className="flex gap-2 justify-end">
              <Button 
                variant="outline" 
                onClick={() => {
                  setCustomQuantityDialog({open: false, product: null});
                  setCustomQuantityValue('');
                  setQuantityUnit('barre');
                }}
              >
                Annuler
              </Button>
              <Button onClick={handleCustomQuantitySubmit}>
                Ajouter au panier
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Bouton flottant compact du panier */}
      {cart.length > 0 && currentStep === 'products' && (
        <div className="fixed bottom-6 right-6 z-50">
          <div className="relative">
            {/* Badge avec nombre d'articles */}
            <Badge 
              variant="destructive" 
              className="absolute -top-2 -right-2 z-10 min-w-[24px] h-6 flex items-center justify-center rounded-full px-2 shadow-lg"
            >
              {cart.length}
            </Badge>
            
            {/* Bouton circulaire principal */}
            <Button
              onClick={() => handleStepChange('cart')}
              size="lg"
              className={`h-16 w-16 rounded-full shadow-2xl hover:scale-110 transition-transform duration-200 bg-primary hover:bg-primary/90 relative group p-0 ${cartPulse ? 'animate-[pulse_0.6s_ease-in-out]' : ''}`}
            >
              <div className="flex flex-col items-center gap-0.5">
                <ShoppingCart className="w-6 h-6" />
                <span className="text-[10px] font-semibold leading-none">
                  {formatAmount(cart.reduce((total, item) => {
                    const itemPrice = item.actualPrice !== undefined 
                      ? item.actualPrice 
                      : (item.price * item.cartQuantity);
                    return total + itemPrice;
                  }, 0)).replace(/\s/g, '').substring(0, 8)}
                </span>
              </div>
              
              {/* Tooltip au survol */}
              <div className="absolute bottom-full right-0 mb-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none">
                <div className="bg-popover text-popover-foreground px-3 py-2 rounded-lg shadow-lg whitespace-nowrap text-sm border">
                  <div className="font-semibold mb-1">Panier ({cart.length} article{cart.length > 1 ? 's' : ''})</div>
                  <div className="text-success font-bold">
                    Total : {formatAmount(cart.reduce((total, item) => {
                      const itemPrice = item.actualPrice !== undefined 
                        ? item.actualPrice 
                        : (item.price * item.cartQuantity);
                      return total + itemPrice;
                    }, 0))}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1 border-t pt-1">
                    Raccourci : <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px] font-mono">Ctrl+P</kbd>
                  </div>
                </div>
              </div>
            </Button>
          </div>
        </div>
      )}

      {/* Modal d'aide des raccourcis clavier */}
      {showShortcutsHelp && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="bg-card border rounded-xl shadow-2xl w-full max-w-md mx-4 animate-scale-in">
            <div className="flex items-center justify-between p-4 border-b">
              <div className="flex items-center gap-2">
                <Keyboard className="w-5 h-5 text-primary" />
                <h3 className="font-semibold text-lg">Raccourcis clavier</h3>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowShortcutsHelp(false)}
                className="h-8 w-8 p-0"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
            <div className="p-4 space-y-3">
              <div className="flex items-center justify-between py-2 border-b border-dashed">
                <span className="text-sm">Basculer vue Cartes/Liste</span>
                <kbd className="px-2 py-1 bg-muted rounded text-xs font-mono">Ctrl+L</kbd>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-dashed">
                <span className="text-sm">Aller au panier</span>
                <kbd className="px-2 py-1 bg-muted rounded text-xs font-mono">Ctrl+P</kbd>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-dashed">
                <span className="text-sm">Étape précédente</span>
                <kbd className="px-2 py-1 bg-muted rounded text-xs font-mono">Escape</kbd>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-dashed">
                <span className="text-sm">Scanner code-barres</span>
                <span className="text-xs text-muted-foreground">Taper + Enter</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-dashed">
                <span className="text-sm">Nouvelle vente (après confirmation)</span>
                <kbd className="px-2 py-1 bg-muted rounded text-xs font-mono">Ctrl+N</kbd>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-sm">Afficher cette aide</span>
                <kbd className="px-2 py-1 bg-muted rounded text-xs font-mono">Ctrl+?</kbd>
              </div>
            </div>
            <div className="p-4 border-t bg-muted/30 rounded-b-xl">
              <p className="text-xs text-muted-foreground text-center">
                Appuyez sur <kbd className="px-1 py-0.5 bg-muted rounded text-[10px] font-mono">Escape</kbd> pour fermer
              </p>
            </div>
          </div>
        </div>
      )}
     </div>
   );
 };