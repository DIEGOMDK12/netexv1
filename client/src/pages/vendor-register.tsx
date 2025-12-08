import { useState } from "react";
import { useLocation, Link } from "wouter";
import { Eye, EyeOff, Loader2, Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

export default function VendorRegister() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [storeName, setStoreName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const slug = storeName.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
      
      const response = await apiRequest("POST", "/api/vendor/register", {
        name: storeName,
        email,
        password,
        slug,
        storeName,
      });

      const data = await response.json();

      if (response.ok && data.vendor) {
        localStorage.setItem("vendor_token", data.token);
        localStorage.setItem("vendor_id", data.vendor.id);
        toast({
          title: "Bem-vindo!",
          description: "Sua loja foi criada com sucesso",
        });
        setLocation("/vendor/dashboard");
      } else {
        toast({
          title: "Erro",
          description: data.error || "Não foi possível criar a loja",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Erro",
        description: "Não foi possível criar a loja",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{
        background: "linear-gradient(135deg, #0a0e27 0%, #1a1a3e 50%, #0f0a2e 100%)",
      }}
    >
      <Card
        className="w-full max-w-sm"
        style={{
          background: "rgba(30, 30, 30, 0.4)",
          backdropFilter: "blur(12px)",
          border: "1px solid rgba(255, 255, 255, 0.1)",
        }}
      >
        <CardHeader className="text-center pb-2">
          <div
            className="w-14 h-14 rounded-full mx-auto mb-3 flex items-center justify-center"
            style={{
              background: "rgba(59, 130, 246, 0.2)",
            }}
          >
            <Store className="w-7 h-7 text-blue-500" />
          </div>
          <CardTitle className="text-xl text-white">Crie sua Loja</CardTitle>
          <p className="text-xs text-gray-400 mt-1">Comece a vender seus produtos digitais</p>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleRegister} className="space-y-4">
            <div className="space-y-2">
              <Label className="text-white">Nome da Loja</Label>
              <Input
                type="text"
                value={storeName}
                onChange={(e) => setStoreName(e.target.value)}
                placeholder="Sua loja"
                className="h-10"
                style={{
                  background: "rgba(30, 30, 40, 0.4)",
                  backdropFilter: "blur(10px)",
                  borderColor: "rgba(255,255,255,0.1)",
                  color: "#FFFFFF",
                }}
                data-testid="input-store-name"
                required
              />
            </div>

            <div className="space-y-2">
              <Label className="text-white">Email</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                className="h-10"
                style={{
                  background: "rgba(30, 30, 40, 0.4)",
                  backdropFilter: "blur(10px)",
                  borderColor: "rgba(255,255,255,0.1)",
                  color: "#FFFFFF",
                }}
                data-testid="input-email"
                required
              />
            </div>

            <div className="space-y-2">
              <Label className="text-white">Senha</Label>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Crie uma senha segura"
                  className="h-10 pr-10"
                  style={{
                    background: "rgba(30, 30, 40, 0.4)",
                    backdropFilter: "blur(10px)",
                    borderColor: "rgba(255,255,255,0.1)",
                    color: "#FFFFFF",
                  }}
                  data-testid="input-password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                  data-testid="button-toggle-password"
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4 text-gray-400" />
                  ) : (
                    <Eye className="w-4 h-4 text-gray-400" />
                  )}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              disabled={isLoading || !storeName || !email || !password}
              className="w-full mt-6"
              style={{
                background: isLoading || !storeName || !email || !password 
                  ? "#555555"
                  : "linear-gradient(135deg, #3b82f6 0%, #8b5cf6 50%, #ec4899 100%)",
                color: "#FFFFFF",
                border: "1px solid rgba(255, 255, 255, 0.2)",
              }}
              data-testid="button-register"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Criando...
                </>
              ) : (
                "Criar Loja"
              )}
            </Button>
          </form>

          <p className="text-sm text-gray-400 text-center mt-4">
            Já possui uma conta?{" "}
            <Link
              href="/login"
              className="font-bold text-purple-400 hover:text-purple-300 transition-colors"
              data-testid="link-login"
            >
              Fazer Login
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
