import { useQuery } from "@tanstack/react-query";
import { useRoute } from "wouter";
import { Loader2, Store, ShoppingCart, Search, Headphones, Package, Zap, Gift, Sparkles, Star, ThumbsUp, ShoppingBag } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useState, useMemo, useEffect } from "react";
import type { Product, Reseller, Review } from "@shared/schema";
import { CheckoutModal } from "@/components/checkout-modal";
import { useStore } from "@/lib/store-context";
import { useAuth } from "@/hooks/useAuth";
import { AnnouncementBar } from "@/components/announcement-bar";

interface SellerStats {
  averageRating: number;
  totalReviews: number;
  positivePercent: number;
  totalSales: number;
}

export default function ResellerStore() {
  const [match, params] = useRoute("/loja/:slug");
  const slug = params?.slug as string;
  const { addToCart, addToCartOnce, cartCount, setCurrentReseller } = useStore();
  const { isAuthenticated } = useAuth();
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

  const { data: sellerStats } = useQuery<SellerStats>({
    queryKey: ["/api/seller", reseller?.id, "stats"],
    queryFn: async () => {
      if (!reseller?.id) return null;
      const response = await fetch(`/api/seller/${reseller.id}/stats`);
      if (!response.ok) throw new Error("Failed to fetch stats");
      return response.json();
    },
    enabled: !!reseller?.id,
  });

  const { data: sellerReviews = [] } = useQuery<Review[]>({
    queryKey: ["/api/reviews/seller", reseller?.id],
    queryFn: async () => {
      if (!reseller?.id) return [];
      const response = await fetch(`/api/reviews/seller/${reseller.id}`);
      if (!response.ok) return [];
      return response.json();
    },
    enabled: !!reseller?.id,
  });

  const isLoading = resellerLoading || productsLoading;

  useEffect(() => {
    if (reseller) {
      setCurrentReseller(reseller);

      // Update dynamic meta tags for this reseller
      const title = reseller.storeName || "ELITEVAULT - Produtos Digitais Premium";
      const description = reseller.storeDescription || "Plataforma para vender produtos digitais. Crie sua loja online e venda streaming, games, contas premium com pagamento PIX, Stripe e PagSeguro. Entrega instantânea via email.";
      const ogImage = reseller.ogImageUrl || "/og-image.png";
      const favicon = reseller.faviconUrl || "/favicon.png";

      // Update title
      document.title = title;

      // Update meta description
      let metaDescription = document.querySelector('meta[name="description"]');
      if (!metaDescription) {
        metaDescription = document.createElement('meta');
        metaDescription.setAttribute('name', 'description');
        document.head.appendChild(metaDescription);
      }
      metaDescription.setAttribute('content', description);

      // Update og:title
      let ogTitle = document.querySelector('meta[property="og:title"]');
      if (!ogTitle) {
        ogTitle = document.createElement('meta');
        ogTitle.setAttribute('property', 'og:title');
        document.head.appendChild(ogTitle);
      }
      ogTitle.setAttribute('content', title);

      // Update og:description
      let ogDesc = document.querySelector('meta[property="og:description"]');
      if (!ogDesc) {
        ogDesc = document.createElement('meta');
        ogDesc.setAttribute('property', 'og:description');
        document.head.appendChild(ogDesc);
      }
      ogDesc.setAttribute('content', description);

      // Update og:image
      let ogImg = document.querySelector('meta[property="og:image"]');
      if (!ogImg) {
        ogImg = document.createElement('meta');
        ogImg.setAttribute('property', 'og:image');
        document.head.appendChild(ogImg);
      }
      ogImg.setAttribute('content', ogImage);

      // Update favicon
      let faviconLink = document.querySelector('link[rel="icon"]') as HTMLLinkElement;
      if (!faviconLink) {
        faviconLink = document.createElement('link');
        faviconLink.rel = 'icon';
        faviconLink.type = 'image/png';
        document.head.appendChild(faviconLink);
      }
      faviconLink.href = favicon;
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

  const validProducts = useMemo(() => {
    return products.filter(p => 
      p && p.id && p.name && p.resellerId && p.active !== false
    );
  }, [products]);

  const filteredProducts = useMemo(() => {
    let filtered = validProducts;
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
  }, [validProducts, selectedCategory, searchQuery]);

  const productsWithDiscount = useMemo(() => {
    return validProducts.filter(p => Number(p.originalPrice) > Number(p.currentPrice));
  }, [validProducts]);

  const handleBuyClick = (product: Product) => {
    const productWithSeller = {
      ...product,
      resellerId: reseller?.id || product.resellerId
    };
    addToCartOnce(productWithSeller);
    setTimeout(() => {
      setIsCheckoutOpen(true);
    }, 50);
  };

  const themeColor = reseller?.themeColor || "#a855f7";
  const buttonColor = reseller?.buttonColor || themeColor;
  const backgroundColor = reseller?.backgroundColor || "#111827";
  const textColor = reseller?.textColor || "#FFFFFF";
  const cardBackgroundColor = reseller?.cardBackgroundColor || "#1a1a2e";
  const secondaryColor = reseller?.secondaryColor || "#6366F1";

  // Debug: Log theme data received from API
  console.log('TEMA RECEBIDO:', {
    themeColor,
    buttonColor,
    backgroundColor,
    textColor,
    cardBackgroundColor,
    secondaryColor,
    rawReseller: reseller,
  });

  const cssVariables = {
    '--primary': buttonColor,
    '--bg': backgroundColor,
    '--card': cardBackgroundColor,
    '--text': textColor,
    '--secondary': secondaryColor,
  } as React.CSSProperties;

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

      <div className="min-h-screen relative" style={{ ...cssVariables, backgroundColor: 'var(--bg)' }}>
        <div className="network-bg" />

        <div className="relative z-10">
          <AnnouncementBar resellerId={reseller.id} />

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
                <div className="flex flex-col">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-base sm:text-lg" style={{ color: textColor }} data-testid="text-store-name">
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
                  {sellerStats && (sellerStats.totalReviews > 0 || sellerStats.totalSales > 0) && (
                    <div className="flex items-center gap-3 text-xs text-gray-400" data-testid="seller-stats">
                      {sellerStats.totalReviews > 0 && (
                        <div className="flex items-center gap-1">
                          <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
                          <span>{sellerStats.averageRating}</span>
                          <span className="text-gray-500">({sellerStats.totalReviews})</span>
                        </div>
                      )}
                      {sellerStats.positivePercent > 0 && (
                        <div className="flex items-center gap-1">
                          <ThumbsUp className="w-3 h-3 text-green-400" />
                          <span>{sellerStats.positivePercent}%</span>
                        </div>
                      )}
                      {sellerStats.totalSales > 0 && (
                        <div className="flex items-center gap-1">
                          <ShoppingBag className="w-3 h-3" />
                          <span>{sellerStats.totalSales} vendas</span>
                        </div>
                      )}
                    </div>
                  )}
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
                  <ShoppingCart className="w-5 h-5" style={{ color: buttonColor }} />
                  {cartCount > 0 && (
                    <span 
                      className="absolute -top-1 -right-1 w-5 h-5 rounded-full text-xs font-bold text-white flex items-center justify-center"
                      style={{ backgroundColor: buttonColor }}
                    >
                      {cartCount}
                    </span>
                  )}
                </Button>
              </div>
            </div>
          </header>

          <main className="max-w-6xl mx-auto px-4 py-6">
            {categories.length > 0 && (
              <div className="mb-8">
                <div className="section-title">
                  <Gift className="w-5 h-5" style={{ color: buttonColor }} />
                  <span style={{ color: textColor }}>{selectedCategory || "Categorias"}</span>
                </div>
                
                <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
                  <button
                    onClick={() => setSelectedCategory(null)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all whitespace-nowrap ${
                      selectedCategory === null 
                        ? "text-white shadow-lg" 
                        : "bg-white/5 text-gray-300 border border-white/10"
                    }`}
                    style={selectedCategory === null ? { backgroundColor: buttonColor } : undefined}
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
                          ? "text-white shadow-lg" 
                          : "bg-white/5 text-gray-300 border border-white/10"
                      }`}
                      style={selectedCategory === category ? { backgroundColor: buttonColor } : undefined}
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
                  <Zap className="w-5 h-5" style={{ color: buttonColor }} />
                  <span style={{ color: textColor }}>OFERTAS RELAMPAGO!!</span>
                  <span className="flash-sale-badge ml-2" style={{ backgroundColor: buttonColor }}>Hot</span>
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
                        style={{ backgroundColor: cardBackgroundColor }}
                        data-testid={`card-flash-${product.id}`}
                      >
                        <div 
                          className="relative aspect-video overflow-hidden cursor-pointer rounded-lg bg-gray-900"
                          onClick={() => window.location.href = `/loja/${slug}/produto/${product.id}`}
                        >
                          {product.imageUrl ? (
                            <img
                              src={product.imageUrl}
                              alt={product.name}
                              className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300"
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
                            className="font-medium text-sm mb-2 line-clamp-2 min-h-[2.5rem] cursor-pointer transition-colors"
                            style={{ color: textColor }}
                            onClick={() => window.location.href = `/loja/${slug}/produto/${product.id}`}
                          >
                            {product.name}
                          </h3>

                          <div className="flex flex-col gap-0.5 mb-3">
                            <span className="text-xs text-gray-500 line-through">
                              R$ {Number(product.originalPrice).toFixed(2)}
                            </span>
                            <div className="flex items-baseline gap-2">
                              <span className="text-lg font-bold" style={{ color: buttonColor }}>
                                R$ {Number(product.currentPrice).toFixed(2).split('.')[0]}
                              </span>
                              <span className="text-sm" style={{ color: buttonColor }}>
                                ,{Number(product.currentPrice).toFixed(2).split('.')[1]}
                              </span>
                            </div>
                          </div>

                          <div className="flex gap-2">
                            <Button
                              onClick={() => handleBuyClick(product)}
                              disabled={!hasStock}
                              className="flex-1 text-xs font-semibold"
                              style={{ backgroundColor: buttonColor, color: "#FFFFFF" }}
                              data-testid={`button-flash-buy-${product.id}`}
                            >
                              Comprar
                            </Button>
                            <Button
                              size="icon"
                              variant="outline"
                              className="border-white/20"
                              onClick={() => handleBuyClick(product)}
                              disabled={!hasStock}
                              data-testid={`button-flash-cart-${product.id}`}
                            >
                              <ShoppingCart className="w-4 h-4" style={{ color: buttonColor }} />
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
                <Package className="w-5 h-5" style={{ color: buttonColor }} />
                <span style={{ color: textColor }}>{selectedCategory || "Todos os Produtos"}</span>
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
                        style={{ backgroundColor: cardBackgroundColor }}
                        data-testid={`card-product-${product.id}`}
                      >
                        <div 
                          className="relative aspect-video overflow-hidden cursor-pointer rounded-lg bg-gray-900"
                          onClick={() => window.location.href = `/loja/${slug}/produto/${product.id}`}
                        >
                          {product.imageUrl ? (
                            <img
                              src={product.imageUrl}
                              alt={product.name}
                              className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300"
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
                            className="font-medium text-sm mb-2 line-clamp-2 min-h-[2.5rem] cursor-pointer transition-colors"
                            style={{ color: textColor }}
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
                              <span className="text-lg font-bold" style={{ color: buttonColor }}>
                                R$ {Number(product.currentPrice).toFixed(2).split('.')[0]}
                              </span>
                              <span className="text-sm" style={{ color: buttonColor }}>
                                ,{Number(product.currentPrice).toFixed(2).split('.')[1]}
                              </span>
                            </div>
                            <span className="text-xs text-gray-500">A vista no PIX</span>
                          </div>

                          <div className="flex gap-2">
                            <Button
                              onClick={() => handleBuyClick(product)}
                              disabled={!hasStock}
                              className="flex-1 text-xs font-semibold"
                              style={{ backgroundColor: buttonColor, color: "#FFFFFF" }}
                              data-testid={`button-buy-${product.id}`}
                            >
                              Comprar
                            </Button>
                            <Button
                              size="icon"
                              variant="outline"
                              className="border-white/20"
                              onClick={() => handleBuyClick(product)}
                              disabled={!hasStock}
                              data-testid={`button-cart-${product.id}`}
                            >
                              <ShoppingCart className="w-4 h-4" style={{ color: buttonColor }} />
                            </Button>
                          </div>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>

            {sellerReviews.length > 0 && (
              <div className="mt-8">
                <div className="section-title">
                  <Star className="w-5 h-5" style={{ color: buttonColor }} />
                  <span style={{ color: textColor }}>Avaliacoes Recentes</span>
                  <span className="text-sm font-normal text-gray-400 ml-2">
                    ({sellerReviews.length} {sellerReviews.length === 1 ? "avaliacao" : "avaliacoes"})
                  </span>
                </div>
                
                <div className="grid gap-4">
                  {sellerReviews.slice(0, 6).map((review) => (
                    <Card key={review.id} style={{ backgroundColor: cardBackgroundColor }} className="p-4" data-testid={`card-review-${review.id}`}>
                      <div className="flex items-start gap-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <div className="flex">
                              {[1, 2, 3, 4, 5].map((star) => (
                                <Star
                                  key={star}
                                  className={`w-4 h-4 ${star <= review.rating ? "text-yellow-400 fill-yellow-400" : "text-gray-600"}`}
                                />
                              ))}
                            </div>
                            {review.productName && (
                              <span className="text-sm text-gray-400">- {review.productName}</span>
                            )}
                          </div>
                          {review.comment && (
                            <p className="text-sm" style={{ color: textColor }}>{review.comment}</p>
                          )}
                          <p className="text-xs text-gray-500 mt-1">
                            {new Date(review.createdAt).toLocaleDateString('pt-BR')}
                          </p>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </main>

          <footer className="mt-16 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-purple-950/20 to-transparent" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom,_var(--tw-gradient-stops))] from-purple-900/20 via-transparent to-transparent" />
            
            <div className="relative z-10 border-t border-purple-500/20">
              <div className="max-w-6xl mx-auto px-4 py-12">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
                  <div className="md:col-span-1">
                    <div className="flex items-center gap-3 mb-4">
                      {reseller.logoUrl ? (
                        <img 
                          src={reseller.logoUrl} 
                          alt={reseller.storeName || "Logo"} 
                          className="w-12 h-12 rounded-xl object-cover ring-2 ring-purple-500/30"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-gradient-to-br from-purple-600 to-pink-600 ring-2 ring-purple-500/30">
                          <Store className="w-6 h-6 text-white" />
                        </div>
                      )}
                      <div>
                        <span className="font-bold text-white text-xl block">{reseller.storeName}</span>
                        <div className="flex items-center gap-1">
                          <svg className="w-4 h-4 text-blue-400" viewBox="0 0 24 24" fill="currentColor">
                            <circle cx="12" cy="12" r="10" />
                            <path d="M9 12l2 2 4-4" stroke="white" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                          <span className="text-xs text-blue-400">Loja Verificada</span>
                        </div>
                      </div>
                    </div>
                    <p className="text-gray-400 text-sm leading-relaxed">
                      Produtos digitais confiaveis com entrega instantanea. Qualidade e seguranca garantidas.
                    </p>
                  </div>

                  <div>
                    <h4 className="text-white font-semibold text-sm uppercase tracking-wider mb-5 flex items-center gap-2">
                      <Headphones className="w-4 h-4 text-purple-400" />
                      Atendimento
                    </h4>
                    <div className="space-y-4">
                      <a 
                        href="mailto:suporte@nexstore.com"
                        className="flex items-center gap-3 text-gray-300 text-sm hover:text-purple-400 transition-all group"
                        data-testid="link-support-email"
                      >
                        <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center group-hover:bg-purple-500/20 transition-colors">
                          <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                          </svg>
                        </div>
                        <div>
                          <span className="block text-xs text-gray-500">Email</span>
                          <span>suporte@nexstore.com</span>
                        </div>
                      </a>
                      <a 
                        href="https://wa.me/5500000000000"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-3 text-gray-300 text-sm hover:text-green-400 transition-all group"
                        data-testid="link-whatsapp"
                      >
                        <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center group-hover:bg-green-500/20 transition-colors">
                          <svg className="w-5 h-5 text-green-400" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                          </svg>
                        </div>
                        <div>
                          <span className="block text-xs text-gray-500">WhatsApp</span>
                          <span>Suporte 24/7</span>
                        </div>
                      </a>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-white font-semibold text-sm uppercase tracking-wider mb-5 flex items-center gap-2">
                      <svg className="w-4 h-4 text-purple-400" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z"/>
                      </svg>
                      Seguranca
                    </h4>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex items-center gap-2 bg-white/5 rounded-lg px-3 py-2.5 border border-white/5">
                        <div className="w-8 h-8 rounded-md bg-green-500/20 flex items-center justify-center">
                          <svg className="w-4 h-4 text-green-400" viewBox="0 0 512 512" fill="currentColor">
                            <path d="M242.4 292.5C247.8 287.1 257.1 287.1 262.5 292.5L339.5 369.5C347.3 377.3 347.3 389.7 339.5 397.5L262.5 474.5C257.1 479.9 247.8 479.9 242.4 474.5C237 469.1 237 459.8 242.4 454.4L303.8 393L242.4 331.6C237 326.2 237 316.9 242.4 311.5C247.8 306.1 257.1 306.1 262.5 311.5L339.5 388.5C347.3 396.3 347.3 408.7 339.5 416.5C331.7 424.3 319.3 424.3 311.5 416.5L234.5 339.5C226.7 331.7 226.7 319.3 234.5 311.5L262.5 283.5C257.1 278.1 247.8 278.1 242.4 283.5L172.5 353.4C167.1 358.8 157.8 358.8 152.4 353.4C147 348 147 338.7 152.4 333.3L222.3 263.4C227.7 258 237 258 242.4 263.4Z"/>
                          </svg>
                        </div>
                        <span className="text-xs text-gray-300">Pix</span>
                      </div>
                      <div className="flex items-center gap-2 bg-white/5 rounded-lg px-3 py-2.5 border border-white/5">
                        <div className="w-8 h-8 rounded-md bg-blue-500/20 flex items-center justify-center">
                          <svg className="w-4 h-4 text-blue-400" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M20 4H4c-1.11 0-1.99.89-1.99 2L2 18c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V6c0-1.11-.89-2-2-2zm0 14H4v-6h16v6zm0-10H4V6h16v2z"/>
                          </svg>
                        </div>
                        <span className="text-xs text-gray-300">Cartao</span>
                      </div>
                      <div className="flex items-center gap-2 bg-white/5 rounded-lg px-3 py-2.5 border border-white/5">
                        <div className="w-8 h-8 rounded-md bg-yellow-500/20 flex items-center justify-center">
                          <svg className="w-4 h-4 text-yellow-400" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z"/>
                          </svg>
                        </div>
                        <span className="text-xs text-gray-300">Seguro</span>
                      </div>
                      <div className="flex items-center gap-2 bg-white/5 rounded-lg px-3 py-2.5 border border-white/5">
                        <div className="w-8 h-8 rounded-md bg-purple-500/20 flex items-center justify-center">
                          <svg className="w-4 h-4 text-purple-400" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/>
                          </svg>
                        </div>
                        <span className="text-xs text-gray-300">SSL</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-10 pt-8 border-t border-white/5">
                  <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                    <p className="text-gray-500 text-xs">
                      © {new Date().getFullYear()} {reseller.storeName} — Todos os direitos reservados
                    </p>
                    <div className="flex items-center gap-1 text-xs text-gray-600">
                      <Zap className="w-3 h-3 text-purple-500" />
                      <span>Entrega automatica instantanea</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </footer>
        </div>
      </div>
    </>
  );
}
