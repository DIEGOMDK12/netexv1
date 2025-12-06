import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle, CreditCard, Loader2, QrCode, CheckCircle, Copy, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

interface PagSeguroCheckoutData {
  success: boolean;
  pagseguroOrderId: string;
  referenceId: string;
  pixCode: string;
  qrCodeBase64: string | null;
  qrCodeImageUrl: string | null;
  amount: number;
  vendorId: number;
}

export default function SubscriptionPaymentPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [pixData, setPixData] = useState<PagSeguroCheckoutData | null>(null);
  const [copied, setCopied] = useState(false);
  const [checkingPayment, setCheckingPayment] = useState(false);

  const { data: settings } = useQuery({
    queryKey: ["/api/settings"],
  });

  const pagSeguroCheckoutMutation = useMutation({
    mutationFn: async () => {
      const vendorToken = localStorage.getItem("vendor_token");
      if (!vendorToken) {
        throw new Error("Token de revendedor não encontrado. Faça login novamente.");
      }
      const response = await fetch("/api/pagseguro/create-subscription-checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${vendorToken}`,
        },
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Erro ao criar checkout");
      }
      return response.json();
    },
    onSuccess: (data: PagSeguroCheckoutData) => {
      if (data.success) {
        setPixData(data);
        toast({
          title: "PIX Gerado",
          description: "Escaneie o QR Code ou copie o codigo para pagar",
        });
      } else {
        toast({
          title: "Erro",
          description: "Falha ao gerar pagamento PIX",
          variant: "destructive",
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: "Falha ao iniciar pagamento. Verifique se o PagSeguro esta configurado.",
        variant: "destructive",
      });
    },
  });

  const verifyPaymentMutation = useMutation({
    mutationFn: async () => {
      if (!pixData) return null;
      const vendorToken = localStorage.getItem("vendor_token");
      if (!vendorToken) {
        throw new Error("Token de revendedor não encontrado");
      }
      const response = await fetch("/api/pagseguro/verify-subscription", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${vendorToken}`,
        },
        body: JSON.stringify({
          pagseguroOrderId: pixData.pagseguroOrderId,
          vendorId: pixData.vendorId,
        }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Erro ao verificar pagamento");
      }
      return response.json();
    },
    onSuccess: (data) => {
      if (data?.isPaid) {
        toast({
          title: "Pagamento Confirmado",
          description: "Sua assinatura foi ativada com sucesso!",
        });
        setLocation("/vendor/dashboard");
      } else {
        toast({
          title: "Aguardando Pagamento",
          description: "O pagamento ainda nao foi confirmado. Tente novamente apos pagar.",
        });
      }
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Falha ao verificar pagamento",
        variant: "destructive",
      });
    },
  });

  const handlePagSeguroCheckout = () => {
    pagSeguroCheckoutMutation.mutate();
  };

  const handleCopyPixCode = async () => {
    if (pixData?.pixCode) {
      try {
        await navigator.clipboard.writeText(pixData.pixCode);
        setCopied(true);
        toast({
          title: "Copiado",
          description: "Codigo PIX copiado para a area de transferencia",
        });
        setTimeout(() => setCopied(false), 3000);
      } catch (err) {
        toast({
          title: "Erro",
          description: "Nao foi possivel copiar o codigo",
          variant: "destructive",
        });
      }
    }
  };

  const handleVerifyPayment = () => {
    setCheckingPayment(true);
    verifyPaymentMutation.mutate();
    setTimeout(() => setCheckingPayment(false), 2000);
  };

  useEffect(() => {
    if (pixData && !verifyPaymentMutation.isPending) {
      const interval = setInterval(() => {
        if (!verifyPaymentMutation.isPending) {
          verifyPaymentMutation.mutate();
        }
      }, 15000);

      return () => clearInterval(interval);
    }
  }, [pixData, verifyPaymentMutation.isPending]);

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{
        background: "linear-gradient(135deg, #0a0e27 0%, #1a1a3e 50%, #0f0a2e 100%)",
      }}
    >
      <Card
        style={{
          backgroundColor: "#1E1E1E",
          borderColor: "rgba(59, 130, 246, 0.5)",
        }}
        className="w-full max-w-md border"
      >
        <CardHeader>
          <div className="flex items-center gap-3 mb-4">
            <AlertCircle className="w-6 h-6 text-blue-400" />
            <CardTitle className="text-white">Ativacao da Assinatura</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
            <p className="text-gray-300 text-sm mb-2">Plano Mensal</p>
            <p className="text-3xl font-bold text-white">R$ 10,00</p>
            <p className="text-gray-400 text-xs mt-2">Renovacao a cada 30 dias</p>
          </div>

          {!pixData ? (
            <div className="space-y-4">
              <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4">
                <p className="text-gray-300 text-sm">
                  Pagamento seguro via PagSeguro. Pague com PIX e libere seu acesso imediatamente.
                </p>
              </div>
              
              <Button
                onClick={handlePagSeguroCheckout}
                disabled={pagSeguroCheckoutMutation.isPending}
                className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white gap-2"
                data-testid="button-pagseguro-checkout"
              >
                {pagSeguroCheckoutMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Gerando PIX...
                  </>
                ) : (
                  <>
                    <QrCode className="w-4 h-4" />
                    Pagar com PIX (PagSeguro)
                  </>
                )}
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4 text-center">
                <p className="text-gray-300 text-sm mb-4">
                  Escaneie o QR Code abaixo ou copie o codigo PIX
                </p>
                
                {pixData.qrCodeBase64 && (
                  <div className="flex justify-center mb-4">
                    <img 
                      src={pixData.qrCodeBase64} 
                      alt="QR Code PIX" 
                      className="w-48 h-48 bg-white p-2 rounded-lg"
                      data-testid="img-qrcode-pix"
                    />
                  </div>
                )}

                <div className="bg-gray-800 rounded-lg p-3 mb-4 max-h-32 overflow-y-auto">
                  <p className="text-xs text-gray-400 mb-2">Codigo PIX Copia e Cola:</p>
                  <p className="text-[10px] text-gray-300 break-all font-mono select-all" data-testid="text-pix-code">
                    {pixData.pixCode}
                  </p>
                </div>

                <Button
                  onClick={handleCopyPixCode}
                  variant="outline"
                  className="w-full text-white border-green-500 hover:bg-green-500/20 gap-2 mb-3"
                  data-testid="button-copy-pix"
                >
                  {copied ? (
                    <>
                      <CheckCircle className="w-4 h-4" />
                      Copiado!
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      Copiar Codigo PIX
                    </>
                  )}
                </Button>

                <Button
                  onClick={handleVerifyPayment}
                  disabled={verifyPaymentMutation.isPending || checkingPayment}
                  className="w-full bg-gradient-to-r from-blue-500 to-violet-600 hover:from-blue-600 hover:to-violet-700 text-white gap-2"
                  data-testid="button-verify-payment"
                >
                  {verifyPaymentMutation.isPending || checkingPayment ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Verificando...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="w-4 h-4" />
                      Ja Paguei - Verificar Pagamento
                    </>
                  )}
                </Button>

                <p className="text-xs text-gray-500 mt-3">
                  O pagamento e verificado automaticamente a cada 10 segundos
                </p>
              </div>

              <Button
                onClick={() => setPixData(null)}
                variant="ghost"
                className="w-full text-gray-400 hover:text-white"
                data-testid="button-generate-new-pix"
              >
                Gerar Novo QR Code
              </Button>
            </div>
          )}

          <Button
            onClick={() => setLocation("/")}
            variant="outline"
            className="w-full text-white border-gray-600 hover:bg-gray-800"
            data-testid="button-back-home"
          >
            Voltar a Pagina Inicial
          </Button>

          <div className="border-t border-gray-700 pt-4 mt-4">
            <p className="text-xs text-gray-500 mb-2 text-center">Pagamento via PIX Manual (Admin)</p>
            <Button
              onClick={async () => {
                const vendorToken = localStorage.getItem("vendor_token");
                if (!vendorToken) {
                  toast({ title: "Erro", description: "Faca login como revendedor primeiro", variant: "destructive" });
                  return;
                }
                try {
                  const response = await fetch("/api/vendor/activate-subscription-manual", {
                    method: "POST",
                    headers: {
                      "Content-Type": "application/json",
                      "Authorization": `Bearer ${vendorToken}`,
                    },
                  });
                  const data = await response.json();
                  if (data.success) {
                    toast({ title: "Sucesso", description: "Assinatura ativada por 30 dias!" });
                    setLocation("/vendor/dashboard");
                  } else {
                    toast({ title: "Erro", description: data.error || "Falha ao ativar", variant: "destructive" });
                  }
                } catch (err) {
                  toast({ title: "Erro", description: "Falha ao ativar assinatura", variant: "destructive" });
                }
              }}
              variant="ghost"
              className="w-full text-yellow-400 hover:bg-yellow-500/10"
              data-testid="button-manual-activate"
            >
              Ativar Manualmente (Teste)
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
