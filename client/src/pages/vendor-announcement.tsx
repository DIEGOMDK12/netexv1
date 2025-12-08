import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Megaphone, Loader2, Save, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";

interface AnnouncementSettings {
  enabled: boolean;
  text: string;
  backgroundColor: string;
  textColor: string;
}

export function VendorAnnouncement() {
  const { toast } = useToast();
  const vendorToken = localStorage.getItem("vendor_token");
  
  const [settings, setSettings] = useState<AnnouncementSettings>({
    enabled: false,
    text: "",
    backgroundColor: "#9333EA",
    textColor: "#FFFFFF",
  });

  const { data, isLoading } = useQuery<AnnouncementSettings>({
    queryKey: ["/api/vendor/announcement"],
    queryFn: async () => {
      const response = await fetch("/api/vendor/announcement", {
        headers: { Authorization: `Bearer ${vendorToken}` },
      });
      if (!response.ok) throw new Error("Erro ao carregar configuracoes");
      return response.json();
    },
    enabled: !!vendorToken,
  });

  useEffect(() => {
    if (data) {
      setSettings({
        enabled: data.enabled ?? false,
        text: data.text || "",
        backgroundColor: data.backgroundColor || "#9333EA",
        textColor: data.textColor || "#FFFFFF",
      });
    }
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: async (data: AnnouncementSettings) => {
      const response = await fetch("/api/vendor/announcement", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${vendorToken}`,
        },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Erro ao salvar");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vendor/announcement"] });
      toast({ title: "Barra de anuncio atualizada com sucesso!" });
    },
    onError: (error: Error) => {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Megaphone className="w-8 h-8 text-purple-400" />
        <div>
          <h1 className="text-2xl font-bold text-white">Barra de Anuncio</h1>
          <p className="text-gray-400 text-sm">Configure a faixa de anuncio no topo da sua loja</p>
        </div>
      </div>

      {settings.enabled && settings.text && (
        <div className="mb-4">
          <Label className="text-gray-400 text-sm mb-2 block">Pre-visualizacao:</Label>
          <div
            className="w-full py-2 px-4 text-center text-sm font-medium rounded-lg"
            style={{
              backgroundColor: settings.backgroundColor,
              color: settings.textColor,
            }}
            data-testid="preview-announcement"
          >
            {settings.text || "Seu texto aparecera aqui..."}
          </div>
        </div>
      )}

      <Card className="bg-[#1a1a1a] border-gray-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <span>Configuracoes</span>
          </CardTitle>
          <CardDescription>
            A barra de anuncio aparece no topo da sua loja, acima do cabecalho
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between p-4 rounded-lg bg-[#242424]">
            <div className="flex items-center gap-3">
              {settings.enabled ? (
                <Eye className="w-5 h-5 text-green-400" />
              ) : (
                <EyeOff className="w-5 h-5 text-gray-500" />
              )}
              <div>
                <Label className="text-white">Ativar Barra de Anuncio</Label>
                <p className="text-gray-500 text-xs">Exibe a faixa no topo da loja</p>
              </div>
            </div>
            <Switch
              checked={settings.enabled}
              onCheckedChange={(checked) => setSettings({ ...settings, enabled: checked })}
              data-testid="switch-announcement-enabled"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-gray-300">Texto do Anuncio</Label>
            <Textarea
              value={settings.text}
              onChange={(e) => setSettings({ ...settings, text: e.target.value })}
              placeholder="Ex: Use o cupom PROMO10 para 10% OFF em compras acima de R$15!"
              className="bg-[#242424] border-gray-600 text-white min-h-[80px]"
              data-testid="input-announcement-text"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-gray-300">Cor de Fundo</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={settings.backgroundColor}
                  onChange={(e) => setSettings({ ...settings, backgroundColor: e.target.value })}
                  className="w-10 h-10 rounded cursor-pointer border-0 bg-transparent"
                  data-testid="input-bg-color"
                />
                <Input
                  value={settings.backgroundColor}
                  onChange={(e) => setSettings({ ...settings, backgroundColor: e.target.value })}
                  className="bg-[#242424] border-gray-600 text-white flex-1"
                  placeholder="#9333EA"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-gray-300">Cor do Texto</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={settings.textColor}
                  onChange={(e) => setSettings({ ...settings, textColor: e.target.value })}
                  className="w-10 h-10 rounded cursor-pointer border-0 bg-transparent"
                  data-testid="input-text-color"
                />
                <Input
                  value={settings.textColor}
                  onChange={(e) => setSettings({ ...settings, textColor: e.target.value })}
                  className="bg-[#242424] border-gray-600 text-white flex-1"
                  placeholder="#FFFFFF"
                />
              </div>
            </div>
          </div>

          <div className="p-4 rounded-lg bg-purple-500/10 border border-purple-500/20">
            <p className="text-purple-300 text-sm">
              Dica: Use a barra de anuncio para promover cupons de desconto, frete gratis ou novidades da sua loja!
            </p>
          </div>

          <Button
            onClick={() => saveMutation.mutate(settings)}
            disabled={saveMutation.isPending}
            className="w-full bg-purple-600 hover:bg-purple-700"
            data-testid="button-save-announcement"
          >
            {saveMutation.isPending ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            Salvar Configuracoes
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
