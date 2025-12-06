import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface AppearanceSettings {
  logoUrl: string;
  themeColor: string;
  backgroundColor: string;
  buttonColor: string;
  cardBorderColor: string;
  backgroundImageUrl: string;
  buttonRadius: number;
}

export function VendorAppearance() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [settings, setSettings] = useState<AppearanceSettings>({
    logoUrl: "",
    themeColor: "#3B82F6",
    backgroundColor: "#121212",
    buttonColor: "#3B82F6",
    cardBorderColor: "#374151",
    backgroundImageUrl: "",
    buttonRadius: 8,
  });

  useEffect(() => {
    // Load current settings
    const loadSettings = async () => {
      try {
        const response = await fetch("/api/vendor/appearance");
        if (response.ok) {
          const data = await response.json();
          setSettings({
            logoUrl: data.logoUrl || "",
            themeColor: data.themeColor || "#3B82F6",
            backgroundColor: data.backgroundColor || "#121212",
            buttonColor: data.buttonColor || "#3B82F6",
            cardBorderColor: data.cardBorderColor || "#374151",
            backgroundImageUrl: data.backgroundImageUrl || "",
            buttonRadius: data.buttonRadius || 8,
          });
        }
      } catch (error) {
        console.error("Failed to load appearance settings:", error);
      }
    };
    loadSettings();
  }, []);

  const handleSave = async () => {
    setIsLoading(true);
    try {
      await apiRequest("PATCH", "/api/vendor/appearance", settings);
      toast({
        title: "Sucesso!",
        description: "Aparência da loja atualizada com sucesso",
      });
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message || "Falha ao salvar configurações",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-white">Personalizar Loja</h2>

      {/* Logo */}
      <Card
        style={{
          background: "rgba(30, 30, 30, 0.4)",
          backdropFilter: "blur(12px)",
          border: "1px solid rgba(255, 255, 255, 0.1)",
        }}
      >
        <CardHeader>
          <CardTitle className="text-white">Logo da Loja</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label className="text-white">URL da Logo</Label>
            <Input
              type="url"
              value={settings.logoUrl}
              onChange={(e) => setSettings({ ...settings, logoUrl: e.target.value })}
              placeholder="https://example.com/logo.png"
              style={{
                background: "rgba(30, 30, 40, 0.4)",
                backdropFilter: "blur(10px)",
                borderColor: "rgba(255,255,255,0.1)",
                color: "#FFFFFF",
              }}
              data-testid="input-logo-url"
            />
            {settings.logoUrl && (
              <div className="mt-4 p-4 bg-white/10 rounded-lg flex items-center justify-center h-20">
                <img
                  src={settings.logoUrl}
                  alt="Preview"
                  className="max-h-16 max-w-xs"
                  onError={() =>
                    toast({
                      title: "Erro ao carregar imagem",
                      description: "Verifique a URL",
                      variant: "destructive",
                    })
                  }
                />
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Cores */}
      <Card
        style={{
          background: "rgba(30, 30, 30, 0.4)",
          backdropFilter: "blur(12px)",
          border: "1px solid rgba(255, 255, 255, 0.1)",
        }}
      >
        <CardHeader>
          <CardTitle className="text-white">Cores</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-white">Cor Principal (Botões)</Label>
              <div className="flex gap-2">
                <input
                  type="color"
                  value={settings.themeColor}
                  onChange={(e) => setSettings({ ...settings, themeColor: e.target.value })}
                  className="w-12 h-10 rounded cursor-pointer"
                  data-testid="input-theme-color"
                />
                <Input
                  type="text"
                  value={settings.themeColor}
                  onChange={(e) => setSettings({ ...settings, themeColor: e.target.value })}
                  placeholder="#3B82F6"
                  style={{
                    background: "rgba(30, 30, 40, 0.4)",
                    borderColor: "rgba(255,255,255,0.1)",
                    color: "#FFFFFF",
                  }}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-white">Cor de Fundo</Label>
              <div className="flex gap-2">
                <input
                  type="color"
                  value={settings.backgroundColor}
                  onChange={(e) => setSettings({ ...settings, backgroundColor: e.target.value })}
                  className="w-12 h-10 rounded cursor-pointer"
                  data-testid="input-bg-color"
                />
                <Input
                  type="text"
                  value={settings.backgroundColor}
                  onChange={(e) => setSettings({ ...settings, backgroundColor: e.target.value })}
                  placeholder="#121212"
                  style={{
                    background: "rgba(30, 30, 40, 0.4)",
                    borderColor: "rgba(255,255,255,0.1)",
                    color: "#FFFFFF",
                  }}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-white">Cor do Botão</Label>
              <div className="flex gap-2">
                <input
                  type="color"
                  value={settings.buttonColor}
                  onChange={(e) => setSettings({ ...settings, buttonColor: e.target.value })}
                  className="w-12 h-10 rounded cursor-pointer"
                  data-testid="input-button-color"
                />
                <Input
                  type="text"
                  value={settings.buttonColor}
                  onChange={(e) => setSettings({ ...settings, buttonColor: e.target.value })}
                  placeholder="#3B82F6"
                  style={{
                    background: "rgba(30, 30, 40, 0.4)",
                    borderColor: "rgba(255,255,255,0.1)",
                    color: "#FFFFFF",
                  }}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-white">Cor da Borda do Card</Label>
              <div className="flex gap-2">
                <input
                  type="color"
                  value={settings.cardBorderColor}
                  onChange={(e) => setSettings({ ...settings, cardBorderColor: e.target.value })}
                  className="w-12 h-10 rounded cursor-pointer"
                  data-testid="input-card-border-color"
                />
                <Input
                  type="text"
                  value={settings.cardBorderColor}
                  onChange={(e) => setSettings({ ...settings, cardBorderColor: e.target.value })}
                  placeholder="#374151"
                  style={{
                    background: "rgba(30, 30, 40, 0.4)",
                    borderColor: "rgba(255,255,255,0.1)",
                    color: "#FFFFFF",
                  }}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Imagem de Fundo */}
      <Card
        style={{
          background: "rgba(30, 30, 30, 0.4)",
          backdropFilter: "blur(12px)",
          border: "1px solid rgba(255, 255, 255, 0.1)",
        }}
      >
        <CardHeader>
          <CardTitle className="text-white">Imagem de Fundo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label className="text-white">URL da Imagem de Fundo</Label>
            <Input
              type="url"
              value={settings.backgroundImageUrl}
              onChange={(e) => setSettings({ ...settings, backgroundImageUrl: e.target.value })}
              placeholder="https://example.com/background.jpg"
              style={{
                background: "rgba(30, 30, 40, 0.4)",
                backdropFilter: "blur(10px)",
                borderColor: "rgba(255,255,255,0.1)",
                color: "#FFFFFF",
              }}
              data-testid="input-background-image-url"
            />
            {settings.backgroundImageUrl && (
              <div 
                className="mt-4 p-4 rounded-lg h-32 bg-cover bg-center flex items-center justify-center"
                style={{ backgroundImage: `url(${settings.backgroundImageUrl})` }}
              >
                <span className="text-white text-sm bg-black/50 px-2 py-1 rounded">Preview do Fundo</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Button Radius */}
      <Card
        style={{
          background: "rgba(30, 30, 30, 0.4)",
          backdropFilter: "blur(12px)",
          border: "1px solid rgba(255, 255, 255, 0.1)",
        }}
      >
        <CardHeader>
          <CardTitle className="text-white">Arredondamento dos Botões</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <Label className="text-white">Raio de Borda (px)</Label>
              <span className="text-xl font-bold text-blue-400">{settings.buttonRadius}px</span>
            </div>
            <input
              type="range"
              min="0"
              max="30"
              value={settings.buttonRadius}
              onChange={(e) => setSettings({ ...settings, buttonRadius: parseInt(e.target.value) })}
              className="w-full cursor-pointer"
              data-testid="slider-button-radius"
            />
            <div className="flex gap-2 mt-4">
              <button
                style={{
                  backgroundColor: settings.themeColor,
                  borderRadius: `${settings.buttonRadius}px`,
                  padding: "10px 20px",
                  color: "white",
                  fontWeight: "bold",
                }}
              >
                Preview Botão
              </button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <Button
        onClick={handleSave}
        disabled={isLoading}
        style={{
          background: "linear-gradient(135deg, #3b82f6 0%, #8b5cf6 50%, #ec4899 100%)",
          color: "#FFFFFF",
          padding: "12px 32px",
          fontSize: "1rem",
          fontWeight: "bold",
        }}
        data-testid="button-save-appearance"
      >
        {isLoading ? "Salvando..." : "Salvar Aparência"}
      </Button>
    </div>
  );
}
