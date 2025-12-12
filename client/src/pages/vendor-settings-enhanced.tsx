import { useState, useRef } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { Info, Wallet, User, FileCheck, Upload, CheckCircle, XCircle, Clock, AlertCircle, Banknote, ArrowDownToLine, MessageCircle } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function VendorSettingsEnhanced({ vendorId, vendorData }: { vendorId: number; vendorData: any }) {
  const { toast } = useToast();
  const [settings, setSettings] = useState({
    storeName: vendorData?.storeName || "",
    logoUrl: vendorData?.logoUrl || "",
    pixKey: vendorData?.pixKey || "",
    phone: vendorData?.phone || "",
    cpf: vendorData?.cpf || "",
  });

  const [documentFront, setDocumentFront] = useState<string>("");
  const [documentBack, setDocumentBack] = useState<string>("");
  const [uploadingFront, setUploadingFront] = useState(false);
  const [uploadingBack, setUploadingBack] = useState(false);
  const frontInputRef = useRef<HTMLInputElement>(null);
  const backInputRef = useRef<HTMLInputElement>(null);
  
  const [withdrawalDialogOpen, setWithdrawalDialogOpen] = useState(false);
  const [withdrawalAmount, setWithdrawalAmount] = useState("");
  const [withdrawalPixKeyType, setWithdrawalPixKeyType] = useState("cpf");
  const [withdrawalPixHolderName, setWithdrawalPixHolderName] = useState("");
  
  // Discord notification states
  const [discordWebhook, setDiscordWebhook] = useState("");

  const vendorToken = localStorage.getItem("vendor_token");

  const { data: verificationData, isLoading: loadingVerification } = useQuery({
    queryKey: ["/api/vendor/verification-status"],
    queryFn: async () => {
      const response = await fetch("/api/vendor/verification-status", {
        headers: {
          'Authorization': `Bearer ${vendorToken}`,
        },
      });
      if (!response.ok) throw new Error('Erro ao buscar status');
      return response.json();
    },
    enabled: !!vendorToken,
  });

  // Discord notification settings query
  const { data: discordData, isLoading: loadingDiscord } = useQuery({
    queryKey: ["/api/vendor/discord-notifications"],
    queryFn: async () => {
      const response = await fetch("/api/vendor/discord-notifications", {
        headers: {
          'Authorization': `Bearer ${vendorToken}`,
        },
      });
      if (!response.ok) throw new Error('Erro ao buscar configuracoes Discord');
      return response.json();
    },
    enabled: !!vendorToken,
  });

  // Save Discord webhook mutation
  const saveDiscordMutation = useMutation({
    mutationFn: async (webhookUrl: string) => {
      const response = await fetch("/api/vendor/discord-notifications", {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${vendorToken}`,
        },
        body: JSON.stringify({ webhookUrl }),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Erro ao salvar webhook');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vendor/discord-notifications"] });
      toast({
        title: "Webhook salvo!",
        description: "Voce recebera notificacoes de vendas no Discord.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error?.message || "Nao foi possivel salvar o webhook",
        variant: "destructive",
      });
    },
  });

  // Toggle Discord notifications mutation
  const toggleDiscordMutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      const response = await fetch("/api/vendor/discord-notifications/toggle", {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${vendorToken}`,
        },
        body: JSON.stringify({ enabled }),
      });
      if (!response.ok) throw new Error('Erro ao alterar');
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/vendor/discord-notifications"] });
      toast({
        title: data.enabled ? "Ativado" : "Desativado",
        description: data.enabled ? "Voce recebera notificacoes de vendas no Discord" : "Notificacoes desativadas",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error?.message || "Nao foi possivel alterar",
        variant: "destructive",
      });
    },
  });

  // Remove Discord config mutation
  const removeDiscordMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/vendor/discord-notifications", {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${vendorToken}`,
        },
      });
      if (!response.ok) throw new Error('Erro ao remover');
      return response.json();
    },
    onSuccess: () => {
      setDiscordWebhook("");
      queryClient.invalidateQueries({ queryKey: ["/api/vendor/discord-notifications"] });
      toast({
        title: "Removido",
        description: "Configuracao de notificacoes Discord removida.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error?.message || "Nao foi possivel remover",
        variant: "destructive",
      });
    },
  });

  // Test Discord notification mutation
  const testDiscordMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/vendor/discord-notifications/test", {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${vendorToken}`,
        },
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Erro ao enviar teste');
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Teste enviado!",
        description: "Verifique seu Discord para confirmar o recebimento.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro no teste",
        description: error?.message || "Nao foi possivel enviar a notificacao de teste",
        variant: "destructive",
      });
    },
  });

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

  const documentMutation = useMutation({
    mutationFn: async (data: { documentFrontUrl: string; documentBackUrl: string }) => {
      const response = await fetch("/api/vendor/documents", {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${vendorToken}`,
        },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Erro ao enviar documentos');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vendor/verification-status"] });
      toast({
        title: "Sucesso",
        description: "Documentos enviados para verificacao!",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error?.message || "Nao foi possivel enviar os documentos",
        variant: "destructive",
      });
    },
  });

  const { data: withdrawalsData, isLoading: loadingWithdrawals } = useQuery({
    queryKey: ["/api/vendor/withdrawals"],
    queryFn: async () => {
      const response = await fetch("/api/vendor/withdrawals", {
        headers: {
          'Authorization': `Bearer ${vendorToken}`,
        },
      });
      if (!response.ok) throw new Error('Erro ao buscar saques');
      return response.json();
    },
    enabled: !!vendorToken,
  });

  const withdrawalMutation = useMutation({
    mutationFn: async (data: { amount: number; pixKey: string; pixKeyType: string; pixHolderName: string }) => {
      const response = await fetch("/api/vendor/withdrawals", {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${vendorToken}`,
        },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Erro ao solicitar saque');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vendor/withdrawals"] });
      queryClient.invalidateQueries({ queryKey: ["/api/vendor/profile", vendorId] });
      setWithdrawalDialogOpen(false);
      setWithdrawalAmount("");
      toast({
        title: "Solicitacao enviada",
        description: "Seu pedido de saque foi enviado e sera processado em breve.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error?.message || "Nao foi possivel solicitar o saque",
        variant: "destructive",
      });
    },
  });

  const TAXA_DE_SAQUE = 1.60;
  const MIN_WITHDRAWAL = 5.00;

  const handleRequestWithdrawal = () => {
    const normalizedAmount = withdrawalAmount.replace(',', '.');
    const amount = parseFloat(normalizedAmount);
    const availableBalance = parseFloat(vendorData?.walletBalance as string || "0");
    
    if (isNaN(amount) || amount <= 0) {
      toast({
        title: "Valor invalido",
        description: "Digite um valor valido para o saque",
        variant: "destructive",
      });
      return;
    }
    
    if (amount < MIN_WITHDRAWAL) {
      toast({
        title: "Valor minimo",
        description: `O valor minimo para saque e R$ ${MIN_WITHDRAWAL.toFixed(2)}`,
        variant: "destructive",
      });
      return;
    }
    
    if (amount > availableBalance) {
      toast({
        title: "Saldo insuficiente",
        description: `O valor solicitado excede seu saldo disponivel de R$ ${availableBalance.toFixed(2)}`,
        variant: "destructive",
      });
      return;
    }
    
    const pixKey = settings.pixKey;
    if (!pixKey) {
      toast({
        title: "Chave PIX nao configurada",
        description: "Configure sua chave PIX antes de solicitar um saque",
        variant: "destructive",
      });
      return;
    }
    
    const holderName = withdrawalPixHolderName.trim() || vendorData?.storeName || "";
    if (!holderName) {
      toast({
        title: "Nome do titular obrigatorio",
        description: "Informe o nome do titular da chave PIX",
        variant: "destructive",
      });
      return;
    }
    
    withdrawalMutation.mutate({
      amount,
      pixKey,
      pixKeyType: withdrawalPixKeyType,
      pixHolderName: holderName,
    });
  };

  const getWithdrawalStatusBadge = (status: string) => {
    switch (status) {
      case "approved":
        return (
          <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
            <CheckCircle className="w-3 h-3 mr-1" />
            Aprovado
          </Badge>
        );
      case "rejected":
        return (
          <Badge className="bg-red-500/20 text-red-400 border-red-500/30">
            <XCircle className="w-3 h-3 mr-1" />
            Rejeitado
          </Badge>
        );
      case "pending":
      default:
        return (
          <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">
            <Clock className="w-3 h-3 mr-1" />
            Pendente
          </Badge>
        );
    }
  };

  const handleSaveSettings = () => {
    saveMutation.mutate({
      storeName: settings.storeName,
      logoUrl: settings.logoUrl,
      pixKey: settings.pixKey,
      phone: settings.phone,
      cpf: settings.cpf,
    });
  };

  const handleFileUpload = async (file: File, type: 'front' | 'back') => {
    if (type === 'front') setUploadingFront(true);
    else setUploadingBack(true);

    try {
      const formData = new FormData();
      formData.append('image', file);

      const response = await fetch('/api/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${vendorToken}`,
        },
        body: formData,
      });

      if (!response.ok) throw new Error('Erro no upload');
      
      const data = await response.json();
      const imageUrl = data.url || data.imageUrl;

      if (type === 'front') {
        setDocumentFront(imageUrl);
      } else {
        setDocumentBack(imageUrl);
      }

      toast({
        title: "Upload concluido",
        description: `Imagem ${type === 'front' ? 'frente' : 'verso'} carregada com sucesso`,
      });
    } catch (error: any) {
      toast({
        title: "Erro no upload",
        description: error?.message || "Nao foi possivel carregar a imagem",
        variant: "destructive",
      });
    } finally {
      if (type === 'front') setUploadingFront(false);
      else setUploadingBack(false);
    }
  };

  const handleSubmitDocuments = () => {
    const frontUrl = documentFront || verificationData?.documentFrontUrl;
    const backUrl = documentBack || verificationData?.documentBackUrl;

    if (!frontUrl || !backUrl) {
      toast({
        title: "Documentos incompletos",
        description: "Envie a frente e o verso do documento RG",
        variant: "destructive",
      });
      return;
    }

    documentMutation.mutate({
      documentFrontUrl: frontUrl,
      documentBackUrl: backUrl,
    });
  };

  const getVerificationBadge = (status: string | null) => {
    switch (status) {
      case "approved":
        return (
          <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
            <CheckCircle className="w-3 h-3 mr-1" />
            Verificado
          </Badge>
        );
      case "rejected":
        return (
          <Badge className="bg-red-500/20 text-red-400 border-red-500/30">
            <XCircle className="w-3 h-3 mr-1" />
            Rejeitado
          </Badge>
        );
      case "pending":
        return (
          <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">
            <Clock className="w-3 h-3 mr-1" />
            Em Analise
          </Badge>
        );
      default:
        return (
          <Badge className="bg-gray-500/20 text-gray-400 border-gray-500/30">
            <AlertCircle className="w-3 h-3 mr-1" />
            Nao Enviado
          </Badge>
        );
    }
  };

  const currentFrontUrl = documentFront || verificationData?.documentFrontUrl;
  const currentBackUrl = documentBack || verificationData?.documentBackUrl;
  const hasDocumentsUploaded = verificationData?.documentFrontUrl && verificationData?.documentBackUrl;
  const canResubmit = verificationData?.verificationStatus === "rejected" || !hasDocumentsUploaded;

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-white">Configuracoes</h1>

      {/* Informativo sobre Pagamentos */}
      <Card
        style={{
          background: "rgba(37, 99, 235, 0.1)",
          backdropFilter: "blur(12px)",
          border: "1px solid rgba(37, 99, 235, 0.3)",
        }}
      >
        <CardContent className="py-4">
          <div className="flex items-start gap-3 p-4 rounded-lg bg-blue-500/10">
            <Info className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm text-blue-300">
                Os pagamentos dos seus clientes sao processados automaticamente pelo gateway da plataforma. O saldo das vendas fica disponivel para saque na sua carteira.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Verificacao de Documentos */}
      <Card
        style={{
          background: "rgba(30, 30, 30, 0.4)",
          backdropFilter: "blur(12px)",
          border: "1px solid rgba(255, 255, 255, 0.1)",
        }}
      >
        <CardHeader>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
                <FileCheck className="w-5 h-5 text-purple-400" />
              </div>
              <div>
                <CardTitle className="text-white">Verificacao de Identidade</CardTitle>
                <p className="text-sm text-gray-400 mt-1">Envie seu RG para liberar saques</p>
              </div>
            </div>
            {!loadingVerification && getVerificationBadge(verificationData?.verificationStatus)}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {verificationData?.verificationStatus === "rejected" && verificationData?.verificationNotes && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30">
              <p className="text-sm text-red-300">
                <strong>Motivo da rejeicao:</strong> {verificationData.verificationNotes}
              </p>
            </div>
          )}

          {verificationData?.verificationStatus === "approved" ? (
            <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/30">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-400" />
                <p className="text-sm text-green-300">
                  Sua conta foi verificada com sucesso! Voce pode realizar saques normalmente.
                </p>
              </div>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Frente do RG */}
                <div className="space-y-2">
                  <Label className="text-white">Frente do RG</Label>
                  <div 
                    className="border-2 border-dashed border-white/20 rounded-lg p-4 text-center cursor-pointer transition-colors"
                    onClick={() => canResubmit && frontInputRef.current?.click()}
                    style={{ 
                      background: currentFrontUrl ? "rgba(30, 30, 40, 0.2)" : "rgba(30, 30, 40, 0.4)",
                      opacity: canResubmit ? 1 : 0.6,
                    }}
                  >
                    {uploadingFront ? (
                      <div className="py-4">
                        <div className="animate-spin w-8 h-8 border-2 border-purple-400 border-t-transparent rounded-full mx-auto"></div>
                        <p className="text-xs text-gray-400 mt-2">Enviando...</p>
                      </div>
                    ) : currentFrontUrl ? (
                      <div>
                        <img 
                          src={currentFrontUrl} 
                          alt="Frente do RG" 
                          className="w-full h-32 object-cover rounded-lg mb-2"
                        />
                        {canResubmit && (
                          <p className="text-xs text-gray-400">Clique para substituir</p>
                        )}
                      </div>
                    ) : (
                      <div className="py-4">
                        <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                        <p className="text-sm text-gray-400">Clique para enviar</p>
                        <p className="text-xs text-gray-500">JPG, PNG ou WebP</p>
                      </div>
                    )}
                  </div>
                  <input
                    ref={frontInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleFileUpload(file, 'front');
                    }}
                    disabled={!canResubmit}
                    data-testid="input-document-front"
                  />
                </div>

                {/* Verso do RG */}
                <div className="space-y-2">
                  <Label className="text-white">Verso do RG</Label>
                  <div 
                    className="border-2 border-dashed border-white/20 rounded-lg p-4 text-center cursor-pointer transition-colors"
                    onClick={() => canResubmit && backInputRef.current?.click()}
                    style={{ 
                      background: currentBackUrl ? "rgba(30, 30, 40, 0.2)" : "rgba(30, 30, 40, 0.4)",
                      opacity: canResubmit ? 1 : 0.6,
                    }}
                  >
                    {uploadingBack ? (
                      <div className="py-4">
                        <div className="animate-spin w-8 h-8 border-2 border-purple-400 border-t-transparent rounded-full mx-auto"></div>
                        <p className="text-xs text-gray-400 mt-2">Enviando...</p>
                      </div>
                    ) : currentBackUrl ? (
                      <div>
                        <img 
                          src={currentBackUrl} 
                          alt="Verso do RG" 
                          className="w-full h-32 object-cover rounded-lg mb-2"
                        />
                        {canResubmit && (
                          <p className="text-xs text-gray-400">Clique para substituir</p>
                        )}
                      </div>
                    ) : (
                      <div className="py-4">
                        <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                        <p className="text-sm text-gray-400">Clique para enviar</p>
                        <p className="text-xs text-gray-500">JPG, PNG ou WebP</p>
                      </div>
                    )}
                  </div>
                  <input
                    ref={backInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleFileUpload(file, 'back');
                    }}
                    disabled={!canResubmit}
                    data-testid="input-document-back"
                  />
                </div>
              </div>

              {canResubmit && (
                <Button
                  onClick={handleSubmitDocuments}
                  disabled={documentMutation.isPending || (!currentFrontUrl || !currentBackUrl)}
                  className="w-full bg-purple-600 hover:bg-purple-700 text-white"
                  data-testid="button-submit-documents"
                >
                  {documentMutation.isPending ? "Enviando..." : "Enviar para Verificacao"}
                </Button>
              )}

              {verificationData?.verificationStatus === "pending" && hasDocumentsUploaded && (
                <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-yellow-400" />
                    <p className="text-sm text-yellow-300">
                      Seus documentos estao em analise. Aguarde a verificacao.
                    </p>
                  </div>
                </div>
              )}
            </>
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

      {/* Solicitar Saque */}
      <Card
        style={{
          background: "rgba(30, 30, 30, 0.4)",
          backdropFilter: "blur(12px)",
          border: "1px solid rgba(255, 255, 255, 0.1)",
        }}
      >
        <CardHeader>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                <Banknote className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <CardTitle className="text-white">Solicitar Saque</CardTitle>
                <p className="text-sm text-gray-400 mt-1">Retire seu saldo via PIX</p>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Saldo disponivel */}
          <div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div>
                <p className="text-sm text-gray-400">Saldo disponivel</p>
                <p className="text-2xl font-bold text-emerald-400">
                  R$ {parseFloat(vendorData?.walletBalance as any || "0").toFixed(2)}
                </p>
              </div>
              <Dialog open={withdrawalDialogOpen} onOpenChange={setWithdrawalDialogOpen}>
                <DialogTrigger asChild>
                  <Button
                    disabled={
                      verificationData?.verificationStatus !== "approved" ||
                      parseFloat(vendorData?.walletBalance as any || "0") <= 0 ||
                      !settings.pixKey
                    }
                    className="bg-emerald-600 hover:bg-emerald-700 text-white"
                    data-testid="button-request-withdrawal"
                  >
                    <ArrowDownToLine className="w-4 h-4 mr-2" />
                    Solicitar Saque
                  </Button>
                </DialogTrigger>
                <DialogContent className="bg-gray-900 border-white/10">
                  <DialogHeader>
                    <DialogTitle className="text-white">Solicitar Saque via PIX</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 pt-4">
                    <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/30 space-y-1">
                      <p className="text-sm text-blue-300">
                        Saldo disponivel: <strong>R$ {parseFloat(vendorData?.walletBalance as any || "0").toFixed(2)}</strong>
                      </p>
                      <p className="text-xs text-blue-300/70">
                        Taxa de saque: R$ {TAXA_DE_SAQUE.toFixed(2)} | Minimo: R$ {MIN_WITHDRAWAL.toFixed(2)}
                      </p>
                    </div>
                    
                    <div className="space-y-2">
                      <Label className="text-white">Valor do Saque (R$)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        max={parseFloat(vendorData?.walletBalance as any || "0")}
                        value={withdrawalAmount}
                        onChange={(e) => setWithdrawalAmount(e.target.value)}
                        placeholder="0,00"
                        style={{
                          background: "rgba(30, 30, 40, 0.4)",
                          borderColor: "rgba(255,255,255,0.1)",
                          color: "#FFFFFF",
                        }}
                        data-testid="input-withdrawal-amount"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label className="text-white">Chave PIX</Label>
                      <Input
                        value={settings.pixKey}
                        disabled
                        style={{
                          background: "rgba(30, 30, 40, 0.4)",
                          borderColor: "rgba(255,255,255,0.1)",
                          color: "#9CA3AF",
                        }}
                      />
                      <p className="text-xs text-gray-500">A chave PIX configurada acima sera usada</p>
                    </div>
                    
                    <div className="space-y-2">
                      <Label className="text-white">Tipo de Chave PIX</Label>
                      <Select value={withdrawalPixKeyType} onValueChange={setWithdrawalPixKeyType}>
                        <SelectTrigger 
                          style={{
                            background: "rgba(30, 30, 40, 0.4)",
                            borderColor: "rgba(255,255,255,0.1)",
                            color: "#FFFFFF",
                          }}
                          data-testid="select-pix-key-type"
                        >
                          <SelectValue placeholder="Selecione o tipo" />
                        </SelectTrigger>
                        <SelectContent className="bg-gray-900 border-white/10">
                          <SelectItem value="cpf">CPF</SelectItem>
                          <SelectItem value="cnpj">CNPJ</SelectItem>
                          <SelectItem value="email">E-mail</SelectItem>
                          <SelectItem value="phone">Telefone</SelectItem>
                          <SelectItem value="random">Chave Aleatoria</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="space-y-2">
                      <Label className="text-white">Nome do Titular</Label>
                      <Input
                        value={withdrawalPixHolderName}
                        onChange={(e) => setWithdrawalPixHolderName(e.target.value)}
                        placeholder={vendorData?.storeName || "Nome completo do titular"}
                        style={{
                          background: "rgba(30, 30, 40, 0.4)",
                          borderColor: "rgba(255,255,255,0.1)",
                          color: "#FFFFFF",
                        }}
                        data-testid="input-pix-holder-name"
                      />
                    </div>
                    
                    <Button
                      onClick={handleRequestWithdrawal}
                      disabled={withdrawalMutation.isPending || !withdrawalAmount}
                      className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                      data-testid="button-confirm-withdrawal"
                    >
                      {withdrawalMutation.isPending ? "Enviando..." : "Confirmar Solicitacao"}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>
          
          {/* Mensagens de aviso */}
          {verificationData?.verificationStatus !== "approved" && (
            <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-yellow-400" />
                <p className="text-sm text-yellow-300">
                  Voce precisa ter sua identidade verificada para solicitar saques.
                </p>
              </div>
            </div>
          )}
          
          {!settings.pixKey && (
            <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-yellow-400" />
                <p className="text-sm text-yellow-300">
                  Configure sua chave PIX acima para poder solicitar saques.
                </p>
              </div>
            </div>
          )}
          
          {/* Historico de saques */}
          {withdrawalsData && withdrawalsData.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-white">Historico de Solicitacoes</h4>
              <div className="space-y-2">
                {withdrawalsData.map((withdrawal: any) => (
                  <div 
                    key={withdrawal.id}
                    className="p-3 rounded-lg bg-white/5 border border-white/10 flex items-center justify-between gap-3 flex-wrap"
                    data-testid={`withdrawal-item-${withdrawal.id}`}
                  >
                    <div>
                      <p className="text-sm text-white font-medium">
                        R$ {parseFloat(withdrawal.amount as any || "0").toFixed(2)}
                      </p>
                      <p className="text-xs text-gray-400">
                        {new Date(withdrawal.createdAt).toLocaleDateString('pt-BR', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </p>
                    </div>
                    {getWithdrawalStatusBadge(withdrawal.status)}
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {loadingWithdrawals && (
            <div className="text-center py-4">
              <div className="animate-spin w-6 h-6 border-2 border-emerald-400 border-t-transparent rounded-full mx-auto"></div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Perfil do Vendedor */}
      <Card
        style={{
          background: "rgba(30, 30, 30, 0.4)",
          backdropFilter: "blur(12px)",
          border: "1px solid rgba(255, 255, 255, 0.1)",
        }}
      >
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
              <User className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <CardTitle className="text-white">Perfil do Vendedor</CardTitle>
              <p className="text-sm text-gray-400 mt-1">Informacoes exibidas no marketplace</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label className="text-white">Nome do Vendedor / Loja</Label>
            <Input
              value={settings.storeName}
              onChange={(e) => setSettings({ ...settings, storeName: e.target.value })}
              placeholder="Seu nome ou nome da loja"
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
            <Label className="text-white">URL do Avatar/Logo</Label>
            <Input
              value={settings.logoUrl}
              onChange={(e) => setSettings({ ...settings, logoUrl: e.target.value })}
              placeholder="https://exemplo.com/avatar.png"
              style={{
                background: "rgba(30, 30, 40, 0.4)",
                backdropFilter: "blur(10px)",
                borderColor: "rgba(255,255,255,0.1)",
                color: "#FFFFFF",
              }}
              data-testid="input-logo-url"
            />
            <p className="text-xs text-gray-500">Imagem do seu perfil no marketplace</p>
            {settings.logoUrl && (
              <div className="mt-2 p-3 rounded-lg border border-white/10 bg-white/5">
                <p className="text-xs text-gray-400 mb-2">Previa:</p>
                <img src={settings.logoUrl} alt="Avatar preview" className="w-12 h-12 rounded-full object-cover" />
              </div>
            )}
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
          <p className="text-sm text-gray-400">Comissao: {vendorData?.commissionPercent}%</p>
          <p className="text-sm text-gray-400">Total de vendas: R$ {parseFloat(vendorData?.totalSales as any || "0").toFixed(2)}</p>
        </CardContent>
      </Card>

      {/* Discord Notifications */}
      <Card
        style={{
          background: "rgba(30, 30, 30, 0.4)",
          backdropFilter: "blur(12px)",
          border: "1px solid rgba(255, 255, 255, 0.1)",
        }}
      >
        <CardHeader>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-indigo-500/20 flex items-center justify-center">
                <MessageCircle className="w-5 h-5 text-indigo-400" />
              </div>
              <div>
                <CardTitle className="text-white">Notificacoes no Discord</CardTitle>
                <p className="text-sm text-gray-400 mt-1">Receba alertas de vendas no seu Discord</p>
              </div>
            </div>
            {discordData?.configured && (
              <Badge className="bg-indigo-500/20 text-indigo-400 border-indigo-500/30">
                <CheckCircle className="w-3 h-3 mr-1" />
                Configurado
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {loadingDiscord ? (
            <div className="text-center py-4">
              <div className="animate-spin w-6 h-6 border-2 border-indigo-400 border-t-transparent rounded-full mx-auto"></div>
            </div>
          ) : discordData?.configured ? (
            <>
              <div className="p-4 rounded-lg bg-indigo-500/10 border border-indigo-500/30">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div className="flex items-center gap-3">
                    <MessageCircle className="w-5 h-5 text-indigo-400" />
                    <div>
                      <p className="text-sm text-white font-medium">Vendas no Discord</p>
                      <p className="text-xs text-gray-400">Webhook configurado</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-gray-400">
                      {discordData.enabled ? "Ativado" : "Desativado"}
                    </span>
                    <Switch
                      checked={discordData.enabled}
                      onCheckedChange={(checked) => toggleDiscordMutation.mutate(checked)}
                      disabled={toggleDiscordMutation.isPending}
                      data-testid="switch-discord-notifications"
                    />
                  </div>
                </div>
              </div>
              
              <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/30">
                <div className="flex items-start gap-2">
                  <Info className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-blue-300">
                    Quando uma venda for realizada, voce recebera uma notificacao no Discord com os detalhes do pedido.
                  </p>
                </div>
              </div>
              
              <Button
                variant="outline"
                onClick={() => removeDiscordMutation.mutate()}
                disabled={removeDiscordMutation.isPending}
                className="w-full border-red-500/30 text-red-400"
                data-testid="button-remove-discord"
              >
                {removeDiscordMutation.isPending ? "Removendo..." : "Remover Configuracao"}
              </Button>
            </>
          ) : (
            <>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-white">URL do Webhook do Discord</Label>
                  <Input
                    value={discordWebhook}
                    onChange={(e) => setDiscordWebhook(e.target.value)}
                    placeholder="https://discord.com/api/webhooks/..."
                    style={{
                      background: "rgba(30, 30, 40, 0.4)",
                      backdropFilter: "blur(10px)",
                      borderColor: "rgba(255,255,255,0.1)",
                      color: "#FFFFFF",
                    }}
                    data-testid="input-discord-webhook"
                  />
                </div>
                
                <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/30">
                  <div className="flex items-start gap-2">
                    <Info className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
                    <div className="text-xs text-blue-300 space-y-1">
                      <p className="font-medium">Como criar um webhook:</p>
                      <p>1. Abra o Discord e va no servidor desejado</p>
                      <p>2. Clique com botao direito no canal</p>
                      <p>3. Va em Editar Canal - Integracoes - Webhooks</p>
                      <p>4. Clique em Novo Webhook e copie a URL</p>
                    </div>
                  </div>
                </div>
                
                <Button
                  onClick={() => {
                    if (!discordWebhook) {
                      toast({
                        title: "Erro",
                        description: "Cole a URL do webhook do Discord",
                        variant: "destructive",
                      });
                      return;
                    }
                    saveDiscordMutation.mutate(discordWebhook);
                  }}
                  disabled={saveDiscordMutation.isPending}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white"
                  data-testid="button-save-discord"
                >
                  {saveDiscordMutation.isPending ? "Salvando..." : "Salvar Webhook"}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Save Button */}
      <Button
        onClick={handleSaveSettings}
        disabled={saveMutation.isPending}
        className="w-full bg-blue-600 hover:bg-blue-700 text-white h-10"
        data-testid="button-save-settings"
      >
        {saveMutation.isPending ? "Salvando..." : "Salvar Configuracoes"}
      </Button>
    </div>
  );
}
