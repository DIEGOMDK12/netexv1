import { useState, useEffect, useRef, useCallback } from "react";
import { Copy, Loader2, Package, Plus, Minus, Trash2, Store, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useStore } from "@/lib/store-context";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useLocation } from "wouter";

interface CheckoutModalProps {
  open: boolean;
  onClose: () => void;
  themeColor?: string;
  textColor?: string;
}

export function CheckoutModal({ open, onClose, themeColor, textColor }: CheckoutModalProps) {
  const { cart, cartTotal, clearCart, updateQuantity, removeFromCart } = useStore();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [settings, setSettings] = useState<any>(null);

  const [email, setEmail] = useState("");
  const [whatsapp, setWhatsapp] = useState(() => {
    return localStorage.getItem("customer_whatsapp") || "";
  });
  const [customerName, setCustomerName] = useState("");

  // Load logged-in user data when modal opens
  useEffect(() => {
    const loadUserData = async () => {
      const vendorToken = localStorage.getItem("vendor_token");
      const vendorId = localStorage.getItem("vendor_id");
      
      if (vendorToken && vendorId) {
        try {
          const response = await fetch("/api/vendor/profile", {
            headers: { "Authorization": `Bearer ${vendorToken}` }
          });
          if (response.ok) {
            const vendor = await response.json();
            if (vendor.email) setEmail(vendor.email);
            if (vendor.name) setCustomerName(vendor.name);
            if (vendor.phone) setWhatsapp(vendor.phone);
          }
        } catch (error) {
          console.error("[CheckoutModal] Failed to load user data:", error);
        }
      }
      
      // Fallback to localStorage if no vendor data
      if (!email) {
        const savedEmail = localStorage.getItem("customer_email");
        if (savedEmail) setEmail(savedEmail);
      }
      if (!customerName) {
        const savedName = localStorage.getItem("customer_name");
        if (savedName) setCustomerName(savedName);
      }
    };
    
    if (open) {
      loadUserData();
    }
  }, [open]);
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
  
  const [paymentStatus, setPaymentStatus] = useState<"pending" | "paid" | "checking">("pending");
  const [deliveredContent, setDeliveredContent] = useState<string | null>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const finalTotal = Math.max(0, cartTotal - discount);
  
  const checkPaymentStatus = useCallback(async () => {
    if (!order?.id) return;
    
    try {
      const response = await fetch(`/api/pedidos/${order.id}/status`);
      if (!response.ok) return;
      
      const data = await response.json();
      console.log("[CheckoutModal] Payment status check:", data.status);
      
      if (data.status === "paid") {
        setPaymentStatus("paid");
        setDeliveredContent(data.deliveredContent || null);
        
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
        }
        
        toast({
          title: "Pagamento Confirmado!",
          description: "Seu pedido foi aprovado com sucesso.",
        });
        
        setTimeout(() => {
          clearCart();
          onClose();
          const vendorId = localStorage.getItem("vendor_id");
          const vendorToken = localStorage.getItem("vendor_token");
          if (vendorId && vendorToken) {
            setLocation("/vendor/my-purchases");
          } else {
            setLocation(`/pedidos?email=${encodeURIComponent(email)}`);
          }
        }, 2500);
      }
    } catch (error) {
      console.error("[CheckoutModal] Error checking payment status:", error);
    }
  }, [order?.id, toast, clearCart, onClose, setLocation, email]);

  useEffect(() => {
    if (order?.id && paymentStatus === "pending") {
      console.log("[CheckoutModal] Starting payment status polling for order:", order.id);
      
      pollingIntervalRef.current = setInterval(() => {
        checkPaymentStatus();
      }, 3000);
      
      return () => {
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
        }
      };
    }
  }, [order?.id, paymentStatus, checkPaymentStatus]);

  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, []);

  // Get reseller ID from cart (all items should be from same reseller)
  const resellerId = cart.length > 0 ? cart[0].product.resellerId : null;
  
  console.log("[CheckoutModal] Debug cart state:", {
    cartLength: cart.length,
    cartTotal: cartTotal,
    finalTotal: finalTotal,
    firstProduct: cart.length > 0 ? {
      id: cart[0].product.id,
      name: cart[0].product.name,
      currentPrice: cart[0].product.currentPrice,
      variant: cart[0].variant,
      resellerId: cart[0].product.resellerId,
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
      const params = new URLSearchParams({
        code: couponCode,
        cartTotal: cartTotal.toString(),
      });
      if (resellerId) {
        params.append("resellerId", resellerId.toString());
      }
      
      const response = await fetch(`/api/coupons/validate?${params.toString()}`);
      const data = await response.json();

      if (data.valid) {
        const discountAmount = parseFloat(data.discountAmount) || 0;
        setDiscount(discountAmount);
        
        const discountText = data.discountType === "percent"
          ? `${data.discountPercent || data.discountValue}%`
          : `R$ ${parseFloat(data.discountValue).toFixed(2)}`;
        
        toast({
          title: "Cupom aplicado!",
          description: `Desconto de ${discountText} aplicado`,
        });
      } else {
        toast({
          title: "Cupom invalido",
          description: data.message || "Este cupom nao existe ou esta inativo",
          variant: "destructive",
        });
        setDiscount(0);
      }
    } catch {
      toast({
        title: "Erro",
        description: "Nao foi possivel validar o cupom",
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
      // Save customer info for future purchases
      localStorage.setItem("customer_email", email);
      localStorage.setItem("customer_whatsapp", whatsapp);
      if (customerName.trim()) {
        localStorage.setItem("customer_name", customerName.trim());
      }

      const response = await apiRequest("POST", "/api/orders", {
        email,
        whatsapp,
        customerName: customerName.trim() || undefined,
        items: cart.map((item) => ({
          productId: item.product.id,
          productName: item.product.name,
          price: item.variant ? item.variant.price : item.product.currentPrice,
          quantity: 1, // Force quantity to 1 for digital products
          // Include variant info if product has variant (dynamic mode)
          variantId: item.variant?.id || undefined,
          variantName: item.variant?.name || undefined,
        })),
        couponCode: couponCode.trim() || undefined,
        discountAmount: discount > 0 ? discount.toString() : undefined,
        totalAmount: finalTotal.toString(),
      });

      const data = await response.json();
      setOrder(data);

      // After order is created, call AbacatePay API to generate PIX QR code
      // Platform receives 100% of payments, commission goes to reseller wallet
      if (data.id) {
        setIsProcessingPix(true);
        try {
          console.log("[CheckoutModal] Calling AbacatePay API for payment, resellerId:", resellerId);
          
          // Get the first product from cart for the payment
          const firstProduct = cart[0]?.product;
          
          const pixResponse = await apiRequest("POST", "/api/pagamento/criar", {
            id_produto: firstProduct?.id,
            valor: finalTotal.toFixed(2),
            email,
            whatsapp,
            customerName: customerName.trim() || email.split("@")[0],
            id_revendedor: resellerId || undefined,
            orderId: data.id, // Pass existing order ID to avoid duplicate creation
          });
          const pixData = await pixResponse.json();
          
          if (pixData.success) {
            setPixPayment({
              pixCode: pixData.pixCopyPaste || pixData.pixCode,
              qrCodeBase64: pixData.pixQrCodeUrl || pixData.url,
              billingId: pixData.billingId,
              checkoutUrl: pixData.url,
            });
            toast({
              title: "Pedido criado!",
              description: "Escaneie o QR Code ou copie o código PIX para pagar",
            });
          } else {
            console.error("[CheckoutModal] AbacatePay error:", pixData.error);
            toast({
              title: "Pedido criado!",
              description: pixData.error || "Aguarde o QR Code PIX ou entre em contato com o vendedor",
            });
          }
        } catch (pixError: any) {
          console.error("Payment API error:", pixError);
          toast({
            title: "Pedido criado!",
            description: "PIX automático indisponível. Entre em contato com o vendedor.",
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
      setPaymentStatus("pending");
      setDeliveredContent(null);
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
                {cart.map((item) => {
                  const rawPrice = item.variant ? item.variant.price : item.product.currentPrice;
                  const itemPrice = parseFloat(String(rawPrice)) || 0;
                  const itemKey = item.variant ? `${item.product.id}-${item.variant.id}` : `${item.product.id}`;
                  return (
                    <div
                      key={itemKey}
                      className="flex gap-3 p-3 rounded-lg"
                      style={{ backgroundColor: "#242424" }}
                      data-testid={`cart-item-${itemKey}`}
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
                          {item.variant && (
                            <span className="text-gray-400 ml-1">- {item.variant.name}</span>
                          )}
                        </h4>
                        <p
                          className="text-sm font-semibold mt-1"
                          style={{ color: themeColor || "#a855f7" }}
                        >
                          R$ {itemPrice.toFixed(2)}
                        </p>

                        <div className="flex items-center gap-2 mt-2">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 border border-purple-500/30"
                            onClick={() => updateQuantity(item.product.id, item.quantity - 1, item.variant?.id)}
                            data-testid={`button-decrease-${itemKey}`}
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
                            onClick={() => updateQuantity(item.product.id, item.quantity + 1, item.variant?.id)}
                            data-testid={`button-increase-${itemKey}`}
                          >
                            <Plus className="w-3.5 h-3.5 text-purple-400" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 ml-auto text-red-500"
                            onClick={() => removeFromCart(item.product.id, item.variant?.id)}
                            data-testid={`button-remove-${itemKey}`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                          <span
                            className="text-sm font-medium"
                            style={{ color: textColor || "#FFFFFF" }}
                          >
                            R$ {(itemPrice * item.quantity).toFixed(2)}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
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
                  <span>R$ {(cartTotal || 0).toFixed(2)}</span>
                </div>
                {discount > 0 && (
                  <div className="flex justify-between text-sm text-green-400">
                    <span>Desconto:</span>
                    <span>-R$ {(discount || 0).toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-lg pt-2 border-t" style={{ borderColor: "rgba(255,255,255,0.1)" }}>
                  <span>Total:</span>
                  <span style={{ color: themeColor || "#3B82F6" }}>
                    R$ {(finalTotal || 0).toFixed(2)}
                  </span>
                </div>
              </div>

              <div className="space-y-2 w-full">
                <Label style={{ color: textColor || "#FFFFFF" }}>E-mail para entrega</Label>
                <Input
                  type="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full"
                  style={{
                    backgroundColor: "#242424",
                    borderColor: "rgba(255,255,255,0.1)",
                    color: textColor || "#FFFFFF",
                  }}
                  data-testid="input-email"
                />
              </div>

              <div className="space-y-2 w-full">
                <Label style={{ color: textColor || "#FFFFFF" }}>Seu WhatsApp</Label>
                <Input
                  type="tel"
                  placeholder="11999999999"
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(e.target.value)}
                  className="w-full"
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
              {paymentStatus === "paid" ? (
                <div className="p-6 bg-green-900/30 border-2 border-green-500 rounded-lg text-center animate-in fade-in zoom-in duration-300">
                  <CheckCircle2 className="w-16 h-16 mx-auto text-green-400 mb-4" />
                  <h3 className="text-2xl font-bold text-green-400 mb-2" data-testid="text-payment-success">
                    Pagamento Recebido!
                  </h3>
                  <p className="text-gray-300 text-sm mb-2">
                    Seu pedido foi confirmado com sucesso.
                  </p>
                  <p className="text-gray-400 text-xs">
                    Redirecionando para seus pedidos...
                  </p>
                  <Loader2 className="w-5 h-5 animate-spin mx-auto mt-3 text-green-400" />
                </div>
              ) : isProcessingPix ? (
                <div className="p-4 bg-zinc-900 border border-zinc-700 rounded-lg text-center">
                  <Loader2 className="w-8 h-8 animate-spin mx-auto text-green-400 mb-2" />
                  <p className="text-white">Gerando QR Code PIX...</p>
                </div>
              ) : pixPayment ? (
                <>
                  <div className="p-4 bg-amber-900/20 border border-amber-500/50 rounded-lg text-center mb-3">
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 className="w-5 h-5 animate-spin text-amber-400" />
                      <span className="text-amber-400 font-semibold" data-testid="text-waiting-payment">
                        Aguardando confirmação do pagamento...
                      </span>
                    </div>
                    <p className="text-xs text-amber-300/70 mt-1">
                      O status será atualizado automaticamente
                    </p>
                  </div>
                  
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
                  
                  <Button
                    className="w-full"
                    variant="outline"
                    onClick={() => window.location.reload()}
                    data-testid="button-check-payment"
                  >
                    Já realizei o pagamento
                  </Button>
                </>
              ) : PIX_KEY && PIX_KEY !== "Chave PIX não configurada" ? (
                <>
                  <div className="p-4 bg-amber-900/20 border border-amber-500/50 rounded-lg text-center mb-3">
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 className="w-5 h-5 animate-spin text-amber-400" />
                      <span className="text-amber-400 font-semibold" data-testid="text-waiting-payment-manual">
                        Aguardando confirmação do pagamento...
                      </span>
                    </div>
                    <p className="text-xs text-amber-300/70 mt-1">
                      O status será atualizado automaticamente
                    </p>
                  </div>
                  
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
                  
                  <Button
                    className="w-full"
                    variant="outline"
                    onClick={() => window.location.reload()}
                    data-testid="button-check-payment-manual"
                  >
                    Já realizei o pagamento
                  </Button>
                </>
              ) : (
                <div className="p-4 bg-red-900/20 border border-red-700 rounded-lg text-center">
                  <h3 className="text-red-400 font-bold mb-2">Pagamento Não Disponível</h3>
                  <p className="text-gray-400 text-sm">O vendedor não configurou o PagSeguro ou uma chave PIX.</p>
                  <p className="text-xs text-gray-500 mt-2">Entre em contato com o vendedor.</p>
                </div>
              )}

              {paymentStatus !== "paid" && (
                <div
                  className="p-3 rounded-lg bg-gray-800 text-center"
                  style={{ color: textColor || "#FFFFFF" }}
                >
                  <p className="text-sm">Pedido #{order.id} criado com sucesso!</p>
                  <p className="text-xs opacity-70 mt-1">Aguardando confirmação de pagamento</p>
                </div>
              )}

              {paymentStatus !== "paid" && (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    if (pollingIntervalRef.current) {
                      clearInterval(pollingIntervalRef.current);
                      pollingIntervalRef.current = null;
                    }
                    clearCart();
                    setEmail("");
                    setWhatsapp("");
                    setCouponCode("");
                    setDiscount(0);
                    setOrder(null);
                    setPixPayment(null);
                    setPaymentStatus("pending");
                    setDeliveredContent(null);
                    onClose();
                  }}
                  data-testid="button-close-order"
                >
                  Fechar
                </Button>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
