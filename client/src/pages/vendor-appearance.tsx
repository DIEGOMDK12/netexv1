import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Palette, Loader2, Save, RotateCcw, ShoppingCart, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";

interface ThemeSettings {
  backgroundColor: string;
  buttonColor: string;
  textColor: string;
  cardBackgroundColor: string;
  secondaryColor: string;
}

const DEFAULT_THEME: ThemeSettings = {
  backgroundColor: "#111827",
  buttonColor: "#8B5CF6",
  textColor: "#FFFFFF",
  cardBackgroundColor: "#1A1A2E",
  secondaryColor: "#6366F1",
};

export function VendorAppearance() {
  const { toast } = useToast();
  const vendorToken = localStorage.getItem("vendor_token");

  const [settings, setSettings] = useState<ThemeSettings>(DEFAULT_THEME);

  const { data, isLoading } = useQuery<ThemeSettings>({
    queryKey: ["/api/vendor/appearance"],
    queryFn: async () => {
      const response = await fetch("/api/vendor/appearance", {
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
        backgroundColor: data.backgroundColor || DEFAULT_THEME.backgroundColor,
        buttonColor: data.buttonColor || DEFAULT_THEME.buttonColor,
        textColor: data.textColor || DEFAULT_THEME.textColor,
        cardBackgroundColor: data.cardBackgroundColor || DEFAULT_THEME.cardBackgroundColor,
        secondaryColor: data.secondaryColor || DEFAULT_THEME.secondaryColor,
      });
    }
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: async (themeData: ThemeSettings) => {
      const response = await fetch("/api/vendor/appearance", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${vendorToken}`,
        },
        body: JSON.stringify(themeData),
      });
      if (!response.ok) throw new Error("Erro ao salvar");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vendor/appearance"] });
      queryClient.invalidateQueries({ queryKey: ["/api/vendor/profile"] });
      toast({ title: "Tema atualizado com sucesso!" });
    },
    onError: (error: Error) => {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    },
  });

  const handleSave = () => {
    saveMutation.mutate(settings);
  };

  const handleRestoreDefault = () => {
    setSettings(DEFAULT_THEME);
    saveMutation.mutate(DEFAULT_THEME);
  };

  const handleColorChange = (field: keyof ThemeSettings, value: string) => {
    setSettings((prev) => ({ ...prev, [field]: value }));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Palette className="w-8 h-8 text-purple-500" />
        <div>
          <h1 className="text-3xl font-bold text-white">Aparencia</h1>
          <p className="text-gray-400 text-sm">Personalize as cores da sua loja publica</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card
          style={{
            background: "rgba(30, 30, 46, 0.8)",
            backdropFilter: "blur(12px)",
            border: "1px solid rgba(139, 92, 246, 0.2)",
          }}
        >
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Palette className="w-5 h-5 text-purple-400" />
              Personalizacao de Cores
            </CardTitle>
            <CardDescription className="text-gray-400">
              Escolha as cores que combinam com sua marca
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label className="text-gray-300">Cor de Fundo (Background)</Label>
              <div className="flex items-center gap-3">
                <div
                  className="w-12 h-12 rounded-lg border border-gray-600 cursor-pointer relative overflow-hidden"
                  style={{ backgroundColor: settings.backgroundColor }}
                >
                  <Input
                    type="color"
                    value={settings.backgroundColor}
                    onChange={(e) => handleColorChange("backgroundColor", e.target.value)}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                    data-testid="input-background-color"
                  />
                </div>
                <Input
                  type="text"
                  value={settings.backgroundColor}
                  onChange={(e) => handleColorChange("backgroundColor", e.target.value)}
                  className="bg-gray-800 border-gray-600 text-white font-mono uppercase"
                  maxLength={7}
                  data-testid="input-background-color-text"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-gray-300">Cor Principal (Botoes e Destaques)</Label>
              <div className="flex items-center gap-3">
                <div
                  className="w-12 h-12 rounded-lg border border-gray-600 cursor-pointer relative overflow-hidden"
                  style={{ backgroundColor: settings.buttonColor }}
                >
                  <Input
                    type="color"
                    value={settings.buttonColor}
                    onChange={(e) => handleColorChange("buttonColor", e.target.value)}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                    data-testid="input-button-color"
                  />
                </div>
                <Input
                  type="text"
                  value={settings.buttonColor}
                  onChange={(e) => handleColorChange("buttonColor", e.target.value)}
                  className="bg-gray-800 border-gray-600 text-white font-mono uppercase"
                  maxLength={7}
                  data-testid="input-button-color-text"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-gray-300">Cor do Texto (Titulos e Paragrafos)</Label>
              <div className="flex items-center gap-3">
                <div
                  className="w-12 h-12 rounded-lg border border-gray-600 cursor-pointer relative overflow-hidden"
                  style={{ backgroundColor: settings.textColor }}
                >
                  <Input
                    type="color"
                    value={settings.textColor}
                    onChange={(e) => handleColorChange("textColor", e.target.value)}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                    data-testid="input-text-color"
                  />
                </div>
                <Input
                  type="text"
                  value={settings.textColor}
                  onChange={(e) => handleColorChange("textColor", e.target.value)}
                  className="bg-gray-800 border-gray-600 text-white font-mono uppercase"
                  maxLength={7}
                  data-testid="input-text-color-text"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-gray-300">Cor dos Cards (Fundo do Produto)</Label>
              <div className="flex items-center gap-3">
                <div
                  className="w-12 h-12 rounded-lg border border-gray-600 cursor-pointer relative overflow-hidden"
                  style={{ backgroundColor: settings.cardBackgroundColor }}
                >
                  <Input
                    type="color"
                    value={settings.cardBackgroundColor}
                    onChange={(e) => handleColorChange("cardBackgroundColor", e.target.value)}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                    data-testid="input-card-color"
                  />
                </div>
                <Input
                  type="text"
                  value={settings.cardBackgroundColor}
                  onChange={(e) => handleColorChange("cardBackgroundColor", e.target.value)}
                  className="bg-gray-800 border-gray-600 text-white font-mono uppercase"
                  maxLength={7}
                  data-testid="input-card-color-text"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-gray-300">Cor Secundaria (Detalhes e Acentos)</Label>
              <div className="flex items-center gap-3">
                <div
                  className="w-12 h-12 rounded-lg border border-gray-600 cursor-pointer relative overflow-hidden"
                  style={{ backgroundColor: settings.secondaryColor }}
                >
                  <Input
                    type="color"
                    value={settings.secondaryColor}
                    onChange={(e) => handleColorChange("secondaryColor", e.target.value)}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                    data-testid="input-secondary-color"
                  />
                </div>
                <Input
                  type="text"
                  value={settings.secondaryColor}
                  onChange={(e) => handleColorChange("secondaryColor", e.target.value)}
                  className="bg-gray-800 border-gray-600 text-white font-mono uppercase"
                  maxLength={7}
                  data-testid="input-secondary-color-text"
                />
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <Button
                onClick={handleSave}
                disabled={saveMutation.isPending}
                className="flex-1"
                style={{ backgroundColor: settings.buttonColor }}
                data-testid="button-save-theme"
              >
                {saveMutation.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Save className="w-4 h-4 mr-2" />
                )}
                Salvar Alteracoes
              </Button>
              <Button
                onClick={handleRestoreDefault}
                disabled={saveMutation.isPending}
                variant="outline"
                className="border-red-500/50 text-red-400 hover:bg-red-500/10 hover:text-red-300"
                data-testid="button-restore-default"
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                Restaurar Padrao
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card
          style={{
            background: "rgba(30, 30, 46, 0.8)",
            backdropFilter: "blur(12px)",
            border: "1px solid rgba(139, 92, 246, 0.2)",
          }}
        >
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Package className="w-5 h-5 text-purple-400" />
              Pre-visualizacao em Tempo Real
            </CardTitle>
            <CardDescription className="text-gray-400">
              Veja como sua loja ficara com as novas cores
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div
              className="rounded-xl p-6 transition-all duration-300"
              style={{ backgroundColor: settings.backgroundColor }}
              data-testid="preview-container"
            >
              <div className="mb-4">
                <h3
                  className="text-lg font-bold mb-1"
                  style={{ color: settings.textColor }}
                >
                  Minha Loja
                </h3>
                <p
                  className="text-sm opacity-70"
                  style={{ color: settings.secondaryColor }}
                >
                  Produtos digitais premium
                </p>
              </div>

              <div
                className="rounded-lg p-4 mb-4 transition-all duration-300"
                style={{ backgroundColor: settings.cardBackgroundColor }}
                data-testid="preview-card-1"
              >
                <div className="flex items-start gap-3">
                  <div
                    className="w-16 h-16 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: settings.backgroundColor }}
                  >
                    <Package
                      className="w-8 h-8"
                      style={{ color: settings.buttonColor }}
                    />
                  </div>
                  <div className="flex-1">
                    <h4
                      className="font-semibold text-sm"
                      style={{ color: settings.textColor }}
                    >
                      Produto Exemplo
                    </h4>
                    <p
                      className="text-xs opacity-60 mt-1"
                      style={{ color: settings.textColor }}
                    >
                      Descricao do produto digital
                    </p>
                    <div className="flex items-center justify-between mt-3">
                      <span
                        className="font-bold"
                        style={{ color: settings.buttonColor }}
                      >
                        R$ 29,90
                      </span>
                      <Button
                        size="sm"
                        className="text-xs"
                        style={{
                          backgroundColor: settings.buttonColor,
                          color: "#FFFFFF",
                        }}
                        data-testid="button-preview-buy"
                      >
                        <ShoppingCart className="w-3 h-3 mr-1" />
                        Comprar
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              <div
                className="rounded-lg p-4 transition-all duration-300"
                style={{ backgroundColor: settings.cardBackgroundColor }}
                data-testid="preview-card-2"
              >
                <div className="flex items-start gap-3">
                  <div
                    className="w-16 h-16 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: settings.backgroundColor }}
                  >
                    <Package
                      className="w-8 h-8"
                      style={{ color: settings.buttonColor }}
                    />
                  </div>
                  <div className="flex-1">
                    <h4
                      className="font-semibold text-sm"
                      style={{ color: settings.textColor }}
                    >
                      Streaming Premium
                    </h4>
                    <p
                      className="text-xs opacity-60 mt-1"
                      style={{ color: settings.textColor }}
                    >
                      Acesso completo por 30 dias
                    </p>
                    <div className="flex items-center justify-between mt-3">
                      <span
                        className="font-bold"
                        style={{ color: settings.buttonColor }}
                      >
                        R$ 19,90
                      </span>
                      <Button
                        size="sm"
                        className="text-xs"
                        style={{
                          backgroundColor: settings.buttonColor,
                          color: "#FFFFFF",
                        }}
                        data-testid="button-preview-buy-2"
                      >
                        <ShoppingCart className="w-3 h-3 mr-1" />
                        Comprar
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
