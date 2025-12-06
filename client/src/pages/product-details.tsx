import { useState } from "react";
import { useLocation, useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ShoppingCart, Zap, Shield, Star, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CheckoutModal } from "@/components/checkout-modal";
import { ProductCard } from "@/components/product-card";
import { useStore } from "@/lib/store-context";
import { SiPix } from "react-icons/si";
import type { Product, Settings } from "@shared/schema";

export default function ProductDetails() {
  const [, setLocation] = useLocation();
  const [match, params] = useRoute("/product/:id");
  const { addToCart, setIsCartOpen } = useStore();
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);

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

  const themeColor = settings?.themeColor || "#3B82F6";
  const textColor = settings?.textColor || "#FFFFFF";

  // Get related products (random 2-4 products excluding current)
  const relatedProducts = (allProducts || [])
    .filter((p) => p.id !== parseInt(productId || "0") && p.active)
    .sort(() => Math.random() - 0.5)
    .slice(0, 4);

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#121212" }}>Carregando...</div>;
  }

  if (!product) {
    return (
      <div style={{ backgroundColor: "#121212" }}>
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

  return (
    <div style={{ backgroundColor: "#121212" }}>
      <div className="max-w-5xl mx-auto px-4 py-8 pb-40 md:pb-8">
        {/* Back Button */}
        <Button
          variant="ghost"
          onClick={() => setLocation("/")}
          className="text-white mb-6 hover:bg-zinc-800"
          data-testid="button-back"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Voltar
        </Button>

        {/* Product Image - Full Width at Top */}
        <div className="mb-8 flex items-center justify-center">
          {product.imageUrl ? (
            <img
              src={product.imageUrl}
              alt={product.name}
              className="w-full max-h-96 object-cover rounded-lg"
              data-testid="img-product-detail"
            />
          ) : (
            <div
              className="w-full h-96 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: "#1E1E1E" }}
            >
              <ShoppingCart className="w-16 h-16 text-zinc-600" />
            </div>
          )}
        </div>

        {/* Product Info Section */}
        <div className="mb-8">
          {/* Title */}
          <h1 className="text-4xl font-bold mb-6" style={{ color: themeColor }} data-testid="text-product-title">
            {product.name}
          </h1>

          {/* Badge: Entrega Automática */}
          <div
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full font-semibold text-sm mb-6"
            style={{ backgroundColor: "#10B981", color: "#FFFFFF" }}
            data-testid="badge-delivery"
          >
            <Zap className="w-4 h-4" />
            Entrega Automática
          </div>

          {/* Stock Status */}
          <p className="mb-6 text-lg font-semibold" data-testid="text-stock-status">
            <span className="text-green-400">🟢 Disponível: </span>
            <span style={{ color: textColor }}>{hasStock ? `${stockLines.length} unidades` : "Indisponível"}</span>
          </p>

          {/* Price Section */}
          <div className="mb-8">
            {hasDiscount && (
              <p className="text-lg line-through text-gray-400 mb-2" data-testid="text-original-price">
                R$ {Number(product.originalPrice).toFixed(2)}
              </p>
            )}
            <p className="text-5xl font-bold" style={{ color: themeColor }} data-testid="text-current-price">
              R$ {Number(product.currentPrice).toFixed(2)}
            </p>
          </div>
        </div>

        {/* Desktop Buttons - Inside Content */}
        <div className="hidden md:block mb-8">
          <div className="space-y-3">
            {/* PRIMARY: Add to Cart */}
            <Button
              onClick={handleAddToCart}
              disabled={!hasStock}
              className="w-full py-3 text-white font-bold rounded-lg transition-all"
              style={{
                backgroundColor: hasStock ? "#10B981" : "#4B5563",
              }}
              data-testid="button-add-to-cart-primary"
            >
              <ShoppingCart className="w-4 h-4 mr-2" />
              Adicionar ao Carrinho
            </Button>

            {/* SECONDARY: Buy Now */}
            <Button
              onClick={handleBuyNow}
              disabled={!hasStock}
              variant="outline"
              className="w-full py-3 font-bold rounded-lg transition-all"
              style={{
                borderColor: themeColor,
                color: themeColor,
                borderWidth: "2px",
              }}
              data-testid="button-buy-now-desktop"
            >
              Comprar Agora
            </Button>
          </div>
        </div>

        {/* Tabs Section */}
        <div className="mt-12 mb-12">
          <Tabs defaultValue="description" className="w-full">
            <TabsList
              className="w-full justify-start mb-6 h-auto flex-wrap gap-1 p-1"
              style={{ backgroundColor: "#1E1E1E" }}
            >
              <TabsTrigger
                value="description"
                className="data-[state=active]:text-white data-[state=inactive]:text-gray-400"
                data-testid="tab-description"
              >
                Descrição
              </TabsTrigger>
              <TabsTrigger
                value="instructions"
                className="data-[state=active]:text-white data-[state=inactive]:text-gray-400"
                data-testid="tab-instructions"
              >
                Suporte/Ativação
              </TabsTrigger>
              <TabsTrigger
                value="warranty"
                className="data-[state=active]:text-white data-[state=inactive]:text-gray-400"
                data-testid="tab-warranty"
              >
                Termos
              </TabsTrigger>
            </TabsList>

            {/* Description Tab */}
            <TabsContent value="description" className="mt-6">
              <div
                className="p-6 rounded-lg"
                style={{ backgroundColor: "#1E1E1E", color: textColor }}
                data-testid="content-description"
              >
                {product.description ? (
                  <p className="whitespace-pre-wrap text-base leading-relaxed">{product.description}</p>
                ) : (
                  <p className="text-gray-400 italic">Nenhuma descrição disponível para este produto.</p>
                )}
              </div>
            </TabsContent>

            {/* Instructions Tab */}
            <TabsContent value="instructions" className="mt-6">
              <div
                className="p-6 rounded-lg"
                style={{ backgroundColor: "#1E1E1E", color: textColor }}
                data-testid="content-instructions"
              >
                {product.instructions ? (
                  <p className="whitespace-pre-wrap text-base leading-relaxed">{product.instructions}</p>
                ) : (
                  <p className="text-gray-400 italic">
                    1. Após a compra, você receberá a chave/código por email
                    <br />
                    2. Acesse a plataforma com sua conta
                    <br />
                    3. Cole a chave no campo de ativação
                    <br />
                    4. Clique em "Ativar" e aproveite!
                  </p>
                )}
              </div>
            </TabsContent>

            {/* Warranty Tab */}
            <TabsContent value="warranty" className="mt-6">
              <div
                className="p-6 rounded-lg"
                style={{ backgroundColor: "#1E1E1E", color: textColor }}
                data-testid="content-warranty"
              >
                {product.warranty ? (
                  <p className="whitespace-pre-wrap text-base leading-relaxed">{product.warranty}</p>
                ) : (
                  <p className="text-gray-400 italic">
                    🛡️ Garantia de 7 dias para suporte e reembolso total caso o produto não funcione.
                  </p>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>

        {/* Trust & Info Section */}
        <div className="mt-12 mb-12">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Card 1: Compra Segura */}
            <div
              className="p-6 rounded-lg flex items-start gap-4"
              style={{ backgroundColor: "#1E1E1E" }}
              data-testid="card-secure-purchase"
            >
              <Shield className="w-6 h-6 flex-shrink-0" style={{ color: themeColor }} />
              <div>
                <h3 className="font-bold text-white mb-2">Compra Segura</h3>
                <p className="text-gray-400 text-sm">Sua compra é protegida por criptografia SSL e garantida.</p>
              </div>
            </div>

            {/* Card 2: Entrega Automática */}
            <div
              className="p-6 rounded-lg flex items-start gap-4"
              style={{ backgroundColor: "#1E1E1E" }}
              data-testid="card-instant-delivery"
            >
              <Truck className="w-6 h-6 flex-shrink-0" style={{ color: themeColor }} />
              <div>
                <h3 className="font-bold text-white mb-2">Entrega automática</h3>
                <p className="text-gray-400 text-sm">Receba o seu pacote imediatamente após o pagamento.</p>
              </div>
            </div>

            {/* Card 3: Métodos de Pagamentos */}
            <div
              className="p-6 rounded-lg flex items-start gap-4"
              style={{ backgroundColor: "#1E1E1E" }}
              data-testid="card-payment-methods"
            >
              <SiPix className="w-6 h-6 flex-shrink-0" style={{ color: "#10B981" }} />
              <div>
                <h3 className="font-bold text-white mb-2">Métodos de pagamentos</h3>
                <p className="text-gray-400 text-sm">À vista com PIX, Cartão de Crédito</p>
              </div>
            </div>

            {/* Card 4: Avaliações */}
            <div
              className="p-6 rounded-lg flex items-start gap-4"
              style={{ backgroundColor: "#1E1E1E" }}
              data-testid="card-ratings"
            >
              <Star className="w-6 h-6 flex-shrink-0" style={{ color: "#F59E0B" }} fill="#F59E0B" />
              <div>
                <h3 className="font-bold text-white mb-2">Avaliações</h3>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xl font-bold text-white">4.8 de 5</span>
                </div>
                <div className="flex items-center gap-1 mb-2">
                  {[...Array(5)].map((_, i) => (
                    <Star
                      key={i}
                      className="w-4 h-4"
                      style={{ color: i < 5 ? "#F59E0B" : "#4B5563" }}
                      fill={i < 5 ? "#F59E0B" : "none"}
                    />
                  ))}
                </div>
                <p className="text-gray-400 text-xs">Baseado em 147 avaliações</p>
              </div>
            </div>
          </div>
        </div>

        {/* Related Products Section */}
        {relatedProducts.length > 0 && (
          <div className="mt-16 mb-8">
            <h2 className="text-3xl font-bold mb-8" style={{ color: textColor }} data-testid="section-related-products">
              Você também pode gostar
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
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

      {/* Sticky Buttons - Fixed at Bottom on Mobile */}
      <div
        className="fixed md:hidden bottom-0 left-0 right-0 p-4 flex flex-row gap-3 z-50"
        style={{ backgroundColor: "#1A1A1A", borderTop: "1px solid rgba(255,255,255,0.1)" }}
      >
        {/* Cart Icon Button - Small Square */}
        <Button
          onClick={handleAddToCart}
          disabled={!hasStock}
          variant="outline"
          size="icon"
          className="w-16 h-12 rounded-lg flex-shrink-0 transition-all"
          style={{
            borderColor: hasStock ? "#10B981" : "#4B5563",
            color: hasStock ? "#10B981" : "#4B5563",
            borderWidth: "2px",
            backgroundColor: "transparent",
          }}
          data-testid="button-add-to-cart-mobile"
        >
          <ShoppingCart className="w-5 h-5" />
        </Button>

        {/* Buy Now Button - Dominant Wide */}
        <Button
          onClick={handleBuyNow}
          disabled={!hasStock}
          className="flex-1 py-3 text-white font-bold rounded-lg transition-all"
          style={{
            backgroundColor: hasStock ? "#10B981" : "#4B5563",
          }}
          data-testid="button-buy-now-mobile"
        >
          Comprar Agora
        </Button>
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
