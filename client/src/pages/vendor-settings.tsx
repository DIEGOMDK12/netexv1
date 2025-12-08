import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Wallet, Info, Upload, Globe, CheckCircle2, Copy, Settings, ExternalLink, Cloud, Server, FileCheck } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";

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
  const [activeTab, setActiveTab] = useState("geral");
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
  const [domainInput, setDomainInput] = useState("");
  const [savingDomain, setSavingDomain] = useState(false);

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
      setDomainInput(profile.customDomain || "");
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

  const saveDomainMutation = useMutation({
    mutationFn: async (domain: string) => {
      setSavingDomain(true);
      const normalizedDomain = normalizeDomain(domain);
      const response = await fetch('/api/vendor/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${vendorToken}`,
        },
        body: JSON.stringify({ customDomain: normalizedDomain }),
      });
      if (!response.ok) throw new Error('Erro ao salvar dominio');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/vendor/profile'] });
      toast({ 
        title: "Dominio salvo com sucesso!", 
        description: "Seu dominio personalizado foi configurado. Aguarde a propagacao do DNS." 
      });
      setSavingDomain(false);
    },
    onError: (error: any) => {
      toast({ 
        title: "Erro", 
        description: error.message, 
        variant: "destructive" 
      });
      setSavingDomain(false);
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

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="w-full grid grid-cols-3 bg-gray-800/50 p-1 rounded-lg mb-6">
          <TabsTrigger 
            value="geral" 
            className="data-[state=active]:bg-teal-600 data-[state=active]:text-white text-gray-300"
            data-testid="tab-geral"
          >
            <Settings className="w-4 h-4 mr-2" />
            Geral
          </TabsTrigger>
          <TabsTrigger 
            value="pagamentos" 
            className="data-[state=active]:bg-teal-600 data-[state=active]:text-white text-gray-300"
            data-testid="tab-pagamentos"
          >
            <Wallet className="w-4 h-4 mr-2" />
            Pagamentos
          </TabsTrigger>
          <TabsTrigger 
            value="dominio" 
            className="data-[state=active]:bg-purple-600 data-[state=active]:text-white text-gray-300"
            data-testid="tab-dominio"
          >
            <Globe className="w-4 h-4 mr-2" />
            Dominio
          </TabsTrigger>
        </TabsList>

        <TabsContent value="geral" className="space-y-6">
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
                <Label className="text-white">Descricao da Loja</Label>
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
                  className="w-full h-20 p-3 rounded-md resize-none border"
                  data-testid="textarea-store-description"
                />
                <p className="text-xs text-gray-400">
                  Aparecera no Google Search e ao compartilhar sua loja
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
                  Aparecera no WhatsApp, Facebook, etc.
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

          <Button
            onClick={() => updateMutation.mutate(settings)}
            disabled={updateMutation.isPending}
            className="w-full bg-teal-600 hover:bg-teal-700 text-white h-10"
            data-testid="button-save-settings-geral"
          >
            {updateMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : null}
            Salvar Configuracoes
          </Button>
        </TabsContent>

        <TabsContent value="pagamentos" className="space-y-6">
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

          <Button
            onClick={() => updateMutation.mutate(settings)}
            disabled={updateMutation.isPending}
            className="w-full bg-teal-600 hover:bg-teal-700 text-white h-10"
            data-testid="button-save-settings-pagamentos"
          >
            {updateMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : null}
            Salvar Configuracoes
          </Button>
        </TabsContent>

        <TabsContent value="dominio" className="space-y-6">
          <Card
            style={{
              background: "linear-gradient(135deg, rgba(139, 92, 246, 0.15) 0%, rgba(99, 102, 241, 0.1) 100%)",
              backdropFilter: "blur(12px)",
              border: "1px solid rgba(139, 92, 246, 0.3)",
            }}
          >
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center">
                  <Globe className="w-6 h-6 text-purple-400" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-3 flex-wrap">
                    <CardTitle className="text-white text-xl">Dominio Personalizado</CardTitle>
                    {settings.customDomain && (
                      <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                        <CheckCircle2 className="w-3 h-3 mr-1" />
                        Conectado
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-gray-400 mt-1">Use seu proprio dominio para sua loja (White Label)</p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {settings.customDomain && (
                <div className="flex items-center gap-3 p-4 rounded-xl bg-green-500/10 border border-green-500/30">
                  <CheckCircle2 className="w-6 h-6 text-green-400 flex-shrink-0" />
                  <div>
                    <p className="text-sm text-green-300 font-medium">Dominio ativo</p>
                    <p className="text-lg text-white font-bold">{settings.customDomain}</p>
                  </div>
                </div>
              )}

              <div className="space-y-3">
                <Label className="text-white text-base font-semibold">Seu Dominio</Label>
                <div className="flex gap-3">
                  <Input
                    value={domainInput}
                    onChange={(e) => setDomainInput(normalizeDomain(e.target.value))}
                    placeholder="Ex: sualoja.com"
                    className="flex-1 h-12 text-lg"
                    style={{
                      background: "rgba(30, 30, 40, 0.6)",
                      backdropFilter: "blur(10px)",
                      borderColor: "rgba(139, 92, 246, 0.3)",
                      color: "#FFFFFF",
                    }}
                    data-testid="input-custom-domain"
                  />
                  <Button
                    onClick={() => saveDomainMutation.mutate(domainInput)}
                    disabled={savingDomain || !domainInput.trim()}
                    className="h-12 px-6 bg-purple-600 hover:bg-purple-700 text-white font-semibold"
                    data-testid="button-save-domain"
                  >
                    {savingDomain ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <>
                        <FileCheck className="w-5 h-5 mr-2" />
                        Salvar Dominio
                      </>
                    )}
                  </Button>
                </div>
                <p className="text-xs text-gray-400">
                  Digite apenas o dominio, sem https:// ou www
                </p>
              </div>
            </CardContent>
          </Card>

          <Card
            style={{
              background: "rgba(31, 41, 55, 0.9)",
              backdropFilter: "blur(12px)",
              border: "1px solid rgba(75, 85, 99, 0.5)",
            }}
          >
            <CardHeader className="pb-2">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-orange-500/20 flex items-center justify-center">
                  <Cloud className="w-5 h-5 text-orange-400" />
                </div>
                <CardTitle className="text-white">Como conectar seu dominio (Recomendado via Cloudflare)</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <Accordion type="single" collapsible defaultValue="passo1" className="space-y-2">
                <AccordionItem value="passo1" className="border border-gray-700 rounded-lg overflow-hidden">
                  <AccordionTrigger className="px-4 py-3 bg-gray-800/50 hover:bg-gray-800/70 text-white">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-orange-500 text-white flex items-center justify-center font-bold text-sm">1</div>
                      <span className="font-semibold">Crie sua conta na Cloudflare</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-4 py-4 bg-gray-800/30 text-gray-300">
                    <div className="space-y-3">
                      <p>Acesse <a href="https://cloudflare.com" target="_blank" rel="noopener noreferrer" className="text-orange-400 hover:underline inline-flex items-center gap-1">cloudflare.com <ExternalLink className="w-3 h-3" /></a> e crie uma conta gratuita.</p>
                      <p>Adicione seu site clicando em <strong className="text-white">"Add a Site"</strong> e selecione o <strong className="text-white">Plano Gratis</strong>.</p>
                      <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30 mt-3">
                        <p className="text-sm text-yellow-300">
                          <strong>Importante:</strong> A Cloudflare ira mostrar dois Nameservers. Voce precisa trocar os Nameservers no seu registrador de dominio (Hostinger, GoDaddy, Registro.br, etc) pelos que a Cloudflare indicar.
                        </p>
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="passo2" className="border border-gray-700 rounded-lg overflow-hidden">
                  <AccordionTrigger className="px-4 py-3 bg-gray-800/50 hover:bg-gray-800/70 text-white">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-orange-500 text-white flex items-center justify-center font-bold text-sm">2</div>
                      <span className="font-semibold">Aponte para nossa plataforma</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-4 py-4 bg-gray-800/30 text-gray-300">
                    <div className="space-y-4">
                      <p>No menu <strong className="text-white">DNS</strong> da Cloudflare, clique em <strong className="text-white">"Add Record"</strong> e configure:</p>
                      
                      <div className="grid gap-3 p-4 rounded-lg bg-gray-900/50 border border-gray-600">
                        <div className="flex items-center justify-between">
                          <span className="text-gray-400">Tipo:</span>
                          <code className="px-3 py-1 rounded bg-blue-500/20 text-blue-300 font-mono">CNAME</code>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-gray-400">Nome (Name):</span>
                          <code className="px-3 py-1 rounded bg-purple-500/20 text-purple-300 font-mono">@</code>
                          <span className="text-xs text-gray-500">(ou o subdominio desejado)</span>
                        </div>
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <span className="text-gray-400">Destino (Target):</span>
                          <div className="flex items-center gap-2">
                            <code 
                              className="px-3 py-2 rounded bg-orange-500/20 text-orange-400 font-mono cursor-pointer hover:bg-orange-500/30 transition-colors"
                              onClick={() => copyToClipboard("goldnetsteam.shop")}
                              data-testid="text-cname-target"
                            >
                              goldnetsteam.shop
                            </code>
                            <Button 
                              size="sm" 
                              variant="ghost" 
                              onClick={() => copyToClipboard("goldnetsteam.shop")}
                              className="h-8 px-2 text-gray-400 hover:text-white"
                              data-testid="button-copy-cname"
                            >
                              <Copy className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-gray-400">Proxy Status:</span>
                          <div className="flex items-center gap-2">
                            <div className="w-4 h-4 rounded-full bg-orange-500"></div>
                            <span className="text-orange-400 font-medium">Proxied (Nuvem Laranja)</span>
                          </div>
                        </div>
                      </div>

                      <div className="p-3 rounded-lg bg-orange-500/10 border border-orange-500/30">
                        <p className="text-sm text-orange-300">
                          <strong>Atencao:</strong> Certifique-se de que a nuvem esteja <strong>LARANJA</strong> (Proxied), nao cinza!
                        </p>
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="passo3" className="border border-gray-700 rounded-lg overflow-hidden">
                  <AccordionTrigger className="px-4 py-3 bg-gray-800/50 hover:bg-gray-800/70 text-white">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-green-500 text-white flex items-center justify-center font-bold text-sm">3</div>
                      <span className="font-semibold">Salve seu dominio aqui</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-4 py-4 bg-gray-800/30 text-gray-300">
                    <div className="space-y-3">
                      <p>Apos configurar o DNS na Cloudflare:</p>
                      <ol className="list-decimal list-inside space-y-2 pl-2">
                        <li>Digite seu dominio no campo acima <strong className="text-white">(Ex: sualoja.com)</strong></li>
                        <li>Clique em <strong className="text-purple-400">"Salvar Dominio"</strong></li>
                        <li>Aguarde a propagacao do DNS (pode levar ate 24 horas)</li>
                        <li>Teste acessando seu dominio no navegador</li>
                      </ol>
                      
                      <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/30 mt-4">
                        <p className="text-sm text-green-300">
                          <strong>Pronto!</strong> Quando o DNS propagar, seu dominio ira carregar sua loja automaticamente, com sua marca e cores personalizadas.
                        </p>
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>

              <div className="mt-6 p-4 rounded-lg bg-blue-500/10 border border-blue-500/30">
                <div className="flex items-start gap-3">
                  <Server className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm text-blue-300 font-medium mb-1">Dica Pro</p>
                    <p className="text-xs text-gray-400">
                      Se voce quiser usar <strong className="text-white">www.sualoja.com</strong> e <strong className="text-white">sualoja.com</strong>, crie dois registros CNAME: um com nome <code className="px-1 bg-gray-700 rounded">@</code> e outro com nome <code className="px-1 bg-gray-700 rounded">www</code>, ambos apontando para <code className="px-1 bg-gray-700 rounded">goldnetsteam.shop</code>.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
