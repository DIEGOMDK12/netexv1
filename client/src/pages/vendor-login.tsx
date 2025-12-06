import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Lock, Mail } from "lucide-react";

export default function VendorLogin() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [credentials, setCredentials] = useState({
    email: "",
    password: "",
  });

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch("/api/vendor/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(credentials),
      });

      const data = await response.json();

      if (!response.ok) {
        const errorMsg = data.error || "Email ou senha incorretos";
        console.error("[VendorLogin] Login failed:", errorMsg);
        toast({
          title: "Erro ao fazer login",
          description: errorMsg,
          variant: "destructive",
        });
        return;
      }

      // Store vendor data
      localStorage.setItem("vendor_id", data.vendor.id.toString());
      localStorage.setItem("vendor_token", data.token);

      // Check subscription status
      const subscriptionStatus = data.vendor.subscriptionStatus;
      const subscriptionExpiresAt = data.vendor.subscriptionExpiresAt;
      
      console.log("[🟢 VendorLogin] Raw subscription data:", {
        status: subscriptionStatus,
        expiresAt: subscriptionExpiresAt,
      });

      // Convert to date if string
      const expiresAt = subscriptionExpiresAt ? new Date(subscriptionExpiresAt) : null;
      const now = new Date();
      const isExpired = expiresAt ? expiresAt.getTime() < now.getTime() : true;
      const isActive = subscriptionStatus === "active" && !isExpired;

      console.log("[🟢 VendorLogin] Subscription validation:", {
        status: subscriptionStatus,
        expiresAtISO: expiresAt?.toISOString(),
        nowISO: now.toISOString(),
        isExpired,
        isActive,
        diff_ms: expiresAt ? expiresAt.getTime() - now.getTime() : 'N/A',
      });

      if (isActive) {
        console.log("[🟢 VendorLogin] ✅ SUBSCRIPTION ATIVA - Acesso permitido ao dashboard");
        toast({
          title: "Sucesso!",
          description: "Bem-vindo ao seu painel de vendedor",
        });
        // Redirect to vendor dashboard
        setLocation("/vendor/dashboard");
      } else {
        console.log("[🟢 VendorLogin] ❌ Subscription inativa/expirada - redirecionando para pagamento");
        console.log("[🟢 VendorLogin] Motivo:", {
          statusNotActive: subscriptionStatus !== "active",
          dateExpired: isExpired,
        });
        toast({
          title: "Ativação de Assinatura Necessária",
          description: "Complete o pagamento para acessar seu painel",
        });
        setLocation("/subscription-payment");
      }
    } catch (error) {
      toast({
        title: "Erro",
        description: "Falha na conexão",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="flex items-center justify-center min-h-screen p-4"
      style={{
        background: "linear-gradient(135deg, #0a0e27 0%, #1a1a3e 50%, #0f0a2e 100%)",
      }}
    >
      <Card
        className="w-full max-w-md"
        style={{
          background: "rgba(30, 30, 30, 0.4)",
          backdropFilter: "blur(12px)",
          border: "1px solid rgba(255, 255, 255, 0.1)",
        }}
      >
        <CardHeader className="text-center space-y-2">
          <div className="flex justify-center mb-4">
            <Lock className="w-10 h-10 text-blue-500" />
          </div>
          <CardTitle className="text-white text-2xl">Entrar na Loja</CardTitle>
          <p className="text-xs text-gray-400">Acesso ao painel do revendedor</p>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-white">
                E-mail
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <Input
                  id="email"
                  type="email"
                  value={credentials.email}
                  onChange={(e) =>
                    setCredentials({ ...credentials, email: e.target.value })
                  }
                  placeholder="seu@email.com"
                  className="pl-10"
                  style={{
                    background: "rgba(30, 30, 40, 0.4)",
                    backdropFilter: "blur(10px)",
                    borderColor: "rgba(255,255,255,0.1)",
                    color: "#FFFFFF",
                  }}
                  data-testid="input-vendor-email"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-white">
                Senha
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <Input
                  id="password"
                  type="password"
                  value={credentials.password}
                  onChange={(e) =>
                    setCredentials({ ...credentials, password: e.target.value })
                  }
                  placeholder="••••••••"
                  className="pl-10"
                  style={{
                    background: "rgba(30, 30, 40, 0.4)",
                    backdropFilter: "blur(10px)",
                    borderColor: "rgba(255,255,255,0.1)",
                    color: "#FFFFFF",
                  }}
                  data-testid="input-vendor-password"
                />
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full"
              style={{
                background: "linear-gradient(135deg, #3b82f6 0%, #8b5cf6 50%, #ec4899 100%)",
                color: "#FFFFFF",
              }}
              data-testid="button-vendor-login-submit"
            >
              {loading ? "Entrando..." : "Entrar na Loja"}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-gray-400">
              Não tem conta?{" "}
              <button
                onClick={() => setLocation("/register")}
                className="text-blue-400 hover:text-blue-300 font-semibold"
                data-testid="button-go-register"
              >
                Cadastre-se aqui
              </button>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
