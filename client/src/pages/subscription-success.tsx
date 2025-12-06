import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle, Loader2 } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

export default function SubscriptionSuccessPage() {
  const [, setLocation] = useLocation();
  const [verified, setVerified] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const verifyMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      const response = await apiRequest("POST", "/api/stripe/verify-subscription", { sessionId });
      return response.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        setVerified(true);
      } else {
        setError("Pagamento ainda nao confirmado. Aguarde alguns instantes.");
      }
    },
    onError: () => {
      setError("Erro ao verificar pagamento. Tente novamente.");
    },
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get("session_id");
    
    if (sessionId) {
      verifyMutation.mutate(sessionId);
    } else {
      setError("Sessao de pagamento nao encontrada.");
    }
  }, []);

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
          borderColor: verified ? "rgba(34, 197, 94, 0.5)" : "rgba(59, 130, 246, 0.5)",
        }}
        className="w-full max-w-md border"
      >
        <CardHeader>
          <div className="flex items-center gap-3 mb-4">
            {verifyMutation.isPending ? (
              <Loader2 className="w-6 h-6 text-blue-400 animate-spin" />
            ) : verified ? (
              <CheckCircle className="w-6 h-6 text-green-400" />
            ) : (
              <Loader2 className="w-6 h-6 text-blue-400" />
            )}
            <CardTitle className="text-white">
              {verifyMutation.isPending
                ? "Verificando Pagamento..."
                : verified
                ? "Assinatura Ativada!"
                : "Processando..."}
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {verifyMutation.isPending && (
            <div className="text-center">
              <p className="text-gray-300">Aguarde enquanto verificamos seu pagamento...</p>
            </div>
          )}

          {verified && (
            <>
              <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4 text-center">
                <p className="text-green-300 text-lg font-semibold mb-2">Parabens!</p>
                <p className="text-gray-300 text-sm">
                  Sua assinatura foi ativada com sucesso. Voce ja pode acessar o painel completo.
                </p>
              </div>

              <Button
                onClick={() => setLocation("/vendor-dashboard")}
                className="w-full bg-gradient-to-r from-blue-500 to-violet-600 hover:from-blue-600 hover:to-violet-700"
                data-testid="button-go-dashboard"
              >
                Ir para o Painel
              </Button>
            </>
          )}

          {error && (
            <>
              <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4 text-center">
                <p className="text-yellow-300 text-sm">{error}</p>
              </div>

              <Button
                onClick={() => window.location.reload()}
                variant="outline"
                className="w-full text-white border-gray-600 hover:bg-gray-800"
                data-testid="button-retry"
              >
                Tentar Novamente
              </Button>
            </>
          )}

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
