import { useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle, CreditCard, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

export default function SubscriptionPaymentPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const { data: settings } = useQuery({
    queryKey: ["/api/settings"],
  });

  const stripeCheckoutMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/stripe/create-subscription-checkout");
      return response.json();
    },
    onSuccess: (data) => {
      if (data.url) {
        window.location.href = data.url;
      }
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: "Falha ao iniciar pagamento. Tente novamente.",
        variant: "destructive",
      });
    },
  });

  const handleStripeCheckout = () => {
    stripeCheckoutMutation.mutate();
  };

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
            <p className="text-gray-400 text-xs mt-2">Renovacao automatica a cada 30 dias</p>
          </div>

          <div className="space-y-4">
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
              <p className="text-gray-300 text-sm">
                Pagamento seguro via Stripe. Aceita Pix e cartoes de credito/debito.
              </p>
            </div>
            
            <Button
              onClick={handleStripeCheckout}
              disabled={stripeCheckoutMutation.isPending}
              className="w-full bg-gradient-to-r from-blue-500 to-violet-600 hover:from-blue-600 hover:to-violet-700 text-white gap-2"
              data-testid="button-stripe-checkout"
            >
              {stripeCheckoutMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Processando...
                </>
              ) : (
                <>
                  <CreditCard className="w-4 h-4" />
                  Pagar com Pix ou Cartao
                </>
              )}
            </Button>
          </div>

          <Button
            onClick={() => setLocation("/")}
            variant="outline"
            className="w-full text-white border-gray-600 hover:bg-gray-800"
            data-testid="button-back-home"
          >
            Voltar a Pagina Inicial
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
