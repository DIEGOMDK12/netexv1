import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

export function VendorSettingsEnhanced({ vendorId, vendorData }: { vendorId: number; vendorData: any }) {
  const { toast } = useToast();
  const [settings, setSettings] = useState({
    storeName: vendorData?.storeName || "",
    logoUrl: vendorData?.logoUrl || "",
    themeColor: vendorData?.themeColor || "#3B82F6",
    pixKey: vendorData?.pixKey || "",
    phone: vendorData?.phone || "",
    cpf: vendorData?.cpf || "",
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
