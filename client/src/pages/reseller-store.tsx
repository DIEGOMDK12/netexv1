import { useQuery } from "@tanstack/react-query";
import { useRoute } from "wouter";
import { Loader2, Store, ShoppingCart, Tv, Gamepad2, Trophy, Headphones, Gift, Sparkles, Package, Star, Zap } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useState, useMemo } from "react";
import type { Product, Reseller } from "@shared/schema";
import { CheckoutModal } from "@/components/checkout-modal";
import { useStore } from "@/lib/store-context";

const categoryIcons: Record<string, any> = {
  "Streaming": Tv,
  "Games": Gamepad2,
  "Xbox": Gamepad2,
  "Contas Premium": Trophy,
  "Entretenimento": Headphones,
  "Gift Cards": Gift,
  "Premium": Star,
  "Outros": Package,
};

const categoryColors: Record<string, string> = {
  "Streaming": "#E50914",
  "Games": "#107C10",
  "Xbox": "#107C10",
  "Contas Premium": "#FFD700",
  "Entretenimento": "#FF0000",
  "Gift Cards": "#9333EA",
  "Premium": "#3B82F6",
  "Outros": "#6B7280",
};

export default function ResellerStore() {
  const [match, params] = useRoute("/loja/:slug");
  const slug = params?.slug as string;
  const { addToCart } = useStore();
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const { data: reseller, isLoading: resellerLoading } = useQuery<Reseller>({
    queryKey: ["/api/reseller", slug],
    enabled: !!slug,
  });

  const { data: products = [], isLoading: productsLoading } = useQuery<Product[]>({
    queryKey: ["/api/reseller/products", slug],
    enabled: !!slug,
  });

  const isLoading = resellerLoading || productsLoading;

  // Extract unique categories from products
  const categories = useMemo(() => {
    const cats = new Set<string>();
    products.forEach(p => {
      if (p.category) cats.add(p.category);
    });
    return Array.from(cats);
  }, [products]);

  // Filter products by selected category
  const filteredProducts = useMemo(() => {
    if (!selectedCategory) return products;
    return products.filter(p => p.category === selectedCategory);
  }, [products, selectedCategory]);

  const handleBuyClick = (product: Product) => {
    const productWithSeller = {
      ...product,
      resellerId: reseller?.id || product.resellerId
    };
    addToCart(productWithSeller);
    // Small delay to ensure cart state updates before modal opens
    setTimeout(() => {
      setIsCheckoutOpen(true);
    }, 50);
  };

  const themeColor = reseller?.themeColor || "#3B82F6";
  const buttonColor = reseller?.buttonColor || themeColor;
  const cardBorderColor = reseller?.cardBorderColor || "rgba(255,255,255,0.05)";
  const backgroundImageUrl = reseller?.backgroundImageUrl || "";

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-950">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (!reseller || !reseller.active) {
    return (
      <div className="flex items-center justify-center min-h-screen flex-col gap-4 bg-slate-950">
        <Store className="w-16 h-16 text-gray-600" />
        <p className="text-2xl font-bold text-white">{!reseller ? "Loja não encontrada" : "Loja Indisponível"}</p>
        <p className="text-gray-400">{!reseller ? "Esta loja não existe ou foi desativada" : "Esta loja foi bloqueada"}</p>
      </div>
    );
  }

  return (
    <>
      <CheckoutModal
        open={isCheckoutOpen}
        onClose={() => setIsCheckoutOpen(false)}
        themeColor={themeColor}
        textColor="#FFFFFF"
      />

      <div 
        className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950"
        style={backgroundImageUrl ? {
          backgroundImage: `linear-gradient(rgba(15, 23, 42, 0.85), rgba(15, 23, 42, 0.95)), url(${backgroundImageUrl})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundAttachment: 'fixed',
        } : undefined}
      >
        {/* Header */}
        <header className="sticky top-0 z-50 backdrop-blur-xl border-b border-white/5 bg-slate-950/80">
          <div className="max-w-lg mx-auto px-4 h-14 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              {reseller.logoUrl ? (
                <img 
                  src={reseller.logoUrl} 
                  alt={reseller.storeName || "Logo"} 
                  className="w-9 h-9 rounded-xl object-cover"
                />
              ) : (
                <div 
                  className="w-9 h-9 rounded-xl flex items-center justify-center"
                  style={{ backgroundColor: themeColor }}
                >
                  <Store className="w-5 h-5 text-white" />
                </div>
              )}
              <span className="font-bold text-white text-lg">{reseller.storeName}</span>
            </div>
            <Button 
              size="icon" 
              variant="ghost" 
              className="text-white"
              onClick={() => setIsCheckoutOpen(true)}
              data-testid="button-cart"
            >
              <ShoppingCart className="w-5 h-5" />
            </Button>
          </div>
        </header>

        <main className="max-w-lg mx-auto px-4 pb-8">
          {/* Categories - Instagram Style */}
          {categories.length > 0 && (
            <div className="py-4 -mx-4 px-4 overflow-x-auto scrollbar-hide">
              <div className="flex gap-4">
                {/* All Products */}
                <button
                  onClick={() => setSelectedCategory(null)}
                  className="flex flex-col items-center gap-2 flex-shrink-0"
                  data-testid="category-all"
                >
                  <div 
                    className={`w-16 h-16 rounded-full flex items-center justify-center transition-all ${
                      selectedCategory === null 
                        ? "ring-2 ring-offset-2 ring-offset-slate-950" 
                        : "opacity-70"
                    }`}
                    style={{ 
                      background: `linear-gradient(135deg, ${themeColor}, ${themeColor}99)`
                    }}
                  >
                    <Sparkles className="w-7 h-7 text-white" />
                  </div>
                  <span className={`text-xs font-medium ${selectedCategory === null ? "text-white" : "text-gray-400"}`}>
                    Todos
                  </span>
                </button>

                {/* Category Items */}
                {categories.map((category) => {
                  const IconComponent = categoryIcons[category] || Package;
                  const color = categoryColors[category] || themeColor;
                  const isSelected = selectedCategory === category;
                  
                  return (
                    <button
                      key={category}
                      onClick={() => setSelectedCategory(category)}
                      className="flex flex-col items-center gap-2 flex-shrink-0"
                      data-testid={`category-${category}`}
                    >
                      <div 
                        className={`w-16 h-16 rounded-full flex items-center justify-center transition-all ${
                          isSelected 
                            ? "ring-2 ring-offset-2 ring-offset-slate-950" 
                            : "opacity-70"
                        }`}
                        style={{ 
                          background: `linear-gradient(135deg, ${color}, ${color}99)`
                        }}
                      >
                        <IconComponent className="w-7 h-7 text-white" />
                      </div>
                      <span className={`text-xs font-medium max-w-[70px] truncate ${isSelected ? "text-white" : "text-gray-400"}`}>
                        {category}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Section Title */}
          <div className="flex items-center justify-between mt-2 mb-4">
            <div className="flex items-center gap-2">
              <Zap className="w-5 h-5" style={{ color: themeColor }} />
              <h2 className="text-lg font-bold text-white">
                {selectedCategory || "Todos os Produtos"}
              </h2>
            </div>
            <span className="text-sm text-gray-400">
              {filteredProducts.length} {filteredProducts.length === 1 ? "item" : "itens"}
            </span>
          </div>

          {/* Products Grid */}
          {filteredProducts.length === 0 ? (
            <div className="text-center py-16">
              <Package className="w-12 h-12 text-gray-600 mx-auto mb-3" />
              <p className="text-gray-400">Nenhum produto disponível</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {filteredProducts.map((product) => {
                const hasStock = product.stock && product.stock.trim();
                const hasDiscount = Number(product.originalPrice) > Number(product.currentPrice);
                const discountPercent = hasDiscount
                  ? Math.round(((Number(product.originalPrice) - Number(product.currentPrice)) / Number(product.originalPrice)) * 100)
                  : 0;

                return (
                  <Card
                    key={product.id}
                    className="overflow-hidden bg-white/[0.03] hover:bg-white/[0.06] transition-all group"
                    style={{ borderColor: cardBorderColor }}
                    data-testid={`card-product-${product.id}`}
                  >
                    {/* Product Image */}
                    <div 
                      className="relative aspect-square overflow-hidden cursor-pointer"
                      onClick={() => window.location.href = `/loja/${slug}/produto/${product.id}`}
                    >
                      {product.imageUrl ? (
                        <img
                          src={product.imageUrl}
                          alt={product.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <div className="w-full h-full bg-slate-800/50 flex items-center justify-center">
                          <Package className="w-10 h-10 text-gray-600" />
                        </div>
                      )}
                      
                      {/* Discount Badge */}
                      {hasDiscount && (
                        <div 
                          className="absolute top-2 left-2 px-2 py-0.5 rounded-full text-xs font-bold text-white"
                          style={{ backgroundColor: themeColor }}
                        >
                          -{discountPercent}%
                        </div>
                      )}

                      {/* Out of Stock Overlay */}
                      {!hasStock && (
                        <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
                          <span className="text-white font-semibold text-sm bg-red-500/80 px-3 py-1 rounded-full">
                            Esgotado
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Product Info */}
                    <CardContent className="p-3">
                      <h3 
                        className="text-white font-medium text-sm mb-2 line-clamp-2 min-h-[2.5rem] cursor-pointer"
                        onClick={() => window.location.href = `/loja/${slug}/produto/${product.id}`}
                      >
                        {product.name}
                      </h3>

                      {/* Price */}
                      <div className="flex items-baseline gap-2 mb-3">
                        <span 
                          className="text-lg font-bold"
                          style={{ color: themeColor }}
                        >
                          R$ {Number(product.currentPrice).toFixed(2)}
                        </span>
                        {hasDiscount && (
                          <span className="text-xs text-gray-500 line-through">
                            R$ {Number(product.originalPrice).toFixed(2)}
                          </span>
                        )}
                      </div>

                      {/* Buy Button */}
                      <Button
                        onClick={() => handleBuyClick(product)}
                        disabled={!hasStock}
                        className="w-full text-sm font-medium"
                        style={hasStock ? { backgroundColor: buttonColor } : undefined}
                        variant={hasStock ? "default" : "secondary"}
                        data-testid={`button-buy-${product.id}`}
                      >
                        <ShoppingCart className="w-4 h-4 mr-1.5" />
                        {hasStock ? "Comprar" : "Esgotado"}
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

        </main>
      </div>
    </>
  );
}
