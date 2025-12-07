import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CreditCard, Wallet } from "lucide-react";

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
    pagseguroSandbox: vendorData?.pagseguroSandbox ?? true,
    abacatePayToken: vendorData?.abacatePayToken || "",
    preferredPaymentMethod: vendorData?.preferredPaymentMethod || "abacatepay",
  });

  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("PATCH", `/api/vendor/settings/${vendorId}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vendor/profile", vendorId] });
      alert("Dados salvos com sucesso!");
      toast({
        title: "Sucesso",
        description: "Configurações atualizadas!",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error?.message || "Não foi possível salvar as configurações",
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
      pagseguroSandbox: settings.pagseguroSandbox,
      abacatePayToken: settings.abacatePayToken,
      preferredPaymentMethod: settings.preferredPaymentMethod,
    });
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-white">Configurações</h1>

      {/* Store Customization */}
      <Card
        style={{
          background: "rgba(30, 30, 30, 0.4)",
          backdropFilter: "blur(12px)",
          border: "1px solid rgba(255, 255, 255, 0.1)",
        }}
      >
        <CardHeader>
          <CardTitle className="text-white">Personalização da Loja</CardTitle>
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
            <p className="text-xs text-gray-500">Link direto para sua logo (PNG/JPG). Aparecerá no topo de todas as páginas.</p>
            {settings.logoUrl && (
              <div className="mt-2 p-3 rounded-lg border border-white/10 bg-white/5">
                <p className="text-xs text-gray-400 mb-2">Prévia:</p>
                <img src={settings.logoUrl} alt="Logo preview" className="h-10 object-contain" />
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label className="text-white">Chave PIX para Receber</Label>
            <Input
              value={settings.pixKey}
              onChange={(e) => setSettings({ ...settings, pixKey: e.target.value })}
              placeholder="CPF, Email, Telefone ou Chave Aleatória"
              style={{
                background: "rgba(30, 30, 40, 0.4)",
                backdropFilter: "blur(10px)",
                borderColor: "rgba(255,255,255,0.1)",
                color: "#FFFFFF",
              }}
              data-testid="input-pix-key"
            />
            <p className="text-xs text-gray-500">Seus clientes enviarão PIX para essa chave ao comprar</p>
          </div>

          <div className="space-y-2">
            <Label className="text-white">Seu Telefone</Label>
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

          <div className="space-y-2">
            <Label className="text-white">CPF/CNPJ</Label>
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
                <p className="text-xs text-gray-500">Seus botões aparecerão nesta cor</p>
              </div>
            </div>
          </div>

          <Button
            onClick={handleSaveSettings}
            disabled={saveMutation.isPending}
            style={{
              background: "linear-gradient(135deg, #3b82f6 0%, #8b5cf6 50%, #ec4899 100%)",
              color: "#FFFFFF",
              border: "1px solid rgba(255, 255, 255, 0.2)",
            }}
            data-testid="button-save-store-settings"
            className="w-full"
          >
            {saveMutation.isPending ? "Salvando..." : "Salvar Configurações"}
          </Button>
        </CardContent>
      </Card>

      {/* Payment Configuration - PagSeguro */}
      <Card
        style={{
          background: "rgba(30, 30, 30, 0.4)",
          backdropFilter: "blur(12px)",
          border: "1px solid rgba(255, 255, 255, 0.1)",
        }}
      >
        <CardHeader>
          <div className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-green-500" />
            <CardTitle className="text-white">Configuração de Pagamentos</CardTitle>
          </div>
          <CardDescription className="text-gray-400">
            Configure como você deseja receber pagamentos PIX dos seus clientes
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Payment Method Selection */}
          <div className="space-y-3">
            <Label className="text-white">Método de Recebimento Preferido</Label>
            <Select
              value={settings.preferredPaymentMethod}
              onValueChange={(value) => setSettings({ ...settings, preferredPaymentMethod: value })}
            >
              <SelectTrigger 
                style={{
                  background: "rgba(30, 30, 40, 0.4)",
                  backdropFilter: "blur(10px)",
                  borderColor: "rgba(255,255,255,0.1)",
                  color: "#FFFFFF",
                }}
                data-testid="select-payment-method"
              >
                <SelectValue placeholder="Selecione o método" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="abacatepay">
                  <div className="flex items-center gap-2">
                    <Wallet className="h-4 w-4" />
                    <span>AbacatePay (Plataforma)</span>
                  </div>
                </SelectItem>
                <SelectItem value="pagseguro">
                  <div className="flex items-center gap-2">
                    <CreditCard className="h-4 w-4" />
                    <span>PagSeguro (Sua conta)</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-gray-500">
              {settings.preferredPaymentMethod === "abacatepay" 
                ? "Pagamentos via AbacatePay - processado pela plataforma" 
                : "Pagamentos via PagSeguro - você recebe diretamente na sua conta"}
            </p>
          </div>

          {/* AbacatePay Config - Only show if abacatepay is selected */}
          {settings.preferredPaymentMethod === "abacatepay" && (
            <div className="space-y-4 p-4 rounded-lg border border-purple-500/30 bg-purple-500/5">
              <div className="flex items-center gap-2 mb-2">
                <Wallet className="h-4 w-4 text-purple-500" />
                <span className="text-sm font-medium text-purple-400">Configuracao AbacatePay</span>
              </div>
              
              <div className="space-y-2">
                <Label className="text-white">Token da API AbacatePay</Label>
                <Input
                  type="password"
                  value={settings.abacatePayToken}
                  onChange={(e) => setSettings({ ...settings, abacatePayToken: e.target.value })}
                  placeholder="Seu token de API do AbacatePay"
                  style={{
                    background: "rgba(30, 30, 40, 0.4)",
                    backdropFilter: "blur(10px)",
                    borderColor: "rgba(255,255,255,0.1)",
                    color: "#FFFFFF",
                  }}
                  data-testid="input-abacatepay-token"
                />
                <p className="text-xs text-gray-500">
                  Encontre seu token em: AbacatePay &gt; Configuracoes &gt; API &gt; Gerar Token
                </p>
              </div>

              {settings.abacatePayToken ? (
                <div className="p-3 rounded-lg bg-purple-500/10 border border-purple-500/30">
                  <p className="text-sm text-purple-400 font-medium">
                    Token Configurado
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    Pagamentos PIX serao enviados diretamente para sua conta AbacatePay
                  </p>
                </div>
              ) : (
                <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
                  <p className="text-sm text-yellow-400 font-medium">
                    Token Nao Configurado
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    Configure seu token para receber pagamentos diretamente na sua conta
                  </p>
                </div>
              )}
            </div>
          )}

          {/* PagSeguro Config - Only show if pagseguro is selected */}
          {settings.preferredPaymentMethod === "pagseguro" && (
            <div className="space-y-4 p-4 rounded-lg border border-green-500/30 bg-green-500/5">
              <div className="flex items-center gap-2 mb-2">
                <CreditCard className="h-4 w-4 text-green-500" />
                <span className="text-sm font-medium text-green-400">Configuração PagSeguro</span>
              </div>
              
              <div className="space-y-2">
                <Label className="text-white">Token do PagSeguro</Label>
                <Input
                  type="password"
                  value={settings.pagseguroToken}
                  onChange={(e) => setSettings({ ...settings, pagseguroToken: e.target.value })}
                  placeholder="Seu token de autenticação do PagSeguro"
                  style={{
                    background: "rgba(30, 30, 40, 0.4)",
                    backdropFilter: "blur(10px)",
                    borderColor: "rgba(255,255,255,0.1)",
                    color: "#FFFFFF",
                  }}
                  data-testid="input-pagseguro-token"
                />
                <p className="text-xs text-gray-500">
                  Encontre seu token em: PagSeguro &gt; Minha Conta &gt; Integrações &gt; Gerar Token
                </p>
              </div>

              <div className="space-y-2">
                <Label className="text-white">Email do PagSeguro</Label>
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
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
                <div className="space-y-1">
                  <Label className="text-white">Modo Sandbox (Teste)</Label>
                  <p className="text-xs text-gray-400">
                    Ative para testar sem processar pagamentos reais
                  </p>
                </div>
                <Switch
                  checked={settings.pagseguroSandbox}
                  onCheckedChange={(checked) => setSettings({ ...settings, pagseguroSandbox: checked })}
                  data-testid="switch-pagseguro-sandbox"
                />
              </div>

              {!settings.pagseguroSandbox && (
                <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/30">
                  <p className="text-sm text-green-400 font-medium">
                    Modo Produção Ativo
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    Pagamentos serão processados e você receberá diretamente na sua conta PagSeguro
                  </p>
                </div>
              )}
            </div>
          )}

          <Button
            onClick={handleSaveSettings}
            disabled={saveMutation.isPending}
            style={{
              background: "linear-gradient(135deg, #22c55e 0%, #16a34a 100%)",
              color: "#FFFFFF",
              border: "1px solid rgba(255, 255, 255, 0.2)",
            }}
            data-testid="button-save-payment-settings"
            className="w-full"
          >
            {saveMutation.isPending ? "Salvando..." : "Salvar Configurações de Pagamento"}
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
        <CardContent className="space-y-2">
          <p className="text-sm text-gray-400">Email: {vendorData?.email}</p>
          <p className="text-sm text-gray-400">Slug: {vendorData?.slug}</p>
          <p className="text-sm text-gray-400">Comissão: {vendorData?.commissionPercent}%</p>
          <p className="text-sm text-gray-400">Total de vendas: R$ {parseFloat(vendorData?.totalSales as any || "0").toFixed(2)}</p>
        </CardContent>
      </Card>
    </div>
  );
}
