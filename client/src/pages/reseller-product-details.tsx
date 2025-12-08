import { useState, useEffect } from "react";
import { useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ShoppingCart, Zap, Shield, Headphones, Clock, Check, Star, MessageCircle, ThumbsUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CheckoutModal } from "@/components/checkout-modal";
import { useStore } from "@/lib/store-context";
import { useToast } from "@/hooks/use-toast";
import { SiPix } from "react-icons/si";
import type { Product, Reseller } from "@shared/schema";

export default function ResellerProductDetails() {
  const [, params] = useRoute("/loja/:slug/produto/:productId");
  const slug = params?.slug as string;
  const productId = params?.productId as string;
  const { addToCart, cartCount, setCurrentReseller } = useStore();
  const { toast } = useToast();
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [addedToCart, setAddedToCart] = useState(false);

  const { data: reseller, isLoading: resellerLoading } = useQuery<Reseller>({
    queryKey: ["/api/reseller", slug],
    enabled: !!slug,
  });

  const { data: products = [], isLoading: productsLoading } = useQuery<Product[]>({
    queryKey: ["/api/reseller/products", slug],
    enabled: !!slug,
  });

  const product = products.find(p => p.id === parseInt(productId));
  const isLoading = resellerLoading || productsLoading;

  useEffect(() => {
    if (reseller) {
      setCurrentReseller(reseller);
    }
    return () => {
      setCurrentReseller(null);
    };
  }, [reseller, setCurrentReseller]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen" style={{ backgroundColor: "#121212" }}>
        <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!reseller || !product) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4" style={{ backgroundColor: "#121212" }}>
        <p className="text-white text-xl">Produto não encontrado</p>
        <Button onClick={() => window.location.href = `/loja/${slug}`} variant="outline">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Voltar para a loja
        </Button>
      </div>
    );
  }

  const themeColor = reseller.themeColor || "#3B82F6";
  const stockLines = product.stock?.split("\n").filter((line) => line.trim()) || [];
  const hasStock = stockLines.length > 0;

  const handleAddToCart = () => {
    if (hasStock) {
      const productWithSeller = { ...product, resellerId: reseller.id };
      addToCart(productWithSeller);
      setAddedToCart(true);
      toast({
        title: "Adicionado ao carrinho!",
        description: product.name,
      });
      setTimeout(() => setAddedToCart(false), 2000);
    }
  };

  const handleBuyNow = () => {
    if (hasStock) {
      const productWithSeller = { ...product, resellerId: reseller.id };
      addToCart(productWithSeller);
      setTimeout(() => {
        setIsCheckoutOpen(true);
      }, 50);
    }
  };

  return (
    <>
      <CheckoutModal
        open={isCheckoutOpen}
        onClose={() => setIsCheckoutOpen(false)}
        themeColor={themeColor}
        textColor="#FFFFFF"
      />

      <div className="min-h-screen pb-32 md:pb-8" style={{ backgroundColor: "#121212" }}>
        <div className="max-w-4xl mx-auto px-4 py-6">
          {/* Header with back button and cart */}
          <div className="flex items-center justify-between mb-6">
            <Button
              variant="ghost"
              onClick={() => window.location.href = `/loja/${slug}`}
              className="text-white"
              data-testid="button-back"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Voltar para {reseller.storeName}
            </Button>
            <Button
              size="icon"
              variant="ghost"
              onClick={() => setIsCheckoutOpen(true)}
              className="text-white relative"
              data-testid="button-cart-header"
            >
              <ShoppingCart className="w-5 h-5" />
              {cartCount > 0 && (
                <span 
                  className="absolute -top-1 -right-1 w-5 h-5 rounded-full text-xs flex items-center justify-center text-white"
                  style={{ backgroundColor: themeColor }}
                >
                  {cartCount}
                </span>
              )}
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Imagem do Produto */}
            <div>
              {product.imageUrl ? (
                <img
                  src={product.imageUrl}
                  alt={product.name}
                  className="w-full h-72 md:h-96 object-contain bg-gray-900 rounded-xl"
                  data-testid="img-product"
                />
              ) : (
                <div className="w-full h-72 md:h-96 rounded-xl flex items-center justify-center" style={{ backgroundColor: "#1E1E1E" }}>
                  <ShoppingCart className="w-16 h-16 text-gray-600" />
                </div>
              )}
            </div>

            {/* Informações do Produto */}
            <div className="space-y-4">
              <h1 className="text-2xl md:text-3xl font-bold text-white" data-testid="text-product-name">
                {product.name}
              </h1>

              {/* Preço */}
              <div className="flex items-center gap-3">
                <p className="text-3xl font-bold" style={{ color: themeColor }} data-testid="text-price">
                  R$ {parseFloat(product.currentPrice as any).toFixed(2)}
                </p>
                <p className="text-lg text-gray-500 line-through">
                  R$ {parseFloat(product.originalPrice as any).toFixed(2)}
                </p>
              </div>

              {/* Badges */}
              <div className="flex flex-wrap gap-2">
                <span className="inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-full bg-green-500/20 text-green-400 border border-green-500/30">
                  <Zap className="w-3 h-3" />
                  Entrega Automática
                </span>
                <span className="inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30">
                  <Headphones className="w-3 h-3" />
                  Suporte 7 dias
                </span>
                <span className={`inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-full ${hasStock ? 'bg-green-500/20 text-green-400 border-green-500/30' : 'bg-red-500/20 text-red-400 border-red-500/30'} border`}>
                  {hasStock ? `${stockLines.length} disponível` : 'Esgotado'}
                </span>
              </div>

              {/* Descrição */}
              <Card className="p-4" style={{ backgroundColor: "#1E1E1E", border: "1px solid rgba(255,255,255,0.1)" }}>
                <h3 className="text-white font-semibold mb-2">Descrição</h3>
                <p className="text-gray-400 text-sm whitespace-pre-wrap">
                  {product.description || "Sem descrição disponível."}
                </p>
              </Card>

              {/* Suporte */}
              <Card className="p-4" style={{ backgroundColor: "#1E1E1E", border: "1px solid rgba(255,255,255,0.1)" }}>
                <div className="flex items-center gap-2 mb-2">
                  <Headphones className="w-5 h-5" style={{ color: themeColor }} />
                  <h3 className="text-white font-semibold">Suporte</h3>
                </div>
                <div className="space-y-2 text-sm text-gray-400">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-blue-400" />
                    <span>7 dias de suporte após a compra</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4 text-green-400" />
                    <span>Garantia de funcionamento</span>
                  </div>
                </div>
              </Card>

              {/* Como Resgatar */}
              <Card className="p-4" style={{ backgroundColor: "#1E1E1E", border: "1px solid rgba(255,255,255,0.1)" }}>
                <h3 className="text-white font-semibold mb-2">Como Resgatar</h3>
                <ol className="text-gray-400 text-sm space-y-1 list-decimal list-inside">
                  <li>Realize o pagamento via PIX</li>
                  <li>Aguarde a confirmação automática (até 1 minuto)</li>
                  <li>Receba os dados de acesso na tela e por email</li>
                  <li>Ative seu produto seguindo as instruções</li>
                </ol>
              </Card>

              {/* Pagamento */}
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <SiPix className="w-5 h-5 text-green-500" />
                <span>Pagamento instantâneo via PIX</span>
              </div>

              {/* Avaliações de Clientes */}
              <Card className="p-4" style={{ backgroundColor: "#1E1E1E", border: "1px solid rgba(255,255,255,0.1)" }}>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <MessageCircle className="w-5 h-5" style={{ color: themeColor }} />
                    <h3 className="text-white font-semibold">Avaliações de Clientes</h3>
                  </div>
                  <div className="flex items-center gap-1">
                    <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                    <span className="text-white font-semibold">4.9</span>
                    <span className="text-gray-500 text-sm">(127)</span>
                  </div>
                </div>
                
                <div className="space-y-4">
                  <div className="border-b border-white/10 pb-3">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white text-sm font-bold">
                        M
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-white text-sm font-medium">Marcos S.</span>
                          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none">
                            <circle cx="12" cy="12" r="10" fill="#1DA1F2"/>
                            <path d="M9 12l2 2 4-4" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        </div>
                        <div className="flex items-center gap-1">
                          {[1,2,3,4,5].map(i => (
                            <Star key={i} className="w-3 h-3 text-yellow-400 fill-yellow-400" />
                          ))}
                        </div>
                      </div>
                    </div>
                    <p className="text-gray-400 text-sm">Entrega super rápida! Recebi em menos de 1 minuto após o pagamento. Recomendo muito!</p>
                    <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
                      <ThumbsUp className="w-3 h-3" />
                      <span>23 pessoas acharam útil</span>
                    </div>
                  </div>
                  
                  <div className="border-b border-white/10 pb-3">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-pink-500 to-orange-500 flex items-center justify-center text-white text-sm font-bold">
                        A
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-white text-sm font-medium">Ana Paula</span>
                          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none">
                            <circle cx="12" cy="12" r="10" fill="#1DA1F2"/>
                            <path d="M9 12l2 2 4-4" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        </div>
                        <div className="flex items-center gap-1">
                          {[1,2,3,4,5].map(i => (
                            <Star key={i} className="w-3 h-3 text-yellow-400 fill-yellow-400" />
                          ))}
                        </div>
                      </div>
                    </div>
                    <p className="text-gray-400 text-sm">Produto funcionando perfeitamente! Suporte excelente, responderam todas minhas dúvidas.</p>
                    <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
                      <ThumbsUp className="w-3 h-3" />
                      <span>18 pessoas acharam útil</span>
                    </div>
                  </div>
                  
                  <div className="pb-1">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-green-500 to-teal-500 flex items-center justify-center text-white text-sm font-bold">
                        L
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-white text-sm font-medium">Lucas M.</span>
                          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none">
                            <circle cx="12" cy="12" r="10" fill="#1DA1F2"/>
                            <path d="M9 12l2 2 4-4" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        </div>
                        <div className="flex items-center gap-1">
                          {[1,2,3,4,5].map(i => (
                            <Star key={i} className={`w-3 h-3 ${i <= 4 ? 'text-yellow-400 fill-yellow-400' : 'text-gray-600'}`} />
                          ))}
                        </div>
                      </div>
                    </div>
                    <p className="text-gray-400 text-sm">Muito bom! Já é a terceira vez que compro aqui. Sempre entrega rápida e funciona certinho.</p>
                    <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
                      <ThumbsUp className="w-3 h-3" />
                      <span>12 pessoas acharam útil</span>
                    </div>
                  </div>
                </div>
              </Card>

              {/* Botões Desktop */}
              <div className="hidden md:flex gap-3">
                <Button
                  onClick={handleAddToCart}
                  disabled={!hasStock}
                  variant="outline"
                  className="flex-1"
                  style={{ borderColor: themeColor, color: themeColor }}
                  data-testid="button-add-cart"
                >
                  <ShoppingCart className="w-4 h-4 mr-2" />
                  Adicionar ao Carrinho
                </Button>
                <Button
                  onClick={handleBuyNow}
                  disabled={!hasStock}
                  className="flex-1"
                  style={{ backgroundColor: hasStock ? themeColor : "#6B7280", color: "#FFFFFF" }}
                  data-testid="button-buy-now"
                >
                  Comprar Agora
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Botões Mobile Fixos */}
        <div
          className="fixed md:hidden bottom-0 left-0 right-0 p-4 flex gap-3 z-50"
          style={{ backgroundColor: "#1A1A1A", borderTop: "1px solid rgba(255,255,255,0.1)" }}
        >
          <Button
            onClick={handleAddToCart}
            disabled={!hasStock}
            variant="outline"
            size="icon"
            className="w-14 h-12"
            style={{ borderColor: themeColor, color: themeColor }}
            data-testid="button-add-cart-mobile"
          >
            <ShoppingCart className="w-5 h-5" />
          </Button>
          <Button
            onClick={handleBuyNow}
            disabled={!hasStock}
            className="flex-1 h-12"
            style={{ backgroundColor: hasStock ? themeColor : "#6B7280", color: "#FFFFFF" }}
            data-testid="button-buy-now-mobile"
          >
            Comprar Agora
          </Button>
        </div>
      </div>
    </>
  );
}
