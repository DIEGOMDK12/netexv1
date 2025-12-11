import { useState } from "react";
import { useLocation, useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ShoppingCart, Zap, Shield, Star, User, CheckCircle, MessageCircle, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CheckoutModal } from "@/components/checkout-modal";
import { ProductCard } from "@/components/product-card";
import { useStore } from "@/lib/store-context";
import { useToast } from "@/hooks/use-toast";
import { SiPix } from "react-icons/si";
import type { Product, Settings, Reseller, Review, ProductVariant } from "@shared/schema";

export default function ProductDetails() {
  const [, setLocation] = useLocation();
  const [match, params] = useRoute("/product/:id");
  const { addToCart, addToCartOnce, setIsCartOpen } = useStore();
  const { toast } = useToast();
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [selectedVariantId, setSelectedVariantId] = useState<number | null>(null);

  const isLoggedIn = () => {
    const vendorId = localStorage.getItem("vendor_id");
    const vendorToken = localStorage.getItem("vendor_token");
    return !!vendorId && !!vendorToken;
  };

  const productId = params?.id ? String(params.id) : null;

  const { data: product, isLoading } = useQuery<Product>({
    queryKey: [`/api/products/${productId}`],
    enabled: !!productId,
  });

  const { data: allProducts } = useQuery<Product[]>({
    queryKey: ["/api/products"],
  });

  const { data: settings } = useQuery<Settings>({
    queryKey: ["/api/settings"],
  });

  const { data: reseller } = useQuery<Reseller>({
    queryKey: ["/api/resellers", product?.resellerId],
    enabled: !!product?.resellerId,
  });

  const { data: reviews } = useQuery<Review[]>({
    queryKey: ["/api/reviews/product", productId],
    enabled: !!productId,
  });

  // Fetch seller stats (rating, sales, positive %)
  const { data: sellerStats } = useQuery<{ averageRating: number; totalReviews: number; positivePercent: number; totalSales: number }>({
    queryKey: ["/api/seller", product?.resellerId, "stats"],
    enabled: !!product?.resellerId,
  });

  // Fetch product variants for products with dynamicMode
  const { data: variants } = useQuery<ProductVariant[]>({
    queryKey: ["/api/products", productId, "variants"],
    enabled: !!productId && !!product?.dynamicMode,
  });

  const themeColor = "#2563eb";
  const textColor = "#FFFFFF";

  const relatedProducts = (allProducts || [])
    .filter((p) => p.id !== parseInt(productId || "0") && p.active)
    .sort(() => Math.random() - 0.5)
    .slice(0, 4);

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-[#0f172a] text-white">Carregando...</div>;
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-[#0f172a]">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <Button variant="ghost" onClick={() => setLocation("/")} className="text-white mb-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar
          </Button>
          <p className="text-white">Produto não encontrado (ID: {productId})</p>
        </div>
      </div>
    );
  }

  // For products with variants (dynamicMode), check variant stock
  const activeVariants = (variants || []).filter((v: ProductVariant) => v.active !== false);
  const selectedVariant = selectedVariantId 
    ? activeVariants.find((v: ProductVariant) => v.id === selectedVariantId)
    : null;

  // Calculate stock based on mode
  let hasStock = false;
  let stockLines: string[] = [];
  let totalVariantStock = 0;
  
  if (product.dynamicMode && activeVariants.length > 0) {
    // For variant-based products, check if any variant has stock
    totalVariantStock = activeVariants.reduce((acc: number, v: ProductVariant) => {
      const vLines = v.stock?.split("\n").filter((line: string) => line.trim()) || [];
      return acc + vLines.length;
    }, 0);
    hasStock = totalVariantStock > 0;
    // Show selected variant stock or total stock
    if (selectedVariant) {
      stockLines = selectedVariant.stock?.split("\n").filter((line: string) => line.trim()) || [];
    } else {
      // When no variant selected, create dummy array for count display only
      stockLines = Array(totalVariantStock).fill("_placeholder");
    }
  } else {
    stockLines = product.stock?.split("\n").filter((line) => line.trim()) || [];
    hasStock = stockLines.length > 0;
  }
  
  const hasDiscount = Number(product.originalPrice) > Number(product.currentPrice);
  
  // For variant products, show the selected variant price or "A partir de" + lowest price
  const displayPrice = selectedVariant 
    ? Number(selectedVariant.price).toFixed(2)
    : Number(product.currentPrice).toFixed(2);

  // For dynamic mode products, require variant selection
  const requiresVariantSelection = product.dynamicMode && activeVariants.length > 0;
  // For variant products: need a variant selected AND that variant must have real stock (not placeholders)
  const selectedVariantHasStock = selectedVariant 
    ? (selectedVariant.stock?.split("\n").filter((line: string) => line.trim()).length || 0) > 0
    : false;
  const canPurchase = requiresVariantSelection 
    ? (!!selectedVariant && selectedVariantHasStock)
    : hasStock;

  const handleAddToCart = () => {
    if (!isLoggedIn()) {
      toast({
        title: "Faça login para comprar",
        description: "Entre na sua conta ou cadastre-se para continuar",
      });
      setLocation("/login");
      return;
    }
    if (requiresVariantSelection && !selectedVariant) {
      toast({
        title: "Selecione uma opcao",
        description: "Por favor, selecione uma das opcoes disponiveis",
      });
      return;
    }
    if (canPurchase) {
      // For variant products, pass variant info to cart
      const productWithVariant = requiresVariantSelection && selectedVariant
        ? { ...product, currentPrice: selectedVariant.price, variantId: selectedVariant.id, variantName: selectedVariant.name }
        : product;
      addToCart(productWithVariant);
      setIsCartOpen(true);
    }
  };

  const handleBuyNow = () => {
    if (!isLoggedIn()) {
      toast({
        title: "Faça login para comprar",
        description: "Entre na sua conta ou cadastre-se para continuar",
      });
      setLocation("/login");
      return;
    }
    if (requiresVariantSelection && !selectedVariant) {
      toast({
        title: "Selecione uma opcao",
        description: "Por favor, selecione uma das opcoes disponiveis",
      });
      return;
    }
    if (canPurchase) {
      // For variant products, pass variant info to cart
      const productWithVariant = requiresVariantSelection && selectedVariant
        ? { ...product, currentPrice: selectedVariant.price, variantId: selectedVariant.id, variantName: selectedVariant.name }
        : product;
      addToCartOnce(productWithVariant);
      setIsCheckoutOpen(true);
    }
  };

  const sellerName = reseller?.storeName || reseller?.name || "Vendedor";

  return (
    <div className="min-h-screen bg-[#0f172a]">
      <div className="max-w-6xl mx-auto px-4 py-6 pb-8">
        <Button
          variant="ghost"
          onClick={() => setLocation("/")}
          className="text-gray-400 hover:text-white mb-4"
          data-testid="button-back"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Voltar
        </Button>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-[#1e293b] rounded-xl overflow-hidden">
              {product.imageUrl && !imgError ? (
                <img
                  src={product.imageUrl}
                  alt={product.name}
                  className="w-full aspect-video object-cover"
                  onError={() => setImgError(true)}
                  data-testid="img-product-detail"
                />
              ) : (
                <div className="w-full aspect-video flex items-center justify-center bg-gradient-to-br from-blue-900/50 to-slate-800">
                  <Package className="w-16 h-16 text-gray-600" />
                </div>
              )}
            </div>

            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-white mb-4" data-testid="text-product-title">
                {product.name}
              </h1>

              <div className="flex flex-wrap items-center gap-2 mb-4">
                <div
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full font-medium text-xs bg-green-500/20 text-green-400 border border-green-500/30"
                  data-testid="badge-delivery"
                >
                  <Zap className="w-3 h-3" />
                  Entrega Automatica
                </div>

                {product.category && (
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full font-medium text-xs bg-blue-500/20 text-blue-400 border border-blue-500/30">
                    {product.category}
                  </div>
                )}
              </div>
            </div>

            <Tabs defaultValue="description" className="w-full">
              <TabsList
                className="w-full justify-start mb-4 h-auto flex-wrap gap-1 p-1 bg-[#1e293b] rounded-lg"
              >
                <TabsTrigger
                  value="description"
                  className="data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=inactive]:text-gray-400 rounded-md px-4 py-2"
                  data-testid="tab-description"
                >
                  Descricao
                </TabsTrigger>
                <TabsTrigger
                  value="instructions"
                  className="data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=inactive]:text-gray-400 rounded-md px-4 py-2"
                  data-testid="tab-instructions"
                >
                  Suporte
                </TabsTrigger>
                <TabsTrigger
                  value="warranty"
                  className="data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=inactive]:text-gray-400 rounded-md px-4 py-2"
                  data-testid="tab-warranty"
                >
                  Termos
                </TabsTrigger>
                <TabsTrigger
                  value="reviews"
                  className="data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=inactive]:text-gray-400 rounded-md px-4 py-2"
                  data-testid="tab-reviews"
                >
                  Avaliacoes ({reviews?.length || 0})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="description" className="mt-4">
                <div
                  className="p-4 rounded-lg bg-[#1e293b] text-gray-300"
                  data-testid="content-description"
                >
                  {product.description ? (
                    <p className="whitespace-pre-wrap text-sm leading-relaxed">{product.description}</p>
                  ) : (
                    <p className="text-gray-500 italic">Nenhuma descricao disponivel para este produto.</p>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="instructions" className="mt-4">
                <div
                  className="p-4 rounded-lg bg-[#1e293b] text-gray-300"
                  data-testid="content-instructions"
                >
                  {product.instructions ? (
                    <p className="whitespace-pre-wrap text-sm leading-relaxed">{product.instructions}</p>
                  ) : (
                    <p className="text-gray-500 italic text-sm">
                      1. Apos a compra, voce recebera a chave/codigo por email<br />
                      2. Acesse a plataforma com sua conta<br />
                      3. Cole a chave no campo de ativacao<br />
                      4. Clique em "Ativar" e aproveite!
                    </p>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="warranty" className="mt-4">
                <div
                  className="p-4 rounded-lg bg-[#1e293b] text-gray-300"
                  data-testid="content-warranty"
                >
                  {product.warranty ? (
                    <p className="whitespace-pre-wrap text-sm leading-relaxed">{product.warranty}</p>
                  ) : (
                    <p className="text-gray-500 italic text-sm">
                      Garantia de suporte e reembolso total caso o produto nao funcione.
                    </p>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="reviews" className="mt-4">
                <div className="space-y-4" data-testid="content-reviews">
                  {!reviews || reviews.length === 0 ? (
                    <div className="p-4 rounded-lg bg-[#1e293b] text-gray-400 text-center text-sm">
                      Nenhuma avaliacao ainda. Seja o primeiro a avaliar este produto!
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {reviews.map((review) => (
                        <div
                          key={review.id}
                          className="p-4 rounded-lg bg-[#1e293b] border border-gray-700"
                          data-testid={`review-card-${review.id}`}
                        >
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex-1">
                              <p className="font-semibold text-white text-sm" data-testid={`review-customer-${review.id}`}>
                                {review.customerName || review.customerEmail?.split("@")[0] || "Cliente"}
                              </p>
                              <div className="flex items-center gap-1 mt-1" data-testid={`review-stars-${review.id}`}>
                                {[1, 2, 3, 4, 5].map((star) => (
                                  <Star
                                    key={star}
                                    className={`w-3 h-3 ${
                                      star <= review.rating
                                        ? "text-yellow-400 fill-yellow-400"
                                        : "text-gray-600"
                                    }`}
                                  />
                                ))}
                              </div>
                            </div>
                            <p className="text-xs text-gray-500">
                              {new Date(review.createdAt).toLocaleDateString("pt-BR")}
                            </p>
                          </div>
                          {review.comment && (
                            <p
                              className="text-sm text-gray-300 mt-2 leading-relaxed"
                              data-testid={`review-comment-${review.id}`}
                            >
                              {review.comment}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </div>

          <div className="space-y-4">
            <div className="bg-[#1e293b] rounded-xl p-4" data-testid="card-seller">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
                  {reseller?.logoUrl ? (
                    <img src={reseller.logoUrl} alt={sellerName} className="w-full h-full rounded-full object-cover" />
                  ) : (
                    <User className="w-6 h-6 text-white" />
                  )}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-white" data-testid="text-seller-name">{sellerName}</span>
                    <CheckCircle className="w-4 h-4 text-blue-500" />
                  </div>
                  <div className="flex items-center gap-1 text-xs text-green-400">
                    <span className="w-2 h-2 rounded-full bg-green-400"></span>
                    Online
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center mb-4">
                <div className="bg-[#0f172a] rounded-lg p-2">
                  <div className="text-lg font-bold text-white" data-testid="text-seller-rating">
                    {sellerStats?.averageRating?.toFixed(1) || "0.0"}
                  </div>
                  <div className="text-xs text-gray-500">Avaliacao</div>
                </div>
                <div className="bg-[#0f172a] rounded-lg p-2">
                  <div className="text-lg font-bold text-white" data-testid="text-seller-sales">
                    {sellerStats?.totalSales || 0}
                  </div>
                  <div className="text-xs text-gray-500">Vendas</div>
                </div>
                <div className="bg-[#0f172a] rounded-lg p-2">
                  <div className="text-lg font-bold text-white" data-testid="text-seller-positive">
                    {sellerStats?.positivePercent || 0}%
                  </div>
                  <div className="text-xs text-gray-500">Positivo</div>
                </div>
              </div>

              <Button 
                variant="outline" 
                className="w-full border-gray-600 text-gray-300 hover:bg-gray-700"
                data-testid="button-contact-seller"
              >
                <MessageCircle className="w-4 h-4 mr-2" />
                Contatar Vendedor
              </Button>
            </div>

            <div className="bg-[#1e293b] rounded-xl p-4" data-testid="card-purchase">
              {/* Variant selector for dynamic mode products */}
              {product.dynamicMode && activeVariants.length > 0 && (
                <div className="mb-4">
                  <label className="text-sm text-gray-400 mb-2 block">Selecione uma opcao:</label>
                  <div className="grid gap-2" data-testid="variant-selector">
                    {activeVariants.map((variant: ProductVariant) => {
                      const variantStockCount = variant.stock?.split("\n").filter((line: string) => line.trim()).length || 0;
                      const isSelected = selectedVariant?.id === variant.id;
                      const isAvailable = variantStockCount > 0;
                      
                      return (
                        <button
                          key={variant.id}
                          onClick={() => setSelectedVariantId(variant.id)}
                          disabled={!isAvailable}
                          className={`flex items-center justify-between p-3 rounded-lg border transition-all
                            ${isSelected 
                              ? 'border-blue-500 bg-blue-500/20' 
                              : 'border-gray-600 hover:border-blue-400'
                            }
                            ${!isAvailable ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                          `}
                          data-testid={`variant-option-${variant.id}`}
                        >
                          <div className="flex flex-col items-start">
                            <span className="text-white font-medium text-sm">{variant.name}</span>
                            <span className="text-xs text-gray-400">
                              {isAvailable ? `${variantStockCount} em estoque` : 'Esgotado'}
                            </span>
                          </div>
                          <span className="text-blue-400 font-bold">
                            R$ {Number(variant.price).toFixed(2)}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="mb-4">
                {hasDiscount && (
                  <p className="text-sm line-through text-gray-500" data-testid="text-original-price">
                    R$ {Number(product.originalPrice).toFixed(2)}
                  </p>
                )}
                <p className="text-3xl font-bold text-blue-500" data-testid="text-current-price">
                  {product.dynamicMode && activeVariants.length > 0 && !selectedVariantId && "A partir de "}
                  R$ {displayPrice}
                </p>
              </div>

              <div className="flex items-center gap-2 mb-4 text-sm" data-testid="text-stock-status">
                {hasStock ? (
                  <>
                    <span className="w-2 h-2 rounded-full bg-green-400"></span>
                    <span className="text-green-400">Disponivel:</span>
                    <span className="text-white">{stockLines.length} unidades</span>
                  </>
                ) : (
                  <>
                    <span className="w-2 h-2 rounded-full bg-red-400"></span>
                    <span className="text-red-400">Indisponivel</span>
                  </>
                )}
              </div>

              <Button
                onClick={handleBuyNow}
                disabled={!canPurchase}
                className="w-full py-2 text-sm font-bold rounded-lg transition-all bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600"
                data-testid="button-buy-now-desktop"
              >
                {requiresVariantSelection && !selectedVariant ? "SELECIONE UMA OPCAO" : "COMPRAR"}
              </Button>
            </div>

            <div className="bg-[#1e293b] rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-3 text-sm">
                <Shield className="w-5 h-5 text-green-500 flex-shrink-0" />
                <span className="text-gray-300">Compra Segura</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <Zap className="w-5 h-5 text-yellow-500 flex-shrink-0" />
                <span className="text-gray-300">Entrega Imediata</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <SiPix className="w-5 h-5 text-[#32BCAD] flex-shrink-0" />
                <span className="text-gray-300">Pagamento via PIX</span>
              </div>
            </div>
          </div>
        </div>

        {relatedProducts.length > 0 && (
          <div className="mt-12">
            <h2 className="text-xl font-bold text-white mb-6">Produtos Relacionados</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {relatedProducts.map((p) => (
                <ProductCard
                  key={p.id}
                  product={p}
                  themeColor={themeColor}
                  textColor={textColor}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      <CheckoutModal 
        open={isCheckoutOpen} 
        onClose={() => setIsCheckoutOpen(false)} 
      />
    </div>
  );
}
