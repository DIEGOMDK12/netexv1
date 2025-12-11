import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import type { Product, Settings, Reseller, ProductVariant } from "@shared/schema";

interface CartItem {
  product: Product & { resellerId?: number | null };
  quantity: number;
  variant?: {
    id: number;
    name: string;
    price: string;
  };
}

interface StoreContextType {
  settings: Settings | null;
  cart: CartItem[];
  addToCart: (product: Product, variant?: { id: number; name: string; price: string }) => void;
  addToCartOnce: (product: Product, variant?: { id: number; name: string; price: string }) => void;
  removeFromCart: (productId: number, variantId?: number) => void;
  updateQuantity: (productId: number, quantity: number, variantId?: number) => void;
  clearCart: () => void;
  cartTotal: number;
  cartCount: number;
  isCartOpen: boolean;
  setIsCartOpen: (open: boolean) => void;
  setSettings: (settings: Settings) => void;
  currentReseller: Reseller | null;
  setCurrentReseller: (reseller: Reseller | null) => void;
}

const StoreContext = createContext<StoreContextType | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [currentReseller, setCurrentReseller] = useState<Reseller | null>(null);

  useEffect(() => {
    fetch("/api/settings")
      .then(res => res.json())
      .then(data => setSettings(data))
      .catch(err => console.error("Erro ao carregar configurações:", err));
  }, []);

  useEffect(() => {
    const savedCart = localStorage.getItem("cart");
    if (savedCart) {
      try {
        setCart(JSON.parse(savedCart));
      } catch {
        localStorage.removeItem("cart");
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("cart", JSON.stringify(cart));
  }, [cart]);

  const addToCart = (product: Product, variant?: { id: number; name: string; price: string }) => {
    setCart((prev) => {
      const existing = prev.find((item) => 
        item.product.id === product.id && 
        (variant ? item.variant?.id === variant.id : !item.variant)
      );
      if (existing) {
        return prev.map((item) =>
          item.product.id === product.id && 
          (variant ? item.variant?.id === variant.id : !item.variant)
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...prev, { product, quantity: 1, variant }];
    });
  };

  const addToCartOnce = (product: Product, variant?: { id: number; name: string; price: string }) => {
    setCart((prev) => {
      // Remove any existing items for this product (regardless of variant) and add the new one
      const filteredCart = prev.filter((item) => item.product.id !== product.id);
      return [...filteredCart, { product, quantity: 1, variant }];
    });
  };

  const removeFromCart = (productId: number, variantId?: number) => {
    setCart((prev) => prev.filter((item) => 
      !(item.product.id === productId && 
        (variantId ? item.variant?.id === variantId : !item.variant))
    ));
  };

  const updateQuantity = (productId: number, quantity: number, variantId?: number) => {
    if (quantity <= 0) {
      removeFromCart(productId, variantId);
      return;
    }
    setCart((prev) =>
      prev.map((item) =>
        item.product.id === productId && 
        (variantId ? item.variant?.id === variantId : !item.variant)
          ? { ...item, quantity } 
          : item
      )
    );
  };

  const clearCart = () => {
    setCart([]);
    localStorage.removeItem("cart");
  };

  const cartTotal = cart.reduce(
    (sum, item) => {
      const price = item.variant ? Number(item.variant.price) : Number(item.product.currentPrice);
      return sum + price * item.quantity;
    },
    0
  );

  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <StoreContext.Provider
      value={{
        settings,
        cart,
        addToCart,
        addToCartOnce,
        removeFromCart,
        updateQuantity,
        clearCart,
        cartTotal,
        cartCount,
        isCartOpen,
        setIsCartOpen,
        setSettings,
        currentReseller,
        setCurrentReseller,
      }}
    >
      {children}
    </StoreContext.Provider>
  );
}

export function useStore() {
  const context = useContext(StoreContext);
  if (!context) {
    throw new Error("useStore must be used within a StoreProvider");
  }
  return context;
}
