import { useState, useRef } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { Info, Wallet, User, FileCheck, Upload, CheckCircle, XCircle, Clock, AlertCircle, Banknote, ArrowDownToLine, MessageCircle, Phone, Shield, Copy, ExternalLink } from "lucide-react";
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
  
  // WhatsApp notification states
  const [whatsappPhone, setWhatsappPhone] = useState("");
  const [whatsappSecret, setWhatsappSecret] = useState("");
  const [verificationCode, setVerificationCode] = useState("");

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

  // WhatsApp notification settings query
  const { data: whatsappData, isLoading: loadingWhatsapp } = useQuery({
    queryKey: ["/api/vendor/whatsapp-notifications"],
    queryFn: async () => {
      const response = await fetch("/api/vendor/whatsapp-notifications", {
        headers: {
          'Authorization': `Bearer ${vendorToken}`,
        },
      });
      if (!response.ok) throw new Error('Erro ao buscar configuracoes WhatsApp');
      return response.json();
    },
    enabled: !!vendorToken,
  });

  // Generate secret mutation
  const generateSecretMutation = useMutation({
    mutationFn: async (phone: string) => {
      const response = await fetch("/api/vendor/whatsapp-notifications/generate-secret", {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${vendorToken}`,
        },
        body: JSON.stringify({ phone }),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Erro ao gerar codigo');
      }
      return response.json();
    },
    onSuccess: (data) => {
      if (data.secret) {
        setWhatsappSecret(data.secret);
      }
      queryClient.invalidateQueries({ queryKey: ["/api/vendor/whatsapp-notifications"] });
      toast({
        title: data.codeSent ? "Codigo enviado!" : "Codigo gerado!",
        description: data.message || "Insira o codigo para verificar seu numero.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error?.message || "Nao foi possivel gerar o codigo",
        variant: "destructive",
      });
    },
  });

  // Verify WhatsApp mutation
  const verifyWhatsappMutation = useMutation({
    mutationFn: async (secret: string) => {
      const response = await fetch("/api/vendor/whatsapp-notifications/verify", {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${vendorToken}`,
        },
        body: JSON.stringify({ secret }),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Erro ao verificar');
      }
      return response.json();
    },
    onSuccess: () => {
      setWhatsappSecret("");
      setVerificationCode("");
      queryClient.invalidateQueries({ queryKey: ["/api/vendor/whatsapp-notifications"] });
      toast({
        title: "Verificado!",
        description: "Seu numero WhatsApp foi verificado com sucesso.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error?.message || "Codigo invalido",
        variant: "destructive",
      });
    },
  });

  // Toggle WhatsApp notifications mutation
  const toggleWhatsappMutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      const response = await fetch("/api/vendor/whatsapp-notifications/toggle", {
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
      queryClient.invalidateQueries({ queryKey: ["/api/vendor/whatsapp-notifications"] });
      toast({
        title: data.enabled ? "Ativado" : "Desativado",
        description: data.enabled ? "Voce recebera notificacoes de vendas no WhatsApp" : "Notificacoes desativadas",
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

  // Remove WhatsApp config mutation
  const removeWhatsappMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/vendor/whatsapp-notifications", {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${vendorToken}`,
        },
      });
      if (!response.ok) throw new Error('Erro ao remover');
      return response.json();
    },
    onSuccess: () => {
      setWhatsappPhone("");
      setWhatsappSecret("");
      queryClient.invalidateQueries({ queryKey: ["/api/vendor/whatsapp-notifications"] });
      toast({
        title: "Removido",
        description: "Configuracao de notificacoes WhatsApp removida.",
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

      {/* WhatsApp Notifications */}
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
              <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
                <MessageCircle className="w-5 h-5 text-green-400" />
              </div>
              <div>
                <CardTitle className="text-white">Notificacoes no WhatsApp</CardTitle>
                <p className="text-sm text-gray-400 mt-1">Receba alertas de vendas no seu WhatsApp</p>
              </div>
            </div>
            {whatsappData?.verified && (
              <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                <CheckCircle className="w-3 h-3 mr-1" />
                Verificado
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {loadingWhatsapp ? (
            <div className="text-center py-4">
              <div className="animate-spin w-6 h-6 border-2 border-green-400 border-t-transparent rounded-full mx-auto"></div>
            </div>
          ) : whatsappData?.verified ? (
            <>
              {/* WhatsApp verified - show toggle and info */}
              <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/30">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div className="flex items-center gap-3">
                    <Phone className="w-5 h-5 text-green-400" />
                    <div>
                      <p className="text-sm text-white font-medium">Vendas no WhatsApp</p>
                      <p className="text-xs text-gray-400">Numero: {whatsappData.phone}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-gray-400">
                      {whatsappData.enabled ? "Ativado" : "Desativado"}
                    </span>
                    <Switch
                      checked={whatsappData.enabled}
                      onCheckedChange={(checked) => toggleWhatsappMutation.mutate(checked)}
                      disabled={toggleWhatsappMutation.isPending}
                      data-testid="switch-whatsapp-notifications"
                    />
                  </div>
                </div>
              </div>
              
              <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/30">
                <div className="flex items-start gap-2">
                  <Info className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-blue-300">
                    Quando uma venda for realizada, voce recebera uma mensagem no WhatsApp com os detalhes do pedido.
                  </p>
                </div>
              </div>
              
              <Button
                variant="outline"
                onClick={() => removeWhatsappMutation.mutate()}
                disabled={removeWhatsappMutation.isPending}
                className="w-full border-red-500/30 text-red-400"
                data-testid="button-remove-whatsapp"
              >
                {removeWhatsappMutation.isPending ? "Removendo..." : "Remover Configuracao"}
              </Button>
            </>
          ) : (
            <>
              {/* WhatsApp not configured or not verified */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-white">Seu numero de WhatsApp</Label>
                  <Input
                    value={whatsappPhone || whatsappData?.phone || ""}
                    onChange={(e) => setWhatsappPhone(e.target.value)}
                    placeholder="+55 (00) 90000-0000"
                    style={{
                      background: "rgba(30, 30, 40, 0.4)",
                      backdropFilter: "blur(10px)",
                      borderColor: "rgba(255,255,255,0.1)",
                      color: "#FFFFFF",
                    }}
                    data-testid="input-whatsapp-phone"
                  />
                </div>
                
                {!whatsappSecret && !whatsappData?.hasSecret ? (
                  <Button
                    onClick={() => {
                      const phone = whatsappPhone || whatsappData?.phone;
                      if (!phone) {
                        toast({
                          title: "Erro",
                          description: "Digite seu numero de WhatsApp",
                          variant: "destructive",
                        });
                        return;
                      }
                      generateSecretMutation.mutate(phone);
                    }}
                    disabled={generateSecretMutation.isPending}
                    className="w-full bg-green-600 hover:bg-green-700 text-white"
                    data-testid="button-generate-secret"
                  >
                    {generateSecretMutation.isPending ? "Gerando..." : "Gerar Codigo de Verificacao"}
                  </Button>
                ) : (
                  <>
                    {/* Show secret and verification instructions */}
                    <div className="p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
                      <div className="flex items-start gap-3">
                        <Shield className="w-5 h-5 text-yellow-400 mt-0.5 flex-shrink-0" />
                        <div className="space-y-2 flex-1">
                          <p className="text-sm text-yellow-300 font-medium">
                            Apos confirmar, envie o (SECRET) gerado para o numero:
                          </p>
                          <a
                            href="https://wa.me/5511989905419"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 text-blue-400 hover:text-blue-300 text-sm"
                            data-testid="link-whatsapp-verification"
                          >
                            <ExternalLink className="w-4 h-4" />
                            https://wa.me/5511989905419
                          </a>
                          
                          {whatsappSecret && (
                            <div className="mt-3 p-3 rounded-lg bg-black/30 border border-white/10">
                              <p className="text-xs text-gray-400 mb-1">Seu codigo SECRET:</p>
                              <div className="flex items-center justify-between gap-3">
                                <code className="text-lg font-mono text-green-400 font-bold tracking-wider">
                                  {whatsappSecret}
                                </code>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => {
                                    navigator.clipboard.writeText(whatsappSecret);
                                    toast({
                                      title: "Copiado!",
                                      description: "Codigo copiado para a area de transferencia",
                                    });
                                  }}
                                  data-testid="button-copy-secret"
                                >
                                  <Copy className="w-4 h-4" />
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    {/* Manual verification input - optional for testing */}
                    <div className="space-y-2">
                      <Label className="text-white text-sm">Ou digite o codigo recebido:</Label>
                      <div className="flex gap-2">
                        <Input
                          value={verificationCode}
                          onChange={(e) => setVerificationCode(e.target.value.toUpperCase())}
                          placeholder="CODIGO"
                          maxLength={6}
                          style={{
                            background: "rgba(30, 30, 40, 0.4)",
                            backdropFilter: "blur(10px)",
                            borderColor: "rgba(255,255,255,0.1)",
                            color: "#FFFFFF",
                            fontFamily: "monospace",
                            letterSpacing: "0.2em",
                          }}
                          data-testid="input-verification-code"
                        />
                        <Button
                          onClick={() => verifyWhatsappMutation.mutate(verificationCode)}
                          disabled={verifyWhatsappMutation.isPending || !verificationCode}
                          className="bg-green-600 hover:bg-green-700 text-white"
                          data-testid="button-verify-whatsapp"
                        >
                          {verifyWhatsappMutation.isPending ? "..." : "Verificar"}
                        </Button>
                      </div>
                    </div>
                    
                    <Button
                      variant="outline"
                      onClick={() => {
                        setWhatsappSecret("");
                        setWhatsappPhone("");
                        removeWhatsappMutation.mutate();
                      }}
                      className="w-full border-white/20 text-gray-400"
                      data-testid="button-cancel-verification"
                    >
                      Cancelar
                    </Button>
                  </>
                )}
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
