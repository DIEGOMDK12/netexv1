import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { CreditCard, Info, Wallet } from "lucide-react";

export function VendorSettingsEnhanced({ vendorId, vendorData }: { vendorId: number; vendorData: any }) {
  const { toast } = useToast();
  const [settings, setSettings] = useState({
    storeName: vendorData?.storeName || "",
    logoUrl: vendorData?.logoUrl || "",
    themeColor: vendorData?.themeColor || "#3B82F6",
    pixKey: vendorData?.pixKey || "",
    phone: vendorData?.phone || "",
    cpf: vendorData?.cpf || "",
    pagseguroToken: vendorData?.pagseguroToken || "",
    pagseguroEmail: vendorData?.pagseguroEmail || "",
  });

  const vendorToken = localStorage.getItem("vendor_token");

  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await fetch(`/api/vendor/settings/${vendorId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${vendorToken}`,
        },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Erro ao salvar');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vendor/profile", vendorId] });
      toast({
        title: "Sucesso",
        description: "Configuracoes atualizadas!",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error?.message || "Nao foi possivel salvar as configuracoes",
        variant: "destructive",
      });
    },
  });

  const handleSaveSettings = () => {
    saveMutation.mutate({
      storeName: settings.storeName,
      logoUrl: settings.logoUrl,
      themeColor: settings.themeColor,
      pixKey: settings.pixKey,
      phone: settings.phone,
      cpf: settings.cpf,
      pagseguroToken: settings.pagseguroToken,
      pagseguroEmail: settings.pagseguroEmail,
    });
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-white">Configuracoes</h1>

      {/* Configuracao PagSeguro */}
      <Card
        style={{
          background: "rgba(20, 184, 166, 0.1)",
          backdropFilter: "blur(12px)",
          border: "1px solid rgba(20, 184, 166, 0.3)",
        }}
      >
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-teal-500/20 flex items-center justify-center">
              <CreditCard className="w-5 h-5 text-teal-400" />
            </div>
            <div>
              <CardTitle className="text-white">PagSeguro - Receber Pagamentos</CardTitle>
              <p className="text-sm text-teal-400 mt-1">Configure para gerar PIX QR Code</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start gap-3 p-4 rounded-lg bg-teal-500/10">
            <Info className="w-5 h-5 text-teal-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm text-teal-300">
                Configure seu token do PagSeguro para receber pagamentos dos clientes diretamente na sua conta via PIX QR Code.
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-white">E-mail da conta PagSeguro</Label>
            <Input
              type="email"
              value={settings.pagseguroEmail}
              onChange={(e) => setSettings({ ...settings, pagseguroEmail: e.target.value })}
              placeholder="seu-email@pagseguro.com"
              style={{
                background: "rgba(30, 30, 40, 0.4)",
                backdropFilter: "blur(10px)",
                borderColor: "rgba(255,255,255,0.1)",
                color: "#FFFFFF",
              }}
              data-testid="input-pagseguro-email"
            />
            <p className="text-xs text-gray-400">E-mail cadastrado na sua conta PagSeguro</p>
          </div>

          <div className="space-y-2">
            <Label className="text-white">Token de Producao PagSeguro</Label>
            <Input
              type="password"
              value={settings.pagseguroToken}
              onChange={(e) => setSettings({ ...settings, pagseguroToken: e.target.value })}
              placeholder="Cole seu token de producao aqui"
              style={{
                background: "rgba(30, 30, 40, 0.4)",
                backdropFilter: "blur(10px)",
                borderColor: "rgba(255,255,255,0.1)",
                color: "#FFFFFF",
              }}
              data-testid="input-pagseguro-token"
            />
            <p className="text-xs text-gray-400">
              Obtenha em: PagSeguro - Minha Conta - Integracoes - Token de Producao
            </p>
          </div>

          {settings.pagseguroToken && settings.pagseguroEmail && (
            <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/30">
              <p className="text-sm text-green-300">
                PagSeguro configurado! Os pagamentos dos seus clientes irao direto para sua conta.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Chave PIX para Saques */}
      <Card
        style={{
          background: "rgba(30, 30, 30, 0.4)",
          backdropFilter: "blur(12px)",
          border: "1px solid rgba(255, 255, 255, 0.1)",
        }}
      >
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
              <Wallet className="w-5 h-5 text-green-400" />
            </div>
            <div>
              <CardTitle className="text-white">Dados para Saque</CardTitle>
              <p className="text-sm text-gray-400 mt-1">Configure onde receber seus saques via Pix</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label className="text-white">Chave PIX para Receber Saques</Label>
            <Input
              value={settings.pixKey}
              onChange={(e) => setSettings({ ...settings, pixKey: e.target.value })}
              placeholder="CPF, Email, Telefone ou Chave Aleatoria"
              style={{
                background: "rgba(30, 30, 40, 0.4)",
                backdropFilter: "blur(10px)",
                borderColor: "rgba(255,255,255,0.1)",
                color: "#FFFFFF",
              }}
              data-testid="input-pix-key"
            />
            <p className="text-xs text-gray-500">Esta chave sera usada para receber seus saques</p>
          </div>

          <div className="space-y-2">
            <Label className="text-white">CPF/CNPJ do Titular</Label>
            <Input
              value={settings.cpf}
              onChange={(e) => setSettings({ ...settings, cpf: e.target.value })}
              placeholder="000.000.000-00"
              style={{
                background: "rgba(30, 30, 40, 0.4)",
                backdropFilter: "blur(10px)",
                borderColor: "rgba(255,255,255,0.1)",
                color: "#FFFFFF",
              }}
              data-testid="input-cpf"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-white">Telefone</Label>
            <Input
              value={settings.phone}
              onChange={(e) => setSettings({ ...settings, phone: e.target.value })}
              placeholder="(85) 98888-7000"
              style={{
                background: "rgba(30, 30, 40, 0.4)",
                backdropFilter: "blur(10px)",
                borderColor: "rgba(255,255,255,0.1)",
                color: "#FFFFFF",
              }}
              data-testid="input-phone"
            />
          </div>
        </CardContent>
      </Card>

      {/* Store Customization */}
      <Card
        style={{
          background: "rgba(30, 30, 30, 0.4)",
          backdropFilter: "blur(12px)",
          border: "1px solid rgba(255, 255, 255, 0.1)",
        }}
      >
        <CardHeader>
          <CardTitle className="text-white">Personalizacao da Loja</CardTitle>
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
            <Label className="text-white">URL da Logo</Label>
            <Input
              value={settings.logoUrl}
              onChange={(e) => setSettings({ ...settings, logoUrl: e.target.value })}
              placeholder="https://exemplo.com/logo.png"
              style={{
                background: "rgba(30, 30, 40, 0.4)",
                backdropFilter: "blur(10px)",
                borderColor: "rgba(255,255,255,0.1)",
                color: "#FFFFFF",
              }}
              data-testid="input-logo-url"
            />
            <p className="text-xs text-gray-500">Link direto para sua logo (PNG/JPG)</p>
            {settings.logoUrl && (
              <div className="mt-2 p-3 rounded-lg border border-white/10 bg-white/5">
                <p className="text-xs text-gray-400 mb-2">Previa:</p>
                <img src={settings.logoUrl} alt="Logo preview" className="h-10 object-contain" />
              </div>
            )}
          </div>

          <div className="space-y-3">
            <Label className="text-white">Cor do Tema</Label>
            <div className="flex items-center gap-4 flex-col sm:flex-row">
              <div className="relative w-full sm:w-24 h-12 rounded-lg border border-white/20 overflow-hidden">
                <input
                  type="color"
                  value={settings.themeColor}
                  onChange={(e) => setSettings({ ...settings, themeColor: e.target.value })}
                  className="w-full h-full cursor-pointer"
                  data-testid="input-theme-color"
                />
              </div>
              <p className="text-sm text-gray-400">{settings.themeColor}</p>
            </div>
            <div className="mt-4 p-4 rounded-lg border border-white/10 flex items-center gap-3">
              <div
                className="w-8 h-8 rounded-lg"
                style={{ backgroundColor: settings.themeColor }}
              />
              <div>
                <p className="text-sm text-gray-400">Cor selecionada</p>
                <p className="text-xs text-gray-500">Seus botoes aparecerao nesta cor</p>
              </div>
            </div>
          </div>
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
          <CardTitle className="text-white">Informacoes da Conta</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-sm text-gray-400">Email: {vendorData?.email}</p>
          <p className="text-sm text-gray-400">Link da loja: /{vendorData?.slug}</p>
          <p className="text-sm text-gray-400">Comissao: {vendorData?.commissionPercent}%</p>
          <p className="text-sm text-gray-400">Total de vendas: R$ {parseFloat(vendorData?.totalSales as any || "0").toFixed(2)}</p>
        </CardContent>
      </Card>

      {/* Save Button */}
      <Button
        onClick={handleSaveSettings}
        disabled={saveMutation.isPending}
        className="w-full bg-teal-600 hover:bg-teal-700 text-white h-10"
        data-testid="button-save-settings"
      >
        {saveMutation.isPending ? "Salvando..." : "Salvar Configuracoes"}
      </Button>
    </div>
  );
}
