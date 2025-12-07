import { useState, useEffect } from "react";
import { X, Copy, Loader2, Package, Plus, Minus, Trash2, Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useStore } from "@/lib/store-context";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface CheckoutModalProps {
  open: boolean;
  onClose: () => void;
  themeColor?: string;
  textColor?: string;
}

export function CheckoutModal({ open, onClose, themeColor, textColor }: CheckoutModalProps) {
  const { cart, cartTotal, clearCart, updateQuantity, removeFromCart } = useStore();
  const { toast } = useToast();
  const [settings, setSettings] = useState<any>(null);

  const [email, setEmail] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [couponCode, setCouponCode] = useState("");
  const [discount, setDiscount] = useState(0);
  const [isApplyingCoupon, setIsApplyingCoupon] = useState(false);
  const [isCreatingOrder, setIsCreatingOrder] = useState(false);
  const [order, setOrder] = useState<{ id: number; resellerId?: number } | null>(null);
  const [copied, setCopied] = useState(false);
  const [pixPayment, setPixPayment] = useState<{
    pixCode: string;
    qrCodeBase64: string | null;
    billingId: string;
    checkoutUrl?: string;
  } | null>(null);
  const [isProcessingPix, setIsProcessingPix] = useState(false);

  const finalTotal = Math.max(0, cartTotal - discount);

  // Get reseller ID from cart (all items should be from same reseller)
  const resellerId = cart.length > 0 ? cart[0].product.resellerId : null;
  
  console.log("[CheckoutModal] Debug cart state:", {
    cartLength: cart.length,
    firstProduct: cart.length > 0 ? {
      id: cart[0].product.id,
      name: cart[0].product.name,
      resellerId: cart[0].product.resellerId,
      allKeys: Object.keys(cart[0].product)
    } : null,
    detectedResellerId: resellerId
  });
  
  // PIX key from reseller settings - will be null if not configured
  const PIX_KEY = settings?.pixKey || null;
  const hasPixKey = PIX_KEY && PIX_KEY.trim() !== "";

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        if (resellerId) {
          console.log("[CheckoutModal] Fetching settings for resellerId:", resellerId);
          // Fetch reseller's specific settings
          const response = await fetch(`/api/resellers/${resellerId}`);
          
          if (response.ok) {
            const data = await response.json();
            console.log("[CheckoutModal] Reseller settings fetched:", { 
              id: data.id, 
              storeName: data.storeName, 
              pixKey: data.pixKey ? "SET" : "NOT SET" 
            });
            setSettings(data);
          } else {
            console.warn("[CheckoutModal] Failed to fetch reseller settings (status: " + response.status + "), using global");
            const fallbackResponse = await fetch("/api/settings");
            const data = await fallbackResponse.json();
            setSettings(data);
          }
        } else {
          console.log("[CheckoutModal] No resellerId, fetching global settings");
          // Fallback to global settings
          const response = await fetch("/api/settings");
          const data = await response.json();
          setSettings(data);
        }
      } catch (error) {
        console.error("[CheckoutModal] Failed to fetch settings:", error);
        // Final fallback - fetch global settings
        try {
          const response = await fetch("/api/settings");
          const data = await response.json();
          setSettings(data);
        } catch (e) {
          console.error("[CheckoutModal] Failed to fetch global settings:", e);
        }
      }
    };
    fetchSettings();
  }, [resellerId]);

  const applyCoupon = async () => {
    if (!couponCode.trim()) return;

    setIsApplyingCoupon(true);
    try {
      const response = await fetch(`/api/coupons/validate?code=${encodeURIComponent(couponCode)}`);
      const data = await response.json();

      if (data.valid) {
        const discountAmount = (cartTotal * data.discountPercent) / 100;
        setDiscount(discountAmount);
        toast({
          title: "Cupom aplicado!",
          description: `Desconto de ${data.discountPercent}% aplicado`,
        });
      } else {
        toast({
          title: "Cupom inválido",
          description: "Este cupom não existe ou está inativo",
          variant: "destructive",
        });
        setDiscount(0);
      }
    } catch {
      toast({
        title: "Erro",
        description: "Não foi possível validar o cupom",
        variant: "destructive",
      });
    } finally {
      setIsApplyingCoupon(false);
    }
  };

  const createOrder = async () => {
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast({
        title: "E-mail inválido",
        description: "Por favor, insira um e-mail válido",
        variant: "destructive",
      });
      return;
    }

    if (!whatsapp.trim()) {
      toast({
        title: "WhatsApp obrigatório",
        description: "Por favor, insira seu número de WhatsApp",
        variant: "destructive",
      });
      return;
    }

    setIsCreatingOrder(true);
    try {
      const response = await apiRequest("POST", "/api/orders", {
        email,
        whatsapp,
        items: cart.map((item) => ({
          productId: item.product.id,
          productName: item.product.name,
          price: item.product.currentPrice,
          quantity: 1, // Force quantity to 1 for digital products
        })),
        couponCode: couponCode.trim() || undefined,
        discountAmount: discount > 0 ? discount.toString() : undefined,
        totalAmount: finalTotal.toString(),
      });

      const data = await response.json();
      setOrder(data);

      // After order is created, call appropriate payment API based on vendor settings
      if (data.id) {
        setIsProcessingPix(true);
        try {
          const preferredMethod = settings?.preferredPaymentMethod || "abacatepay";
          console.log("[CheckoutModal] Using payment method:", preferredMethod, "resellerId:", resellerId);
          
          let pixResponse;
          let pixData;
          
          if (preferredMethod === "pagseguro" && resellerId) {
            // Use PagSeguro for this vendor
            console.log("[CheckoutModal] Calling PagSeguro API for reseller:", resellerId);
            pixResponse = await apiRequest("POST", "/api/pay/pagseguro", {
              orderId: data.id,
              amount: finalTotal,
              email,
              description: `Pedido #${data.id}`,
              resellerId: resellerId,
            });
            pixData = await pixResponse.json();
            
            if (pixData.success) {
              setPixPayment({
                pixCode: pixData.pixCode,
                qrCodeBase64: pixData.qrCodeBase64 || pixData.qrCodeImageUrl,
                billingId: pixData.pagseguroOrderId,
              });
              toast({
                title: "Pedido criado!",
                description: "Escaneie o QR Code ou copie o código PIX para pagar",
              });
            } else {
              throw new Error(pixData.error || "PagSeguro falhou");
            }
          } else {
            // Use Abacate Pay (default)
            console.log("[CheckoutModal] Calling AbacatePay API");
            pixResponse = await apiRequest("POST", "/api/pay/abacatepay", {
              orderId: data.id,
              amount: finalTotal,
              email,
              description: `Pedido #${data.id}`,
              customerName: email.split("@")[0],
            });
            pixData = await pixResponse.json();
            
            if (pixData.success) {
              setPixPayment({
                pixCode: pixData.pixCode,
                qrCodeBase64: pixData.pixQrCodeUrl,
                billingId: pixData.billingId,
                checkoutUrl: pixData.checkoutUrl,
              });
              toast({
                title: "Pedido criado!",
                description: "Escaneie o QR Code ou copie o código PIX para pagar",
              });
            } else {
              toast({
                title: "Pedido criado!",
                description: "Aguarde o QR Code PIX ou entre em contato com o vendedor",
              });
            }
          }
        } catch (pixError: any) {
          console.error("Payment API error:", pixError);
          toast({
            title: "Pedido criado!",
            description: "PIX automático indisponível. Verifique a chave PIX manual.",
          });
        } finally {
          setIsProcessingPix(false);
        }
      } else {
        toast({
          title: "Pedido criado!",
          description: "Copie a chave PIX para pagar",
        });
      }
    } catch (error: any) {
      toast({
        title: "Erro ao criar pedido",
        description: error.message || "Tente novamente",
        variant: "destructive",
      });
    } finally {
      setIsCreatingOrder(false);
    }
  };


  const handleClose = () => {
    if (!order) {
      setEmail("");
      setWhatsapp("");
      setCouponCode("");
      setDiscount(0);
      onClose();
    }
  };

  const copyPixKey = async () => {
    const keyToCopy = pixPayment?.pixCode || PIX_KEY;
    if (!keyToCopy) {
      toast({
        title: "Erro",
        description: "Chave PIX não disponível para cópia",
        variant: "destructive",
      });
      return;
    }
    await navigator.clipboard.writeText(keyToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({
      title: "Código PIX copiado!",
      description: "Cole no seu app de pagamento",
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        className="max-w-lg w-[95vw] p-0 overflow-hidden"
        style={{ backgroundColor: "#1E1E1E", borderColor: "rgba(255,255,255,0.1)" }}
      >
        <DialogHeader className="p-4 border-b" style={{ borderColor: "rgba(255,255,255,0.1)" }}>
          {settings?.storeName && (
            <div className="flex items-center gap-2 mb-2">
              {settings?.logoUrl ? (
                <img 
                  src={settings.logoUrl} 
                  alt={settings.storeName} 
                  className="w-8 h-8 rounded-lg object-cover"
                />
              ) : (
                <div 
                  className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: themeColor || "#a855f7" }}
                >
                  <Store className="w-4 h-4 text-white" />
                </div>
              )}
              <span className="font-bold text-white text-sm">{settings.storeName}</span>
            </div>
          )}
          <DialogTitle style={{ color: textColor || "#FFFFFF" }}>
            {order ? "Pagamento PIX" : "Finalizar Compra"}
          </DialogTitle>
        </DialogHeader>

        <div className="p-4 space-y-4">
          {!order ? (
            <>
              <div className="space-y-3">
                {cart.map((item) => (
                  <div
                    key={item.product.id}
                    className="flex gap-3 p-3 rounded-lg"
                    style={{ backgroundColor: "#242424" }}
                    data-testid={`cart-item-${item.product.id}`}
                  >
                    <div className="w-14 h-14 rounded-md overflow-hidden flex-shrink-0">
                      {item.product.imageUrl ? (
                        <img
                          src={item.product.imageUrl}
                          alt={item.product.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-purple-900/30 to-pink-900/30 flex items-center justify-center">
                          <Package className="w-6 h-6 text-purple-400/50" />
                        </div>
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
                        style={{ color: themeColor || "#a855f7" }}
                      >
                        R$ {Number(item.product.currentPrice).toFixed(2)}
                      </p>

                      <div className="flex items-center gap-2 mt-2">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 border border-purple-500/30"
                          onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                          data-testid={`button-decrease-${item.product.id}`}
                        >
                          <Minus className="w-3.5 h-3.5 text-purple-400" />
                        </Button>
                        <span
                          className="w-8 text-center text-sm font-medium"
                          style={{ color: textColor || "#FFFFFF" }}
                        >
                          {item.quantity}
                        </span>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 border border-purple-500/30"
                          onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                          data-testid={`button-increase-${item.product.id}`}
                        >
                          <Plus className="w-3.5 h-3.5 text-purple-400" />
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
                        <span
                          className="text-sm font-medium"
                          style={{ color: textColor || "#FFFFFF" }}
                        >
                          R$ {(Number(item.product.currentPrice) * item.quantity).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex gap-2">
                <Input
                  placeholder="Cupom de desconto"
                  value={couponCode}
                  onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                  className="flex-1"
                  style={{
                    backgroundColor: "#242424",
                    borderColor: "rgba(255,255,255,0.1)",
                    color: textColor || "#FFFFFF",
                  }}
                  data-testid="input-coupon"
                />
                <Button
                  variant="secondary"
                  onClick={applyCoupon}
                  disabled={isApplyingCoupon || !couponCode.trim()}
                  className="px-4"
                  data-testid="button-apply-coupon"
                >
                  {isApplyingCoupon ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    "Aplicar"
                  )}
                </Button>
              </div>

              <div
                className="space-y-2 py-2"
                style={{ color: textColor || "#FFFFFF" }}
              >
                <div className="flex justify-between text-sm">
                  <span>Subtotal:</span>
                  <span>R$ {cartTotal.toFixed(2)}</span>
                </div>
                {discount > 0 && (
                  <div className="flex justify-between text-sm text-green-400">
                    <span>Desconto:</span>
                    <span>-R$ {discount.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-lg pt-2 border-t" style={{ borderColor: "rgba(255,255,255,0.1)" }}>
                  <span>Total:</span>
                  <span style={{ color: themeColor || "#3B82F6" }}>
                    R$ {finalTotal.toFixed(2)}
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <Label style={{ color: textColor || "#FFFFFF" }}>E-mail para entrega</Label>
                <Input
                  type="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  style={{
                    backgroundColor: "#242424",
                    borderColor: "rgba(255,255,255,0.1)",
                    color: textColor || "#FFFFFF",
                  }}
                  data-testid="input-email"
                />
              </div>

              <div className="space-y-2">
                <Label style={{ color: textColor || "#FFFFFF" }}>Seu WhatsApp</Label>
                <Input
                  type="tel"
                  placeholder="11999999999"
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(e.target.value)}
                  style={{
                    backgroundColor: "#242424",
                    borderColor: "rgba(255,255,255,0.1)",
                    color: textColor || "#FFFFFF",
                  }}
                  data-testid="input-whatsapp"
                />
              </div>

              <Button
                className="w-full h-10 font-medium rounded-lg"
                style={{ backgroundColor: themeColor || "#3B82F6", color: "#FFFFFF" }}
                onClick={createOrder}
                disabled={isCreatingOrder || !email.trim()}
                data-testid="button-pay"
              >
                {isCreatingOrder ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Processando...
                  </>
                ) : (
                  "✅ Confirmar Pedido"
                )}
              </Button>
            </>
          ) : (
            <div className="space-y-4">
              {isProcessingPix ? (
                <div className="p-4 bg-zinc-900 border border-zinc-700 rounded-lg text-center">
                  <Loader2 className="w-8 h-8 animate-spin mx-auto text-green-400 mb-2" />
                  <p className="text-white">Gerando QR Code PIX...</p>
                </div>
              ) : pixPayment ? (
                <>
                  <div className="p-4 bg-zinc-900 border border-zinc-700 rounded-lg text-center">
                    <h3 className="text-white font-bold mb-3">Pagamento via PIX</h3>
                    
                    {pixPayment.qrCodeBase64 && (
                      <div className="mb-4">
                        <img 
                          src={pixPayment.qrCodeBase64} 
                          alt="QR Code PIX" 
                          className="mx-auto w-48 h-48 bg-white p-2 rounded-lg"
                          data-testid="img-qr-code"
                        />
                        <p className="text-xs text-gray-400 mt-2">Escaneie o QR Code com seu app de banco</p>
                      </div>
                    )}
                    
                    <div className="mt-3">
                      <p className="text-gray-400 text-sm mb-1">Ou copie o código PIX (Copia e Cola):</p>
                      <div className="bg-zinc-800 p-2 rounded-lg overflow-hidden">
                        <p 
                          className="text-xs text-green-400 font-mono break-all select-all max-h-16 overflow-y-auto" 
                          data-testid="text-pix-code"
                        >
                          {pixPayment.pixCode}
                        </p>
                      </div>
                    </div>
                  </div>

                  <Button
                    className="w-full"
                    style={{ backgroundColor: themeColor || "#3B82F6", color: "#FFFFFF" }}
                    onClick={copyPixKey}
                    data-testid="button-copy-pix-code"
                  >
                    <Copy className="w-4 h-4 mr-2" />
                    {copied ? "Código copiado!" : "Copiar Código PIX"}
                  </Button>
                </>
              ) : PIX_KEY && PIX_KEY !== "Chave PIX não configurada" ? (
                <>
                  <div className="p-4 bg-zinc-900 border border-zinc-700 rounded-lg text-center">
                    <h3 className="text-white font-bold mb-2">Pagamento via PIX</h3>
                    <p className="text-gray-400 text-sm mb-1">Chave PIX:</p>
                    <p className="text-2xl text-green-400 font-mono font-bold select-all" data-testid="text-pix-key">{PIX_KEY}</p>
                    <p className="text-xs text-gray-500 mt-2">Copie e pague no seu banco</p>
                  </div>

                  <Button
                    className="w-full"
                    style={{ backgroundColor: themeColor || "#3B82F6", color: "#FFFFFF" }}
                    onClick={copyPixKey}
                    data-testid="button-copy-pix-key"
                  >
                    {copied ? "Chave copiada!" : "Copiar Chave PIX"}
                  </Button>
                </>
              ) : (
                <div className="p-4 bg-red-900/20 border border-red-700 rounded-lg text-center">
                  <h3 className="text-red-400 font-bold mb-2">Pagamento Não Disponível</h3>
                  <p className="text-gray-400 text-sm">O vendedor não configurou o PagSeguro ou uma chave PIX.</p>
                  <p className="text-xs text-gray-500 mt-2">Entre em contato com o vendedor.</p>
                </div>
              )}

              <div
                className="p-3 rounded-lg bg-gray-800 text-center"
                style={{ color: textColor || "#FFFFFF" }}
              >
                <p className="text-sm">Pedido #{order.id} criado com sucesso!</p>
                <p className="text-xs opacity-70 mt-1">Aguardando confirmação de pagamento pelo administrador</p>
              </div>

              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  clearCart();
                  setEmail("");
                  setWhatsapp("");
                  setCouponCode("");
                  setDiscount(0);
                  setOrder(null);
                  setPixPayment(null);
                  onClose();
                }}
                data-testid="button-close-order"
              >
                Fechar
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
