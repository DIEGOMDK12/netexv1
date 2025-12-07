import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Settings } from "@shared/schema";

export default function AdminSettings() {
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    storeName: "",
    logoUrl: "",
    themeColor: "#3B82F6",
    textColor: "#FFFFFF",
    pagseguroToken: "",
    pagseguroEmail: "",
    pagseguroApiUrl: "",
    supportEmail: "",
    whatsappContact: "",
  });

  const { data: settings, isLoading } = useQuery<Settings>({
    queryKey: ["/api/admin/settings"],
    queryFn: async () => {
      const token = localStorage.getItem("admin_token");
      const response = await fetch("/api/admin/settings", {
        headers: {
          "Authorization": `Bearer ${token}`,
        },
      });
      if (!response.ok) {
        throw new Error("Erro ao carregar configurações");
      }
      return response.json();
    },
  });

  useEffect(() => {
    if (settings) {
      setFormData({
        storeName: settings.storeName || "",
        logoUrl: settings.logoUrl || "",
        themeColor: settings.themeColor || "#3B82F6",
        textColor: settings.textColor || "#FFFFFF",
        pagseguroToken: settings.pagseguroToken || "",
        pagseguroEmail: (settings as any).pagseguroEmail || "",
        pagseguroApiUrl: settings.pagseguroApiUrl || "",
        supportEmail: (settings as any).supportEmail || "",
        whatsappContact: (settings as any).whatsappContact || "",
      });
    }
  }, [settings]);

  const updateMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const token = localStorage.getItem("admin_token");
      const response = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...data,
          pagseguroSandbox: false,
          pagseguroApiUrl: "https://api.pagseguro.com",
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Erro ao salvar");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/settings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      toast({ title: "Configurações salvas com sucesso!" });
    },
    onError: (error: any) => {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-8 h-8 animate-spin text-teal-500" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white">Configurações</h2>
        <p className="text-gray-400 text-sm mt-1">Gerencie as configurações da sua loja</p>
      </div>

      {/* Store Identity */}
      <div
        className="p-6 rounded-lg border"
        style={{ backgroundColor: "#1E1E1E", borderColor: "rgba(255,255,255,0.1)" }}
      >
        <h3 className="text-lg font-semibold text-white mb-4">Identidade da Loja</h3>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-white">Nome da Loja</Label>
            <Input
              value={formData.storeName}
              onChange={(e) => setFormData({ ...formData, storeName: e.target.value })}
              style={{ backgroundColor: "#242424", borderColor: "rgba(255,255,255,0.1)", color: "#fff" }}
            />
          </div>

          <div className="space-y-2">
            <Label className="text-white">E-mail de Suporte</Label>
            <Input
              type="email"
              value={formData.supportEmail}
              onChange={(e) => setFormData({ ...formData, supportEmail: e.target.value })}
              style={{ backgroundColor: "#242424", borderColor: "rgba(255,255,255,0.1)", color: "#fff" }}
            />
          </div>

          <div className="space-y-2">
            <Label className="text-white">WhatsApp (apenas números)</Label>
            <Input
              value={formData.whatsappContact}
              onChange={(e) => setFormData({ ...formData, whatsappContact: e.target.value })}
              placeholder="5585988007000"
              style={{ backgroundColor: "#242424", borderColor: "rgba(255,255,255,0.1)", color: "#fff" }}
            />
          </div>

          <div className="space-y-2">
            <Label className="text-white">URL da Logo</Label>
            <Input
              value={formData.logoUrl}
              onChange={(e) => setFormData({ ...formData, logoUrl: e.target.value })}
              style={{ backgroundColor: "#242424", borderColor: "rgba(255,255,255,0.1)", color: "#fff" }}
            />
          </div>
        </div>
      </div>

      {/* Appearance */}
      <div
        className="p-6 rounded-lg border"
        style={{ backgroundColor: "#1E1E1E", borderColor: "rgba(255,255,255,0.1)" }}
      >
        <h3 className="text-lg font-semibold text-white mb-4">Aparência</h3>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-white">Cor do Tema</Label>
            <div className="flex gap-2">
              <Input
                type="color"
                value={formData.themeColor}
                onChange={(e) => setFormData({ ...formData, themeColor: e.target.value })}
                className="w-16 h-10 p-1"
                style={{ backgroundColor: "#242424" }}
              />
              <Input
                value={formData.themeColor}
                onChange={(e) => setFormData({ ...formData, themeColor: e.target.value })}
                className="flex-1"
                style={{ backgroundColor: "#242424", borderColor: "rgba(255,255,255,0.1)", color: "#fff" }}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-white">Cor do Texto</Label>
            <div className="flex gap-2">
              <Input
                type="color"
                value={formData.textColor}
                onChange={(e) => setFormData({ ...formData, textColor: e.target.value })}
                className="w-16 h-10 p-1"
                style={{ backgroundColor: "#242424" }}
              />
              <Input
                value={formData.textColor}
                onChange={(e) => setFormData({ ...formData, textColor: e.target.value })}
                className="flex-1"
                style={{ backgroundColor: "#242424", borderColor: "rgba(255,255,255,0.1)", color: "#fff" }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Payment - PagSeguro da Plataforma */}
      <div
        className="p-6 rounded-lg border"
        style={{ backgroundColor: "#1E1E1E", borderColor: "rgba(45,212,191,0.3)" }}
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-teal-500/20 flex items-center justify-center">
            <svg className="w-5 h-5 text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
            </svg>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">PagSeguro - Pagamentos da Plataforma</h3>
            <p className="text-xs text-teal-400">Todos os pagamentos caem na sua conta</p>
          </div>
        </div>

        <div className="bg-teal-500/10 border border-teal-500/20 rounded-lg p-3 mb-4">
          <p className="text-sm text-teal-300">
            Configure seu token de producao do PagSeguro. Todos os pagamentos das revendas serao processados pela sua conta e as revendas podem solicitar saque via Pix.
          </p>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-white">E-mail da conta PagSeguro</Label>
            <Input
              type="email"
              value={formData.pagseguroEmail}
              onChange={(e) => setFormData({ ...formData, pagseguroEmail: e.target.value })}
              placeholder="seu-email@pagseguro.com"
              style={{ backgroundColor: "#242424", borderColor: "rgba(255,255,255,0.1)", color: "#fff" }}
              data-testid="input-pagseguro-email"
            />
            <p className="text-xs text-gray-400">E-mail cadastrado na sua conta PagSeguro</p>
          </div>

          <div className="space-y-2">
            <Label className="text-white">Token de Producao PagSeguro</Label>
            <Input
              type="password"
              value={formData.pagseguroToken}
              onChange={(e) => setFormData({ ...formData, pagseguroToken: e.target.value })}
              placeholder="Cole seu token de producao aqui"
              style={{ backgroundColor: "#242424", borderColor: "rgba(255,255,255,0.1)", color: "#fff" }}
              data-testid="input-pagseguro-token"
            />
            <p className="text-xs text-gray-400">
              Obtenha em: PagSeguro &gt; Minha Conta &gt; Integracoes &gt; Token de Producao
            </p>
          </div>

          <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3">
            <p className="text-sm text-green-300">
              Modo de producao ativo! Todos os pagamentos serao processados com valores reais.
            </p>
          </div>
        </div>
      </div>

      {/* Save Button */}
      <Button
        onClick={() => updateMutation.mutate(formData)}
        disabled={updateMutation.isPending}
        className="w-full bg-teal-600 hover:bg-teal-700 text-white h-10"
      >
        {updateMutation.isPending ? (
          <Loader2 className="w-4 h-4 animate-spin mr-2" />
        ) : (
          <Save className="w-4 h-4 mr-2" />
        )}
        Salvar Configurações
      </Button>
    </div>
  );
}
