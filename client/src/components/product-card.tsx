import { useState } from "react";
import { ShoppingCart, Package, Layers } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { Product, ProductVariant } from "@shared/schema";
import { useStore } from "@/lib/store-context";
import { useToast } from "@/hooks/use-toast";

interface ProductCardProps {
  product: Product;
  seller?: number;
  themeColor?: string;
  textColor?: string;
}

export function ProductCard({ product, seller, themeColor, textColor }: ProductCardProps) {
  const { addToCart, setIsCartOpen } = useStore();
  const [imgError, setImgError] = useState(false);
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const isDynamicMode = (product as any).dynamicMode === true;

  // Fetch variants for dynamic mode products
  const { data: variants = [] } = useQuery<ProductVariant[]>({
    queryKey: ["/api/products", product.id, "variants"],
    queryFn: async () => {
      const response = await fetch(`/api/products/${product.id}/variants`);
      if (!response.ok) return [];
      return response.json();
    },
    enabled: isDynamicMode,
    staleTime: 30000,
  });

  const activeVariants = variants.filter((v) => v.active !== false);

  // Calculate stock and price for dynamic mode products
  const getStockInfo = () => {
    if (isDynamicMode) {
      let totalStock = 0;
      activeVariants.forEach((v) => {
        const lines = v.stock?.split("\n").filter((line: string) => line.trim()) || [];
        totalStock += lines.length;
      });
      return { stockCount: totalStock, hasStock: totalStock > 0 || activeVariants.length > 0 };
    }
    const stockLines = product.stock?.split("\n").filter((line) => line.trim()) || [];
    return { stockCount: stockLines.length, hasStock: stockLines.length > 0 };
  };

  const { hasStock } = getStockInfo();

  // Get price display for dynamic mode
  const getPriceDisplay = () => {
    if (isDynamicMode && activeVariants.length > 0) {
      const prices = activeVariants.map(v => parseFloat(v.price as any));
      const minPrice = Math.min(...prices);
      const maxPrice = Math.max(...prices);
      if (minPrice === maxPrice) {
        return { price: minPrice, showRange: false };
      }
      return { minPrice, maxPrice, showRange: true };
    }
    return { price: Number(product.currentPrice), showRange: false };
  };

  const priceInfo = getPriceDisplay();

  const hasDiscount = !isDynamicMode && Number(product.originalPrice) > Number(product.currentPrice);
  const discountPercent = hasDiscount
    ? Math.round(
        ((Number(product.originalPrice) - Number(product.currentPrice)) /
          Number(product.originalPrice)) *
          100
      )
    : 0;

  const isLoggedIn = () => {
    const vendorId = localStorage.getItem("vendor_id");
    const vendorToken = localStorage.getItem("vendor_token");
    return !!vendorId && !!vendorToken;
  };

  const handleBuy = () => {
    console.log("[ProductCard.handleBuy] Started for product:", { id: product.id, name: product.name, resellerId: product.resellerId, seller });
    
    // Check if user is logged in
    if (!isLoggedIn()) {
      toast({
        title: "Faça login para comprar",
        description: "Entre na sua conta ou cadastre-se para continuar",
      });
      setLocation("/login");
      return;
    }
    
    if (!hasStock) {
      console.error("[ProductCard] No stock available for", product.name, "Stock:", product.stock);
      return;
    }

    const sellerId = seller || product.resellerId;
    console.log("[ProductCard.handleBuy] Seller check:", { seller, productResellerId: product.resellerId, finalSellerId: sellerId });
    
    if (!sellerId) {
      console.error("[ProductCard] ERROR: Product missing resellerId!", { 
        productId: product.id, 
        productName: product.name,
        seller,
        productResellerId: product.resellerId,
        fullProduct: product
      });
      alert("Erro: Vendedor do produto não identificado. Contacte o administrador.");
      return;
    }

    console.log(`[ProductCard] Buying product: ${product.name} (ID: ${product.id}) from reseller: ${sellerId}`);
    addToCart(product);
    setIsCartOpen(true);
  };

  return (
    <Card
      className="product-card overflow-hidden flex flex-col"
      data-testid={`card-product-${product.id}`}
    >
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
          {!hasStock && !isDynamicMode && (
            <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
              <span className="text-white font-semibold text-sm">Esgotado</span>
            </div>
          )}
          {isDynamicMode && (
            <div className="absolute top-2 left-2 px-2 py-0.5 rounded text-xs font-semibold bg-purple-600 text-white">
              Variantes
            </div>
          )}
        </div>
      </Link>

      <div className="p-3 flex flex-col flex-1 gap-2">
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
          {hasDiscount && (
            <span
              className="text-xs line-through opacity-60"
              style={{ color: textColor || "#FFFFFF" }}
              data-testid={`text-original-price-${product.id}`}
            >
              De R$ {Number(product.originalPrice).toFixed(2)}
            </span>
          )}
          {isDynamicMode && priceInfo.showRange ? (
            <span
              className="text-lg font-bold"
              style={{ color: themeColor || "#3B82F6" }}
              data-testid={`text-current-price-${product.id}`}
            >
              R$ {(priceInfo as any).minPrice.toFixed(2)} - R$ {(priceInfo as any).maxPrice.toFixed(2)}
            </span>
          ) : (
            <span
              className="text-lg font-bold"
              style={{ color: themeColor || "#3B82F6" }}
              data-testid={`text-current-price-${product.id}`}
            >
              {isDynamicMode && activeVariants.length > 0 ? "A partir de " : ""}R$ {((priceInfo as any).price || 0).toFixed(2)}
            </span>
          )}
          {isDynamicMode && (
            <span className="text-xs text-purple-400 flex items-center gap-1">
              <Layers className="w-3 h-3" />
              {activeVariants.length} opç{activeVariants.length !== 1 ? "ões" : "ão"}
            </span>
          )}
        </div>

        {isDynamicMode ? (
          <Link href={`/product/${product.id}`}>
            <button
              className="mt-auto w-full text-sm font-medium transition flex items-center justify-center gap-1.5 py-2 px-3 rounded btn-comprar"
              style={{ backgroundColor: themeColor || "#3B82F6", color: "#FFFFFF" }}
              data-testid={`button-buy-${product.id}`}
            >
              <Layers className="w-4 h-4" />
              Ver Opções
            </button>
          </Link>
        ) : (
          <button
            onClick={handleBuy}
            disabled={!hasStock}
            className={`mt-auto text-sm font-medium transition flex items-center justify-center gap-1.5 py-2 px-3 rounded ${
              hasStock
                ? "btn-comprar" 
                : "cursor-not-allowed opacity-60"
            }`}
            style={
              hasStock
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
            {hasStock ? "Comprar" : "Esgotado"}
          </button>
        )}
      </div>
    </Card>
  );
}
