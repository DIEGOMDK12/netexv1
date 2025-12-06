import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff } from "lucide-react";

export function VendorSettings() {
  const { toast } = useToast();
  const [showToken, setShowToken] = useState(false);
  const [settings, setSettings] = useState({
    pagseguroToken: "",
    storeName: "",
    email: "",
  });

  const handleSaveSettings = () => {
    toast({
      title: "Configurações salvas!",
      description: "Suas alterações foram aplicadas com sucesso",
    });
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-white">Configurações</h1>

      {/* PagSeguro Settings */}
      <Card
        style={{
          background: "rgba(30, 30, 30, 0.4)",
          backdropFilter: "blur(12px)",
          border: "1px solid rgba(255, 255, 255, 0.1)",
        }}
      >
        <CardHeader>
          <CardTitle className="text-white">Integração PagSeguro</CardTitle>
          <p className="text-sm text-gray-400 mt-1">Configure seu token para receber pagamentos</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label className="text-white">Token de Autenticação</Label>
            <div className="relative">
              <Input
                type={showToken ? "text" : "password"}
                value={settings.pagseguroToken}
                onChange={(e) => setSettings({ ...settings, pagseguroToken: e.target.value })}
                placeholder="Seu token do PagSeguro"
                className="pr-10"
                style={{
                  background: "rgba(30, 30, 40, 0.4)",
                  backdropFilter: "blur(10px)",
                  borderColor: "rgba(255,255,255,0.1)",
                  color: "#FFFFFF",
                }}
                data-testid="input-pagseguro-token"
              />
              <button
                type="button"
                onClick={() => setShowToken(!showToken)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-300"
                data-testid="button-toggle-token"
              >
                {showToken ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
            <p className="text-xs text-gray-500">
              Encontre seu token em: Configurações → Integrações → API
            </p>
          </div>

          <Button
            onClick={handleSaveSettings}
            style={{
              background: "linear-gradient(135deg, #3b82f6 0%, #8b5cf6 50%, #ec4899 100%)",
              color: "#FFFFFF",
              border: "1px solid rgba(255, 255, 255, 0.2)",
            }}
            data-testid="button-save-pagseguro"
          >
            Salvar Configurações
          </Button>
        </CardContent>
      </Card>

      {/* Store Info */}
      <Card
        style={{
          background: "rgba(30, 30, 30, 0.4)",
          backdropFilter: "blur(12px)",
          border: "1px solid rgba(255, 255, 255, 0.1)",
        }}
      >
        <CardHeader>
          <CardTitle className="text-white">Informações da Loja</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label className="text-white">Nome da Loja</Label>
            <Input
              value={settings.storeName}
              onChange={(e) => setSettings({ ...settings, storeName: e.target.value })}
              placeholder="Minha Loja"
              style={{
                background: "rgba(30, 30, 40, 0.4)",
                backdropFilter: "blur(10px)",
                borderColor: "rgba(255,255,255,0.1)",
                color: "#FFFFFF",
              }}
              data-testid="input-store-name"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-white">Email</Label>
            <Input
              value={settings.email}
              onChange={(e) => setSettings({ ...settings, email: e.target.value })}
              placeholder="seu@email.com"
              style={{
                background: "rgba(30, 30, 40, 0.4)",
                backdropFilter: "blur(10px)",
                borderColor: "rgba(255,255,255,0.1)",
                color: "#FFFFFF",
              }}
              data-testid="input-email-settings"
            />
          </div>

          <Button
            onClick={handleSaveSettings}
            variant="outline"
            data-testid="button-save-store-info"
          >
            Salvar Informações
          </Button>
        </CardContent>
      </Card>

      {/* Account Info */}
      <Card
        style={{
          background: "rgba(30, 30, 30, 0.4)",
          backdropFilter: "blur(12px)",
          border: "1px solid rgba(255, 255, 255, 0.1)",
        }}
      >
        <CardHeader>
          <CardTitle className="text-white">Informações da Conta</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <p className="text-sm text-gray-400">Membro desde: 01 de Dezembro, 2025</p>
            <p className="text-sm text-gray-400">Vendas totais: R$ 0,00</p>
            <p className="text-sm text-gray-400">Comissão acumulada: R$ 0,00</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
