import { X, Minus, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useStore } from "@/lib/store-context";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

interface CartPanelProps {
  onCheckout: () => void;
  themeColor?: string;
  textColor?: string;
}

export function CartPanel({ onCheckout, themeColor, textColor }: CartPanelProps) {
  const { cart, isCartOpen, setIsCartOpen, updateQuantity, removeFromCart, cartTotal } = useStore();

  return (
    <Sheet open={isCartOpen} onOpenChange={setIsCartOpen}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-md p-0 flex flex-col"
        style={{ backgroundColor: "#1A1A1A", borderColor: "rgba(255,255,255,0.1)" }}
      >
        <SheetHeader className="p-4 border-b" style={{ borderColor: "rgba(255,255,255,0.1)" }}>
          <SheetTitle
            className="text-lg font-semibold"
            style={{ color: textColor || "#FFFFFF" }}
          >
            Carrinho ({cart.length})
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-4">
          {cart.length === 0 ? (
            <div
              className="flex flex-col items-center justify-center h-full gap-2 text-center"
              style={{ color: textColor || "#FFFFFF", opacity: 0.6 }}
            >
              <p>Seu carrinho está vazio</p>
              <p className="text-sm">Adicione produtos para continuar</p>
            </div>
          ) : (
            <div className="space-y-3">
              {cart.map((item) => (
                <div
                  key={item.product.id}
                  className="flex gap-3 p-3 rounded-lg"
                  style={{ backgroundColor: "#242424" }}
                  data-testid={`cart-item-${item.product.id}`}
                >
                  <div className="w-16 h-16 rounded-md overflow-hidden flex-shrink-0">
                    {item.product.imageUrl ? (
                      <img
                        src={item.product.imageUrl}
                        alt={item.product.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-zinc-700" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <h4
                      className="font-medium text-sm truncate"
                      style={{ color: textColor || "#FFFFFF" }}
                    >
                      {item.product.name}
                    </h4>
                    <p
                      className="text-sm font-semibold mt-1"
                      style={{ color: themeColor || "#3B82F6" }}
                    >
                      R$ {Number(item.product.currentPrice).toFixed(2)}
                    </p>

                    <div className="flex items-center gap-2 mt-2">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                        data-testid={`button-decrease-${item.product.id}`}
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </Button>
                      <span
                        className="w-8 text-center text-sm"
                        style={{ color: textColor || "#FFFFFF" }}
                      >
                        {item.quantity}
                      </span>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                        data-testid={`button-increase-${item.product.id}`}
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 ml-auto text-red-500"
                        onClick={() => removeFromCart(item.product.id)}
                        data-testid={`button-remove-${item.product.id}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {cart.length > 0 && (
          <div
            className="p-4 border-t space-y-3"
            style={{ borderColor: "rgba(255,255,255,0.1)" }}
          >
            <div className="flex justify-between items-center">
              <span style={{ color: textColor || "#FFFFFF" }}>Total:</span>
              <span
                className="text-xl font-bold"
                style={{ color: themeColor || "#3B82F6" }}
                data-testid="text-cart-total"
              >
                R$ {cartTotal.toFixed(2)}
              </span>
            </div>

            <Button
              className="w-full h-10 font-medium rounded-lg"
              style={{ backgroundColor: themeColor || "#3B82F6", color: "#FFFFFF" }}
              onClick={() => {
                setIsCartOpen(false);
                onCheckout();
              }}
              data-testid="button-checkout"
            >
              Finalizar Compra
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
