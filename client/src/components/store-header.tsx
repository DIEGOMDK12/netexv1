import { ShoppingCart, Store } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useStore } from "@/lib/store-context";

interface StoreHeaderProps {
  themeColor?: string;
  textColor?: string;
  storeName?: string;
  logoUrl?: string;
}

export function StoreHeader({ themeColor, textColor, storeName, logoUrl }: StoreHeaderProps) {
  const { cartCount, setIsCartOpen } = useStore();

  return (
    <header
      className="sticky top-0 z-50 w-full h-16 md:h-20 flex items-center justify-between px-4"
      style={{
        backgroundColor: "#1A1A1A",
        borderBottom: "1px solid rgba(255,255,255,0.1)",
      }}
    >
      <div className="flex items-center gap-3">
        {logoUrl ? (
          <img
            src={logoUrl}
            alt={storeName || "Logo"}
            className="h-10 md:h-12 w-auto object-contain"
            data-testid="img-logo"
          />
        ) : (
          <Store className="w-8 h-8" style={{ color: themeColor || "#3B82F6" }} />
        )}
        <div className="flex items-center gap-2">
          <h1
            className="text-lg md:text-xl font-bold"
            style={{ color: textColor || "#FFFFFF" }}
            data-testid="text-store-name"
          >
            {storeName || "NexStore"}
          </h1>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M22.5 12.5C22.5 12.5 23 11 23 9.5C23 8 22 7 21 7C20 7 19 6 18.5 5.5C18 5 18 4 18 3C18 2 17 1 16 1C15 1 14 1.5 13 2C12 2.5 11 2.5 10 2C9 1.5 8 1 7 1C6 1 5 2 5 3C5 4 5 5 4.5 5.5C4 6 3 7 2 7C1 7 0 8 0 9.5C0 11 0.5 12.5 0.5 12.5C0.5 12.5 0 14 0 15.5C0 17 1 18 2 18C3 18 4 19 4.5 19.5C5 20 5 21 5 22C5 23 6 24 7 24C8 24 9 23.5 10 23C11 22.5 12 22.5 13 23C14 23.5 15 24 16 24C17 24 18 23 18 22C18 21 18 20 18.5 19.5C19 19 20 18 21 18C22 18 23 17 23 15.5C23 14 22.5 12.5 22.5 12.5Z" fill="#3B82F6"/>
            <path d="M10 17L5 12L6.41 10.59L10 14.17L17.59 6.58L19 8L10 17Z" fill="white"/>
          </svg>
        </div>
      </div>

      <div className="flex items-center gap-2 md:gap-3">
        <Link href="/login">
          <Button
            variant="ghost"
            className="text-xs md:text-sm text-gray-300 hover:text-white"
            data-testid="button-vendor-login"
          >
            Login
          </Button>
        </Link>
        
        <Button
          size="icon"
          variant="ghost"
          className="relative"
          onClick={() => setIsCartOpen(true)}
          data-testid="button-cart"
        >
          <ShoppingCart className="w-6 h-6" style={{ color: textColor || "#FFFFFF" }} />
          {cartCount > 0 && (
            <Badge
              className="absolute -top-1 -right-1 h-5 min-w-[1.25rem] px-1 text-xs flex items-center justify-center"
              style={{ backgroundColor: themeColor || "#3B82F6", color: "#FFFFFF" }}
              data-testid="badge-cart-count"
            >
              {cartCount}
            </Badge>
          )}
        </Button>
      </div>
    </header>
  );
}
