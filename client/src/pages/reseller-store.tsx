import { useQuery } from "@tanstack/react-query";
import { useRoute } from "wouter";
import { Loader2, Store, ShoppingCart, Search, Headphones, Package, Zap, Gift, Sparkles } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useState, useMemo, useEffect } from "react";
import type { Product, Reseller } from "@shared/schema";
import { CheckoutModal } from "@/components/checkout-modal";
import { useStore } from "@/lib/store-context";

export default function ResellerStore() {
  const [match, params] = useRoute("/loja/:slug");
  const slug = params?.slug as string;
  const { addToCart, cartCount, setCurrentReseller } = useStore();
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const { data: reseller, isLoading: resellerLoading } = useQuery<Reseller>({
    queryKey: ["/api/reseller", slug],
    enabled: !!slug,
  });

  const { data: products = [], isLoading: productsLoading } = useQuery<Product[]>({
    queryKey: ["/api/reseller/products", slug],
    enabled: !!slug,
  });

  const isLoading = resellerLoading || productsLoading;

  useEffect(() => {
    if (reseller) {
      setCurrentReseller(reseller);
    }
    return () => {
      setCurrentReseller(null);
    };
  }, [reseller, setCurrentReseller]);

  const categories = useMemo(() => {
    const cats = new Set<string>();
    products.forEach(p => {
      if (p.category) cats.add(p.category);
    });
    return Array.from(cats);
  }, [products]);

  const filteredProducts = useMemo(() => {
    let filtered = products;
    if (selectedCategory) {
      filtered = filtered.filter(p => p.category === selectedCategory);
    }
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(p => 
        p.name.toLowerCase().includes(query) ||
        (p.description && p.description.toLowerCase().includes(query))
      );
    }
    return filtered;
  }, [products, selectedCategory, searchQuery]);

  const productsWithDiscount = useMemo(() => {
    return products.filter(p => Number(p.originalPrice) > Number(p.currentPrice));
  }, [products]);

  const handleBuyClick = (product: Product) => {
    const productWithSeller = {
      ...product,
      resellerId: reseller?.id || product.resellerId
    };
    addToCart(productWithSeller);
    setTimeout(() => {
      setIsCheckoutOpen(true);
    }, 50);
  };

  const themeColor = reseller?.themeColor || "#a855f7";
  const buttonColor = reseller?.buttonColor || themeColor;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#0a0a12]">
        <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
      </div>
    );
  }

  if (!reseller || !reseller.active) {
    return (
      <div className="flex items-center justify-center min-h-screen flex-col gap-4 bg-[#0a0a12]">
        <Store className="w-16 h-16 text-gray-600" />
        <p className="text-2xl font-bold text-white">{!reseller ? "Loja nao encontrada" : "Loja Indisponivel"}</p>
        <p className="text-gray-400">{!reseller ? "Esta loja nao existe ou foi desativada" : "Esta loja foi bloqueada"}</p>
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

      <div className="min-h-screen bg-[#0a0a12] relative">
        <div className="network-bg" />

        <div className="relative z-10">
          <div className="promo-banner">
            Use o cupom PROMO10 para ganhar 10% de desconto em compras acima de R$15,00
          </div>

          <header className="store-header sticky top-0 z-50">
            <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                {reseller.logoUrl ? (
                  <img 
                    src={reseller.logoUrl} 
                    alt={reseller.storeName || "Logo"} 
                    className="w-9 h-9 rounded-lg object-cover"
                    data-testid="img-store-logo"
                  />
                ) : (
                  <div 
                    className="w-9 h-9 rounded-lg flex items-center justify-center bg-gradient-to-br from-purple-500 to-pink-500"
                  >
                    <Store className="w-5 h-5 text-white" />
                  </div>
                )}
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-white text-base sm:text-lg" data-testid="text-store-name">
                    {reseller.storeName || "Loja"}
                  </span>
                  <svg 
                    className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" 
                    viewBox="0 0 24 24" 
                    fill="none"
                    data-testid="icon-verified"
                  >
                    <circle cx="12" cy="12" r="10" fill="#1DA1F2"/>
                    <path d="M9 12l2 2 4-4" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button 
                  size="icon" 
                  variant="ghost" 
                  className="text-gray-300 hover:text-white"
                  data-testid="button-search"
                >
                  <Search className="w-5 h-5" />
                </Button>
                <Button 
                  size="icon" 
                  variant="ghost" 
                  className="text-gray-300 hover:text-white"
                  data-testid="button-support"
                >
                  <Headphones className="w-5 h-5" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="cart-icon-btn relative"
                  onClick={() => setIsCheckoutOpen(true)}
                  data-testid="button-cart"
                >
                  <ShoppingCart className="w-5 h-5 text-purple-400" />
                  {cartCount > 0 && (
                    <span className="absolute -top-1 -right-1 w-5 h-5 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full text-xs font-bold text-white flex items-center justify-center">
                      {cartCount}
                    </span>
                  )}
                </Button>
                <Button
                  variant="outline"
                  className="ml-2 border-purple-500/50 text-white hover:bg-purple-500/20"
                  data-testid="button-login"
                >
                  Entrar
                </Button>
              </div>
            </div>
          </header>

          <main className="max-w-6xl mx-auto px-4 py-6">
            {categories.length > 0 && (
              <div className="mb-8">
                <div className="section-title">
                  <Gift className="w-5 h-5 text-purple-400" />
                  <span>{selectedCategory || "Categorias"}</span>
                </div>
                
                <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
                  <button
                    onClick={() => setSelectedCategory(null)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all whitespace-nowrap ${
                      selectedCategory === null 
                        ? "bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg shadow-purple-500/30" 
                        : "bg-white/5 text-gray-300 border border-white/10 hover:border-purple-500/50"
                    }`}
                    data-testid="category-all"
                  >
                    <Sparkles className="w-4 h-4" />
                    Todos
                  </button>
                  
                  {categories.map((category) => (
                    <button
                      key={category}
                      onClick={() => setSelectedCategory(category)}
                      className={`px-4 py-2 rounded-full text-sm font-medium transition-all whitespace-nowrap ${
                        selectedCategory === category 
                          ? "bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg shadow-purple-500/30" 
                          : "bg-white/5 text-gray-300 border border-white/10 hover:border-purple-500/50"
                      }`}
                      data-testid={`category-${category}`}
                    >
                      {category}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {productsWithDiscount.length > 0 && !selectedCategory && (
              <div className="mb-8">
                <div className="section-title">
                  <Zap className="w-5 h-5 text-green-400" />
                  <span>OFERTAS RELAMPAGO!!</span>
                  <span className="flash-sale-badge ml-2">Hot</span>
                </div>
                
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                  {productsWithDiscount.slice(0, 5).map((product) => {
                    const hasStock = product.stock && product.stock.trim();
                    const discountPercent = Math.round(
                      ((Number(product.originalPrice) - Number(product.currentPrice)) / Number(product.originalPrice)) * 100
                    );

                    return (
                      <Card
                        key={`flash-${product.id}`}
                        className="product-card overflow-hidden group"
                        data-testid={`card-flash-${product.id}`}
                      >
                        <div 
                          className="relative aspect-square overflow-hidden cursor-pointer rounded-lg"
                          onClick={() => window.location.href = `/loja/${slug}/produto/${product.id}`}
                        >
                          {product.imageUrl ? (
                            <img
                              src={product.imageUrl}
                              alt={product.name}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            />
                          ) : (
                            <div className="w-full h-full bg-gradient-to-br from-purple-900/30 to-pink-900/30 flex items-center justify-center">
                              <Package className="w-10 h-10 text-purple-400/50" />
                            </div>
                          )}
                          
                          <div className="absolute top-2 left-2 discount-badge">
                            -{discountPercent}%
                          </div>
                          
                          {!hasStock && (
                            <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
                              <span className="text-white font-semibold text-xs bg-red-500/80 px-2 py-1 rounded">
                                Esgotado
                              </span>
                            </div>
                          )}
                        </div>

                        <div className="pt-3">
                          <h3 
                            className="text-white font-medium text-sm mb-2 line-clamp-2 min-h-[2.5rem] cursor-pointer hover:text-purple-300 transition-colors"
                            onClick={() => window.location.href = `/loja/${slug}/produto/${product.id}`}
                          >
                            {product.name}
                          </h3>

                          <div className="flex flex-col gap-0.5 mb-3">
                            <span className="text-xs text-gray-500 line-through">
                              R$ {Number(product.originalPrice).toFixed(2)}
                            </span>
                            <div className="flex items-baseline gap-2">
                              <span className="text-lg font-bold text-purple-400">
                                R$ {Number(product.currentPrice).toFixed(2).split('.')[0]}
                              </span>
                              <span className="text-sm text-purple-400">
                                ,{Number(product.currentPrice).toFixed(2).split('.')[1]}
                              </span>
                            </div>
                          </div>

                          <div className="flex gap-2">
                            <Button
                              onClick={() => handleBuyClick(product)}
                              disabled={!hasStock}
                              className="flex-1 text-xs font-semibold btn-comprar"
                              data-testid={`button-flash-buy-${product.id}`}
                            >
                              Comprar
                            </Button>
                            <Button
                              size="icon"
                              variant="outline"
                              className="border-purple-500/30 hover:bg-purple-500/20"
                              onClick={() => handleBuyClick(product)}
                              disabled={!hasStock}
                              data-testid={`button-flash-cart-${product.id}`}
                            >
                              <ShoppingCart className="w-4 h-4 text-purple-400" />
                            </Button>
                          </div>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              </div>
            )}

            <div>
              <div className="section-title">
                <Package className="w-5 h-5 text-purple-400" />
                <span>{selectedCategory || "Todos os Produtos"}</span>
                <span className="text-sm font-normal text-gray-400 ml-2">
                  ({filteredProducts.length} {filteredProducts.length === 1 ? "item" : "itens"})
                </span>
              </div>

              {filteredProducts.length === 0 ? (
                <div className="text-center py-16">
                  <Package className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                  <p className="text-gray-400">Nenhum produto disponivel</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                  {filteredProducts.map((product) => {
                    const hasStock = product.stock && product.stock.trim();
                    const hasDiscount = Number(product.originalPrice) > Number(product.currentPrice);
                    const discountPercent = hasDiscount
                      ? Math.round(((Number(product.originalPrice) - Number(product.currentPrice)) / Number(product.originalPrice)) * 100)
                      : 0;

                    return (
                      <Card
                        key={product.id}
                        className="product-card overflow-hidden group"
                        data-testid={`card-product-${product.id}`}
                      >
                        <div 
                          className="relative aspect-square overflow-hidden cursor-pointer rounded-lg"
                          onClick={() => window.location.href = `/loja/${slug}/produto/${product.id}`}
                        >
                          {product.imageUrl ? (
                            <img
                              src={product.imageUrl}
                              alt={product.name}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            />
                          ) : (
                            <div className="w-full h-full bg-gradient-to-br from-purple-900/30 to-pink-900/30 flex items-center justify-center">
                              <Package className="w-10 h-10 text-purple-400/50" />
                            </div>
                          )}
                          
                          {hasDiscount && (
                            <div className="absolute top-2 left-2 discount-badge">
                              -{discountPercent}%
                            </div>
                          )}

                          {!hasStock && (
                            <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
                              <span className="text-white font-semibold text-xs bg-red-500/80 px-2 py-1 rounded">
                                Esgotado
                              </span>
                            </div>
                          )}
                        </div>

                        <div className="pt-3">
                          <h3 
                            className="text-white font-medium text-sm mb-2 line-clamp-2 min-h-[2.5rem] cursor-pointer hover:text-purple-300 transition-colors"
                            onClick={() => window.location.href = `/loja/${slug}/produto/${product.id}`}
                          >
                            {product.name}
                          </h3>

                          <div className="flex flex-col gap-0.5 mb-3">
                            {hasDiscount && (
                              <span className="text-xs text-gray-500 line-through">
                                R$ {Number(product.originalPrice).toFixed(2)}
                              </span>
                            )}
                            <div className="flex items-baseline gap-1">
                              <span className="text-lg font-bold text-purple-400">
                                R$ {Number(product.currentPrice).toFixed(2).split('.')[0]}
                              </span>
                              <span className="text-sm text-purple-400">
                                ,{Number(product.currentPrice).toFixed(2).split('.')[1]}
                              </span>
                            </div>
                            <span className="text-xs text-gray-500">A vista no PIX</span>
                          </div>

                          <div className="flex gap-2">
                            <Button
                              onClick={() => handleBuyClick(product)}
                              disabled={!hasStock}
                              className="flex-1 text-xs font-semibold btn-comprar"
                              data-testid={`button-buy-${product.id}`}
                            >
                              Comprar
                            </Button>
                            <Button
                              size="icon"
                              variant="outline"
                              className="border-purple-500/30 hover:bg-purple-500/20"
                              onClick={() => handleBuyClick(product)}
                              disabled={!hasStock}
                              data-testid={`button-cart-${product.id}`}
                            >
                              <ShoppingCart className="w-4 h-4 text-purple-400" />
                            </Button>
                          </div>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>
          </main>

          <footer className="border-t border-purple-500/10 mt-12 py-8">
            <div className="max-w-6xl mx-auto px-4 text-center">
              <div className="flex items-center justify-center gap-2 mb-4">
                {reseller.logoUrl ? (
                  <img 
                    src={reseller.logoUrl} 
                    alt={reseller.storeName || "Logo"} 
                    className="w-8 h-8 rounded-lg object-cover"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-gradient-to-br from-purple-500 to-pink-500">
                    <Store className="w-4 h-4 text-white" />
                  </div>
                )}
                <span className="font-bold text-white">{reseller.storeName}</span>
              </div>
              <p className="text-gray-500 text-sm">
                Nosso suporte funciona de segunda a sabado
              </p>
              <div className="flex items-center justify-center gap-6 mt-4 text-xs text-gray-600">
                <a href="#" className="hover:text-purple-400 transition-colors">Politicas</a>
                <a href="#" className="hover:text-purple-400 transition-colors">Termos</a>
                <a href="#" className="hover:text-purple-400 transition-colors">Contato</a>
              </div>
            </div>
          </footer>
        </div>
      </div>
    </>
  );
}
