import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff, Check, X, Loader2 } from "lucide-react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";

interface PagSeguroStatus {
  connected: boolean;
  accountId?: string;
}

export function VendorSettings() {
  const { toast } = useToast();
  const [location] = useLocation();
  const [showToken, setShowToken] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [settings, setSettings] = useState({
    pagseguroToken: "",
    storeName: "",
    email: "",
  });

  const resellerId = 1;

  const { data: pagSeguroStatus, refetch: refetchStatus, isLoading: isLoadingStatus } = useQuery<PagSeguroStatus>({
    queryKey: ['/api/pagseguro/status', resellerId],
    enabled: !!resellerId,
  });

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const pagseguroResult = urlParams.get('pagseguro');
    
    if (pagseguroResult === 'success') {
      toast({
        title: "PagSeguro conectado!",
        description: "Sua conta PagSeguro foi conectada com sucesso. Agora os pagamentos PIX serao processados automaticamente.",
      });
      refetchStatus();
      window.history.replaceState({}, '', window.location.pathname);
    } else if (pagseguroResult === 'error') {
      const errorMessage = urlParams.get('message') || 'Erro ao conectar com PagSeguro';
      toast({
        title: "Erro na conexao",
        description: decodeURIComponent(errorMessage),
        variant: "destructive",
      });
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [location, toast, refetchStatus]);

  const handleConnectPagSeguro = async () => {
    setIsConnecting(true);
    try {
      const response = await fetch(`/api/pagseguro/connect/${resellerId}`);
      const data = await response.json();
      
      if (data.success && data.redirectUrl) {
        window.location.href = data.redirectUrl;
      } else {
        toast({
          title: "Erro",
          description: data.message || "Nao foi possivel iniciar a conexao com PagSeguro",
          variant: "destructive",
        });
        setIsConnecting(false);
      }
    } catch (error) {
      toast({
        title: "Erro",
        description: "Falha ao conectar com PagSeguro. Tente novamente.",
        variant: "destructive",
      });
      setIsConnecting(false);
    }
  };

  const handleDisconnectPagSeguro = async () => {
    setIsDisconnecting(true);
    try {
      const response = await fetch(`/api/pagseguro/disconnect/${resellerId}`, {
        method: 'POST',
      });
      const data = await response.json();
      
      if (data.success) {
        toast({
          title: "PagSeguro desconectado",
          description: "Sua conta PagSeguro foi desconectada.",
        });
        refetchStatus();
      } else {
        toast({
          title: "Erro",
          description: data.message || "Nao foi possivel desconectar",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Erro",
        description: "Falha ao desconectar do PagSeguro. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsDisconnecting(false);
    }
  };

  const handleSaveSettings = () => {
    toast({
      title: "Configuracoes salvas!",
      description: "Suas alteracoes foram aplicadas com sucesso",
    });
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-white">Configuracoes</h1>

      <Card
        style={{
          background: "rgba(30, 30, 30, 0.4)",
          backdropFilter: "blur(12px)",
          border: "1px solid rgba(255, 255, 255, 0.1)",
        }}
      >
        <CardHeader>
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div>
              <CardTitle className="text-white">Integracao PagSeguro</CardTitle>
              <p className="text-sm text-gray-400 mt-1">Conecte sua conta PagSeguro para receber pagamentos PIX automaticamente</p>
            </div>
            {isLoadingStatus ? (
              <Badge variant="secondary">
                <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                Verificando...
              </Badge>
            ) : pagSeguroStatus?.connected ? (
              <Badge variant="default" className="bg-green-600">
                <Check className="w-3 h-3 mr-1" />
                Conectado
              </Badge>
            ) : (
              <Badge variant="secondary">
                <X className="w-3 h-3 mr-1" />
                Desconectado
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {pagSeguroStatus?.connected ? (
            <div className="space-y-4">
              <div className="p-4 rounded-md bg-green-500/10 border border-green-500/20">
                <p className="text-sm text-green-400">
                  Sua conta PagSeguro esta conectada. Os pagamentos PIX serao processados automaticamente usando sua conta.
                </p>
                {pagSeguroStatus.accountId && (
                  <p className="text-xs text-gray-400 mt-2">
                    ID da conta: {pagSeguroStatus.accountId}
                  </p>
                )}
              </div>
              
              <Button
                variant="destructive"
                onClick={handleDisconnectPagSeguro}
                disabled={isDisconnecting}
                data-testid="button-disconnect-pagseguro"
              >
                {isDisconnecting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Desconectando...
                  </>
                ) : (
                  "Desconectar PagSeguro"
                )}
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="p-4 rounded-md bg-blue-500/10 border border-blue-500/20">
                <p className="text-sm text-blue-400">
                  Clique no botao abaixo para conectar sua conta PagSeguro. Voce sera redirecionado para autorizar o acesso.
                </p>
              </div>
              
              <Button
                onClick={handleConnectPagSeguro}
                disabled={isConnecting}
                style={{
                  background: "linear-gradient(135deg, #3b82f6 0%, #8b5cf6 50%, #ec4899 100%)",
                  color: "#FFFFFF",
                  border: "1px solid rgba(255, 255, 255, 0.2)",
                }}
                data-testid="button-connect-pagseguro"
              >
                {isConnecting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Conectando...
                  </>
                ) : (
                  "Conectar PagSeguro"
                )}
              </Button>

              <div className="border-t border-gray-700 pt-4 mt-4">
                <p className="text-xs text-gray-500 mb-3">
                  Ou configure manualmente com seu token de API:
                </p>
                <div className="space-y-2">
                  <Label className="text-white text-sm">Token de Autenticacao (opcional)</Label>
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
                    Encontre seu token em: Configuracoes - Integracoes - API
                  </p>
                </div>

                <Button
                  onClick={handleSaveSettings}
                  variant="outline"
                  className="mt-3"
                  data-testid="button-save-pagseguro"
                >
                  Salvar Token Manual
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card
        style={{
          background: "rgba(30, 30, 30, 0.4)",
          backdropFilter: "blur(12px)",
          border: "1px solid rgba(255, 255, 255, 0.1)",
        }}
      >
        <CardHeader>
          <CardTitle className="text-white">Informacoes da Loja</CardTitle>
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
            Salvar Informacoes
          </Button>
        </CardContent>
      </Card>

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
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <p className="text-sm text-gray-400">Membro desde: 01 de Dezembro, 2025</p>
            <p className="text-sm text-gray-400">Vendas totais: R$ 0,00</p>
            <p className="text-sm text-gray-400">Comissao acumulada: R$ 0,00</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
