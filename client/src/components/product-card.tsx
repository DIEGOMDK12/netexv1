import { useState } from "react";
import { ShoppingCart, Package } from "lucide-react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { Product } from "@shared/schema";
import { useStore } from "@/lib/store-context";

interface ProductCardProps {
  product: Product;
  seller?: number;
  themeColor?: string;
  textColor?: string;
}

export function ProductCard({ product, seller, themeColor, textColor }: ProductCardProps) {
  const { addToCart, setIsCartOpen } = useStore();
  const [, setLocation] = useLocation();
  const [imgError, setImgError] = useState(false);

  const hasDiscount = Number(product.originalPrice) > Number(product.currentPrice);
  const discountPercent = hasDiscount
    ? Math.round(
        ((Number(product.originalPrice) - Number(product.currentPrice)) /
          Number(product.originalPrice)) *
          100
      )
    : 0;

  const stockLines = product.stock?.split("\n").filter((line) => line.trim()) || [];
  const hasStock = stockLines.length > 0;
  
  // Check if product is in dynamic mode (has variants)
  const isDynamicMode = !!(product as any).dynamicMode;

  const handleBuy = () => {
    console.log("[ProductCard.handleBuy] Started for product:", { id: product.id, name: product.name, resellerId: product.resellerId, seller, dynamicMode: isDynamicMode });
    
    // For dynamic mode products, redirect to product details for variant selection
    if (isDynamicMode) {
      console.log("[ProductCard] Dynamic mode product - redirecting to details page for variant selection");
      setLocation(`/product/${product.id}`);
      return;
    }
    
    if (!hasStock) {
      console.error("[ProductCard] ❌ No stock available for", product.name, "Stock:", product.stock);
      return;
    }

    // Check both explicit seller prop and product.resellerId
    const sellerId = seller || product.resellerId;
    console.log("[ProductCard.handleBuy] Seller check:", { seller, productResellerId: product.resellerId, finalSellerId: sellerId });
    
    if (!sellerId) {
      console.error("[ProductCard] ❌ ERROR: Product missing resellerId!", { 
        productId: product.id, 
        productName: product.name,
        seller,
        productResellerId: product.resellerId,
        fullProduct: product
      });
      alert("Erro: Vendedor do produto não identificado. Contacte o administrador.");
      return;
    }

    console.log(`[ProductCard] ✅ Buying product: ${product.name} (ID: ${product.id}) from reseller: ${sellerId}`);
    addToCart(product);
    setIsCartOpen(true);
  };

  return (
    <Card
      className="product-card overflow-hidden flex flex-col"
      data-testid={`card-product-${product.id}`}
    >
      {/* Clickable Image and Title - Link to Product Details */}
      <Link href={`/product/${product.id}`}>
        <div
          className="relative aspect-square overflow-hidden cursor-pointer hover:opacity-90 transition-opacity"
          data-testid={`product-image-${product.id}`}
        >
          {product.imageUrl && !imgError ? (
            <img
              src={product.imageUrl}
              alt={product.name}
              className="product-image"
              onError={() => setImgError(true)}
              data-testid={`img-product-${product.id}`}
            />
          ) : (
            <div className="product-image-placeholder flex items-center justify-center bg-gray-800">
              <Package className="w-12 h-12 text-gray-500" />
            </div>
          )}
          {product.category && product.category !== "Outros" && (
            <div
              className="absolute top-2 right-2 px-2 py-0.5 rounded-full text-xs font-medium backdrop-blur-sm border border-white/20"
              style={{ backgroundColor: `${themeColor}40`, color: "#fff" }}
              data-testid={`badge-category-${product.id}`}
            >
              {product.category}
            </div>
          )}
          {hasDiscount && (
            <div
              className="absolute top-2 left-2 px-2 py-0.5 rounded text-xs font-semibold"
              style={{ backgroundColor: themeColor || "#3B82F6", color: "#fff" }}
              data-testid={`badge-discount-${product.id}`}
            >
              -{discountPercent}%
            </div>
          )}
          {!hasStock && (
            <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
              <span className="text-white font-semibold text-sm">Esgotado</span>
            </div>
          )}
        </div>
      </Link>

      <div className="p-3 flex flex-col flex-1 gap-2">
        {/* Clickable Title - Link to Product Details */}
        <Link href={`/product/${product.id}`}>
          <h3
            className="font-semibold text-sm line-clamp-2 min-h-[2.5rem] cursor-pointer hover:opacity-80 transition-opacity"
            style={{ color: textColor || "#FFFFFF" }}
            data-testid={`text-product-name-${product.id}`}
          >
            {product.name}
          </h3>
        </Link>

        <div className="flex flex-col gap-0.5">
          {hasDiscount && !isDynamicMode && (
            <span
              className="text-xs line-through opacity-60"
              style={{ color: textColor || "#FFFFFF" }}
              data-testid={`text-original-price-${product.id}`}
            >
              De R$ {Number(product.originalPrice).toFixed(2)}
            </span>
          )}
          <span
            className="text-lg font-bold"
            style={{ color: themeColor || "#3B82F6" }}
            data-testid={`text-current-price-${product.id}`}
          >
            {isDynamicMode && <span className="text-xs font-normal opacity-70">A partir de </span>}
            R$ {Number(product.currentPrice).toFixed(2)}
          </span>
        </div>

        {/* Buy Button - Primary when has stock, Disabled Gray when empty */}
        <button
          onClick={handleBuy}
          disabled={!hasStock && !isDynamicMode}
          className={`mt-auto text-sm font-medium transition flex items-center justify-center gap-1.5 py-2 px-3 rounded ${
            hasStock || isDynamicMode
              ? "btn-comprar" 
              : "cursor-not-allowed opacity-60"
          }`}
          style={
            hasStock || isDynamicMode
              ? { backgroundColor: themeColor || "#3B82F6", color: "#FFFFFF" }
              : {
                  backgroundColor: "#6b7280",
                  color: "#d1d5db",
                  cursor: "not-allowed",
                }
          }
          data-testid={`button-buy-${product.id}`}
        >
          <ShoppingCart className="w-4 h-4" />
          {isDynamicMode ? "Ver opcoes" : hasStock ? "Comprar" : "Esgotado"}
        </button>
      </div>
    </Card>
  );
}
