import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Wallet, Info, Upload, Globe, CheckCircle2, AlertCircle, Copy } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";

interface VendorProfile {
  id: number;
  name: string;
  email: string;
  storeName: string | null;
  slug: string;
  pixKey: string | null;
  totalSales: string;
  totalCommission: string;
  createdAt: string;
  faviconUrl: string | null;
  ogImageUrl: string | null;
  storeDescription: string | null;
  customDomain: string | null;
}

export function VendorSettings() {
  const { toast } = useToast();
  const [settings, setSettings] = useState({
    storeName: "",
    pixKey: "",
    pixKeyType: "cpf",
    pixHolderName: "",
    faviconUrl: "",
    ogImageUrl: "",
    storeDescription: "",
    customDomain: "",
  });

  const [uploadingFavicon, setUploadingFavicon] = useState(false);
  const [uploadingOgImage, setUploadingOgImage] = useState(false);
  
  const vendorToken = localStorage.getItem("vendor_token");

  const { data: profile, isLoading } = useQuery<VendorProfile>({
    queryKey: ['/api/vendor/profile'],
    queryFn: async () => {
      const response = await fetch('/api/vendor/profile', {
        headers: {
          'Authorization': `Bearer ${vendorToken}`,
        },
      });
      if (!response.ok) throw new Error('Erro ao carregar perfil');
      return response.json();
    },
    enabled: !!vendorToken,
  });

  const handleImageUpload = async (file: File, type: 'favicon' | 'ogImage') => {
    if (type === 'favicon') setUploadingFavicon(true);
    else setUploadingOgImage(true);

    try {
      const formData = new FormData();
      formData.append('image', file);

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
        headers: {
          'Authorization': `Bearer ${vendorToken}`,
        },
      });

      if (!response.ok) throw new Error('Erro ao fazer upload');
      const data = await response.json();
      const imageUrl = data.imageUrl || `/uploads/${data.filename}`;

      if (type === 'favicon') {
        setSettings({ ...settings, faviconUrl: imageUrl });
      } else {
        setSettings({ ...settings, ogImageUrl: imageUrl });
      }

      toast({ title: "Imagem enviada com sucesso!" });
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } finally {
      if (type === 'favicon') setUploadingFavicon(false);
      else setUploadingOgImage(false);
    }
  };

  useEffect(() => {
    if (profile) {
      setSettings({
        storeName: profile.storeName || "",
        pixKey: profile.pixKey || "",
        pixKeyType: "cpf",
        pixHolderName: profile.name || "",
        faviconUrl: profile.faviconUrl || "",
        ogImageUrl: profile.ogImageUrl || "",
        storeDescription: profile.storeDescription || "",
        customDomain: profile.customDomain || "",
      });
    }
  }, [profile]);

  const normalizeDomain = (input: string): string => {
    let domain = input.trim().toLowerCase();
    domain = domain.replace(/^https?:\/\//, "");
    domain = domain.replace(/\/.*$/, "");
    domain = domain.replace(/^www\./, "");
    return domain;
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copiado!", description: "Texto copiado para a area de transferencia" });
  };

  const updateMutation = useMutation({
    mutationFn: async (data: typeof settings) => {
      const response = await fetch('/api/vendor/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${vendorToken}`,
        },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Erro ao atualizar perfil');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/vendor/profile'] });
      toast({ title: "Configuracoes salvas com sucesso!" });
    },
    onError: (error: any) => {
      toast({ 
        title: "Erro", 
        description: error.message, 
        variant: "destructive" 
      });
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
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-white">Configuracoes</h1>

      {/* Informativo sobre Pagamentos */}
      <Card
        style={{
          background: "rgba(20, 184, 166, 0.1)",
          backdropFilter: "blur(12px)",
          border: "1px solid rgba(20, 184, 166, 0.3)",
        }}
      >
        <CardContent className="py-4">
          <div className="flex items-start gap-3 p-4 rounded-lg bg-teal-500/10">
            <Info className="w-5 h-5 text-teal-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm text-teal-300">
                Os pagamentos dos seus clientes sao processados automaticamente pelo gateway da plataforma. O saldo das vendas fica disponivel para saque na sua carteira.
              </p>
            </div>
          </div>
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
              <CardTitle className="text-white">Chave PIX para Saques</CardTitle>
              <p className="text-sm text-gray-400 mt-1">Configure onde receber seus saques</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label className="text-white">Nome do Titular</Label>
            <Input
              value={settings.pixHolderName}
              onChange={(e) => setSettings({ ...settings, pixHolderName: e.target.value })}
              placeholder="Nome completo do titular da chave PIX"
              style={{
                background: "rgba(30, 30, 40, 0.4)",
                backdropFilter: "blur(10px)",
                borderColor: "rgba(255,255,255,0.1)",
                color: "#FFFFFF",
              }}
              data-testid="input-pix-holder-name"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-white">Tipo de Chave PIX</Label>
            <select
              value={settings.pixKeyType}
              onChange={(e) => setSettings({ ...settings, pixKeyType: e.target.value })}
              className="w-full h-10 px-3 rounded-md"
              style={{
                background: "rgba(30, 30, 40, 0.4)",
                backdropFilter: "blur(10px)",
                borderColor: "rgba(255,255,255,0.1)",
                color: "#FFFFFF",
                border: "1px solid rgba(255,255,255,0.1)",
              }}
              data-testid="select-pix-key-type"
            >
              <option value="cpf">CPF</option>
              <option value="cnpj">CNPJ</option>
              <option value="email">E-mail</option>
              <option value="phone">Telefone</option>
              <option value="random">Chave Aleatoria</option>
            </select>
          </div>

          <div className="space-y-2">
            <Label className="text-white">Chave PIX</Label>
            <Input
              value={settings.pixKey}
              onChange={(e) => setSettings({ ...settings, pixKey: e.target.value })}
              placeholder={
                settings.pixKeyType === "cpf" ? "000.000.000-00" :
                settings.pixKeyType === "cnpj" ? "00.000.000/0000-00" :
                settings.pixKeyType === "email" ? "seu@email.com" :
                settings.pixKeyType === "phone" ? "+5585999999999" :
                "Chave aleatoria"
              }
              style={{
                background: "rgba(30, 30, 40, 0.4)",
                backdropFilter: "blur(10px)",
                borderColor: "rgba(255,255,255,0.1)",
                color: "#FFFFFF",
              }}
              data-testid="input-pix-key"
            />
            <p className="text-xs text-gray-400">
              Esta chave sera usada para receber seus saques
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Informacoes da Loja */}
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
            <Label className="text-white">Descrição da Loja</Label>
            <textarea
              value={settings.storeDescription}
              onChange={(e) => setSettings({ ...settings, storeDescription: e.target.value })}
              placeholder="Descreva sua loja para SEO e compartilhamentos sociais"
              style={{
                background: "rgba(30, 30, 40, 0.4)",
                backdropFilter: "blur(10px)",
                borderColor: "rgba(255,255,255,0.1)",
                color: "#FFFFFF",
              }}
              className="w-full h-20 p-3 rounded-md resize-none"
              data-testid="textarea-store-description"
            />
            <p className="text-xs text-gray-400">
              Aparecerá no Google Search e ao compartilhar sua loja
            </p>
          </div>

          <div className="space-y-2">
            <Label className="text-white">Favicon (Logo na Aba)</Label>
            <div className="flex gap-2">
              <Input
                value={settings.faviconUrl}
                onChange={(e) => setSettings({ ...settings, faviconUrl: e.target.value })}
                placeholder="https://example.com/favicon.png ou colar URL"
                style={{
                  background: "rgba(30, 30, 40, 0.4)",
                  backdropFilter: "blur(10px)",
                  borderColor: "rgba(255,255,255,0.1)",
                  color: "#FFFFFF",
                }}
                data-testid="input-favicon-url"
              />
              <label className="cursor-pointer">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={uploadingFavicon}
                  data-testid="button-favicon-upload"
                >
                  {uploadingFavicon ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                </Button>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files?.[0]) {
                      handleImageUpload(e.target.files[0], 'favicon');
                    }
                  }}
                  disabled={uploadingFavicon}
                />
              </label>
            </div>
            {settings.faviconUrl && (
              <img src={settings.faviconUrl} alt="Preview" className="w-8 h-8 rounded" />
            )}
            <p className="text-xs text-gray-400">
              Clique no botão para fazer upload ou cole uma URL
            </p>
          </div>

          <div className="space-y-2">
            <Label className="text-white">Imagem de Compartilhamento</Label>
            <div className="flex gap-2">
              <Input
                value={settings.ogImageUrl}
                onChange={(e) => setSettings({ ...settings, ogImageUrl: e.target.value })}
                placeholder="https://example.com/og-image.png ou colar URL"
                style={{
                  background: "rgba(30, 30, 40, 0.4)",
                  backdropFilter: "blur(10px)",
                  borderColor: "rgba(255,255,255,0.1)",
                  color: "#FFFFFF",
                }}
                data-testid="input-og-image-url"
              />
              <label className="cursor-pointer">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={uploadingOgImage}
                  data-testid="button-og-image-upload"
                >
                  {uploadingOgImage ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                </Button>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files?.[0]) {
                      handleImageUpload(e.target.files[0], 'ogImage');
                    }
                  }}
                  disabled={uploadingOgImage}
                />
              </label>
            </div>
            {settings.ogImageUrl && (
              <img src={settings.ogImageUrl} alt="Preview" className="w-16 h-16 object-cover rounded" />
            )}
            <p className="text-xs text-gray-400">
              Aparecerá no WhatsApp, Facebook, etc. Clique no botão para upload
            </p>
          </div>

          {profile && (
            <div className="pt-4 border-t border-gray-700 space-y-2">
              <p className="text-sm text-gray-400">E-mail: {profile.email}</p>
              <p className="text-sm text-gray-400">Link da loja: /{profile.slug}</p>
              <p className="text-sm text-gray-400">
                Membro desde: {new Date(profile.createdAt).toLocaleDateString('pt-BR')}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dominio Personalizado (White Label) */}
      <Card
        style={{
          background: "rgba(30, 30, 30, 0.4)",
          backdropFilter: "blur(12px)",
          border: "1px solid rgba(255, 255, 255, 0.1)",
        }}
      >
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
              <Globe className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <CardTitle className="text-white">Dominio Personalizado</CardTitle>
              <p className="text-sm text-gray-400 mt-1">Use seu proprio dominio para sua loja (White Label)</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Status do dominio */}
          {settings.customDomain && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-green-500/10 border border-green-500/30">
              <CheckCircle2 className="w-5 h-5 text-green-400" />
              <span className="text-sm text-green-300">
                Dominio ativo: <strong>{settings.customDomain}</strong>
              </span>
            </div>
          )}

          {/* Input do dominio */}
          <div className="space-y-2">
            <Label className="text-white">Seu Dominio</Label>
            <Input
              value={settings.customDomain}
              onChange={(e) => setSettings({ ...settings, customDomain: normalizeDomain(e.target.value) })}
              placeholder="meusite.com"
              style={{
                background: "rgba(30, 30, 40, 0.4)",
                backdropFilter: "blur(10px)",
                borderColor: "rgba(255,255,255,0.1)",
                color: "#FFFFFF",
              }}
              data-testid="input-custom-domain"
            />
            <p className="text-xs text-gray-400">
              Digite apenas o dominio, sem https:// ou www
            </p>
          </div>

          {/* Instrucoes do Cloudflare */}
          <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/30 space-y-3">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-blue-400" />
              <span className="text-sm font-semibold text-blue-300">Como configurar no Cloudflare:</span>
            </div>
            
            <ol className="list-decimal list-inside space-y-2 text-sm text-gray-300">
              <li>Acesse seu painel da <strong className="text-white">Cloudflare</strong></li>
              <li>Va em <strong className="text-white">DNS</strong> e clique em <strong className="text-white">Add Record</strong></li>
              <li>
                Selecione tipo <strong className="text-white">CNAME</strong>
              </li>
              <li>
                No campo <strong className="text-white">Name</strong>, coloque <strong className="text-white">@</strong> (ou <strong className="text-white">www</strong>)
              </li>
              <li className="flex flex-wrap items-center gap-2">
                <span>No campo <strong className="text-white">Target</strong>, coloque:</span>
                <code 
                  className="px-2 py-1 rounded bg-gray-800 text-orange-400 cursor-pointer"
                  onClick={() => copyToClipboard("goldnetsteam.shop")}
                  data-testid="text-cname-target"
                >
                  goldnetsteam.shop
                </code>
                <Button 
                  size="sm" 
                  variant="ghost" 
                  onClick={() => copyToClipboard("goldnetsteam.shop")}
                  className="h-6 px-2"
                  data-testid="button-copy-cname"
                >
                  <Copy className="w-3 h-3" />
                </Button>
              </li>
              <li>
                Certifique-se de que a <strong className="text-orange-400">nuvem esteja laranja</strong> (Proxied)
              </li>
              <li>Clique em <strong className="text-white">Save</strong></li>
              <li>Volte aqui e salve seu dominio abaixo</li>
            </ol>

            <div className="mt-3 p-3 rounded bg-yellow-500/10 border border-yellow-500/30">
              <p className="text-xs text-yellow-300">
                <strong>Importante:</strong> A propagacao do DNS pode levar ate 24 horas. Apos configurar, aguarde e teste acessando seu dominio.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Botao Salvar */}
      <Button
        onClick={() => updateMutation.mutate(settings)}
        disabled={updateMutation.isPending}
        className="w-full bg-teal-600 hover:bg-teal-700 text-white h-10"
        data-testid="button-save-settings"
      >
        {updateMutation.isPending ? (
          <Loader2 className="w-4 h-4 animate-spin mr-2" />
        ) : null}
        Salvar Configuracoes
      </Button>
    </div>
  );
}
