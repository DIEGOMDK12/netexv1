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
import { SiPix } from "react-icons/si";
import type { Product, Settings, Reseller } from "@shared/schema";

export default function ProductDetails() {
  const [, setLocation] = useLocation();
  const [match, params] = useRoute("/product/:id");
  const { addToCart, setIsCartOpen } = useStore();
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [imgError, setImgError] = useState(false);

  const productId = params?.id ? String(params.id) : null;

  console.log("Product ID from URL:", productId);

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

  // Fetch reseller info for the product
  const { data: reseller } = useQuery<Reseller>({
    queryKey: ["/api/resellers", product?.resellerId],
    enabled: !!product?.resellerId,
  });

  const themeColor = "#2563eb"; // NEX STORE blue
  const textColor = "#FFFFFF";

  // Get related products (random 2-4 products excluding current)
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

  const stockLines = product.stock?.split("\n").filter((line) => line.trim()) || [];
  const hasStock = stockLines.length > 0;
  const hasDiscount = Number(product.originalPrice) > Number(product.currentPrice);

  const handleAddToCart = () => {
    if (hasStock) {
      addToCart(product);
      setIsCartOpen(true);
    }
  };

  const handleBuyNow = () => {
    if (hasStock) {
      addToCart(product);
      setIsCheckoutOpen(true);
    }
  };

  const sellerName = reseller?.storeName || reseller?.name || "Vendedor";

  return (
    <div className="min-h-screen bg-[#0f172a]">
      <div className="max-w-6xl mx-auto px-4 py-6 pb-40 md:pb-8">
        {/* Back Button */}
        <Button
          variant="ghost"
          onClick={() => setLocation("/")}
          className="text-gray-400 hover:text-white mb-4"
          data-testid="button-back"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Voltar
        </Button>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Product Image & Info */}
          <div className="lg:col-span-2 space-y-6">
            {/* Product Image */}
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

            {/* Product Title & Badges */}
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-white mb-4" data-testid="text-product-title">
                {product.name}
              </h1>

              <div className="flex flex-wrap items-center gap-2 mb-4">
                {/* Badge: Entrega Automática */}
                <div
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full font-medium text-xs bg-green-500/20 text-green-400 border border-green-500/30"
                  data-testid="badge-delivery"
                >
                  <Zap className="w-3 h-3" />
                  Entrega Automatica
                </div>

                {/* Badge: Category */}
                {product.category && (
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full font-medium text-xs bg-blue-500/20 text-blue-400 border border-blue-500/30">
                    {product.category}
                  </div>
                )}
              </div>
            </div>

            {/* Tabs Section */}
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
              </TabsList>

              {/* Description Tab */}
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

              {/* Instructions Tab */}
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

              {/* Warranty Tab */}
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
            </Tabs>
          </div>

          {/* Right Column - Seller Box & Purchase Panel */}
          <div className="space-y-4">
            {/* Seller Box */}
            <div className="bg-[#1e293b] rounded-xl p-4" data-testid="card-seller">
              <div className="flex items-center gap-3 mb-4">
                {/* Seller Avatar */}
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

              {/* Seller Stats */}
              <div className="grid grid-cols-3 gap-2 text-center mb-4">
                <div className="bg-[#0f172a] rounded-lg p-2">
                  <div className="text-lg font-bold text-white">4.8</div>
                  <div className="text-xs text-gray-500">Avaliacao</div>
                </div>
                <div className="bg-[#0f172a] rounded-lg p-2">
                  <div className="text-lg font-bold text-white">147</div>
                  <div className="text-xs text-gray-500">Vendas</div>
                </div>
                <div className="bg-[#0f172a] rounded-lg p-2">
                  <div className="text-lg font-bold text-white">98%</div>
                  <div className="text-xs text-gray-500">Positivo</div>
                </div>
              </div>

              {/* Contact Seller Button */}
              <Button 
                variant="outline" 
                className="w-full border-gray-600 text-gray-300 hover:bg-gray-700"
                data-testid="button-contact-seller"
              >
                <MessageCircle className="w-4 h-4 mr-2" />
                Contatar Vendedor
              </Button>
            </div>

            {/* Purchase Panel */}
            <div className="bg-[#1e293b] rounded-xl p-4" data-testid="card-purchase">
              {/* Price */}
              <div className="mb-4">
                {hasDiscount && (
                  <p className="text-sm line-through text-gray-500" data-testid="text-original-price">
                    R$ {Number(product.originalPrice).toFixed(2)}
                  </p>
                )}
                <p className="text-3xl font-bold text-blue-500" data-testid="text-current-price">
                  R$ {Number(product.currentPrice).toFixed(2)}
                </p>
              </div>

              {/* Stock Status */}
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

              {/* Buy Button */}
              <Button
                onClick={handleBuyNow}
                disabled={!hasStock}
                className="w-full py-2 text-sm font-bold rounded-lg transition-all bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600"
                data-testid="button-buy-now-desktop"
              >
                COMPRAR
              </Button>
            </div>

            {/* Trust Badges */}
            <div className="bg-[#1e293b] rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-3 text-sm">
                <Shield className="w-5 h-5 text-green-500 flex-shrink-0" />
                <span className="text-gray-300">Compra Segura</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <Zap className="w-5 h-5 text-blue-500 flex-shrink-0" />
                <span className="text-gray-300">Entrega Automatica</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <SiPix className="w-5 h-5 text-green-400 flex-shrink-0" />
                <span className="text-gray-300">PIX ou Cartao</span>
              </div>
            </div>
          </div>
        </div>

        {/* Related Products Section */}
        {relatedProducts.length > 0 && (
          <div className="mt-12">
            <h2 className="text-xl font-bold text-white mb-6" data-testid="section-related-products">
              Voce tambem pode gostar
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {relatedProducts.map((relatedProduct) => (
                <ProductCard
                  key={relatedProduct.id}
                  product={relatedProduct}
                  themeColor={themeColor}
                  textColor={textColor}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Checkout Modal */}
      <CheckoutModal
        open={isCheckoutOpen}
        onClose={() => setIsCheckoutOpen(false)}
        themeColor={themeColor}
        textColor={textColor}
      />
    </div>
  );
}
