import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Loader2, FileCheck, CheckCircle, XCircle, Eye, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface PendingVerification {
  id: number;
  name: string;
  email: string;
  storeName: string;
  slug: string;
  documentFrontUrl: string;
  documentBackUrl: string;
  verificationStatus: string;
  createdAt: string;
}

export default function AdminVerifications() {
  const { toast } = useToast();
  const [selectedVendor, setSelectedVendor] = useState<PendingVerification | null>(null);
  const [viewingDocument, setViewingDocument] = useState<{ url: string; type: string } | null>(null);
  const [rejectNotes, setRejectNotes] = useState("");
  const [showRejectDialog, setShowRejectDialog] = useState(false);

  const { data: pendingVerifications = [], isLoading } = useQuery<PendingVerification[]>({
    queryKey: ["/api/admin/pending-verifications"],
  });

  const verifyMutation = useMutation({
    mutationFn: async ({ vendorId, action, notes }: { vendorId: number; action: 'approve' | 'reject'; notes?: string }) => {
      return apiRequest("POST", `/api/admin/verify-vendor/${vendorId}`, { action, notes });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/pending-verifications"] });
      toast({ 
        title: variables.action === 'approve' 
          ? "Vendedor verificado com sucesso!" 
          : "Verificacao rejeitada",
        description: variables.action === 'approve'
          ? "O vendedor agora pode realizar saques"
          : "O vendedor foi notificado sobre a rejeicao"
      });
      setSelectedVendor(null);
      setShowRejectDialog(false);
      setRejectNotes("");
    },
    onError: (error: any) => {
      toast({ 
        title: "Erro ao processar verificacao", 
        description: error.message,
        variant: "destructive"
      });
    },
  });

  const handleApprove = (vendor: PendingVerification) => {
    verifyMutation.mutate({ vendorId: vendor.id, action: 'approve' });
  };

  const handleReject = () => {
    if (!selectedVendor) return;
    verifyMutation.mutate({ 
      vendorId: selectedVendor.id, 
      action: 'reject', 
      notes: rejectNotes || "Documento ilegivel ou invalido"
    });
  };

  const openRejectDialog = (vendor: PendingVerification) => {
    setSelectedVendor(vendor);
    setRejectNotes("");
    setShowRejectDialog(true);
  };

  return (
    <div className="space-y-6">
      {/* Document Preview Dialog */}
      <Dialog open={viewingDocument !== null} onOpenChange={() => setViewingDocument(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="text-white">
              {viewingDocument?.type === 'front' ? 'Frente do RG' : 'Verso do RG'}
            </DialogTitle>
          </DialogHeader>
          {viewingDocument && (
            <div className="flex justify-center">
              <img 
                src={viewingDocument.url} 
                alt={viewingDocument.type} 
                className="max-h-[70vh] object-contain rounded-lg"
              />
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-white">Rejeitar Verificacao</DialogTitle>
            <DialogDescription>
              Informe o motivo da rejeicao para o vendedor {selectedVendor?.storeName || selectedVendor?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Textarea
              placeholder="Ex: Documento ilegivel, fora de foco, ou dados incompativeis"
              value={rejectNotes}
              onChange={(e) => setRejectNotes(e.target.value)}
              className="min-h-[100px]"
              data-testid="input-reject-notes"
            />
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setShowRejectDialog(false)}
              data-testid="button-cancel-reject"
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={verifyMutation.isPending}
              data-testid="button-confirm-reject"
            >
              {verifyMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Rejeitando...
                </>
              ) : (
                <>
                  <XCircle className="w-4 h-4 mr-2" />
                  Rejeitar
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div>
        <h1 className="text-3xl font-bold text-white">Verificacoes Pendentes</h1>
        <p className="text-gray-400 text-sm mt-1">Aprove ou rejeite documentos de identidade dos vendedores</p>
      </div>

      <Card
        style={{
          backgroundColor: "#1E1E1E",
          borderColor: "rgba(255,255,255,0.1)",
        }}
      >
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <FileCheck className="w-5 h-5" />
            Aguardando Verificacao: {pendingVerifications.length}
          </CardTitle>
        </CardHeader>

        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
            </div>
          ) : pendingVerifications.length === 0 ? (
            <div className="text-center py-12">
              <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
              <p className="text-gray-400 mb-2">Nenhuma verificacao pendente</p>
              <p className="text-xs text-gray-500">
                Novas solicitacoes aparecerão aqui quando vendedores enviarem documentos
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {pendingVerifications.map((vendor) => (
                <div
                  key={vendor.id}
                  className="p-4 rounded-lg border border-white/10 bg-white/5"
                  data-testid={`card-verification-${vendor.id}`}
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="text-white font-semibold">
                          {vendor.storeName || vendor.name}
                        </h3>
                        <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">
                          <AlertCircle className="w-3 h-3 mr-1" />
                          Pendente
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-400">{vendor.email}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        Enviado em: {new Date(vendor.createdAt).toLocaleDateString("pt-BR")}
                      </p>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-2">
                      {/* Document Preview Buttons */}
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setViewingDocument({ url: vendor.documentFrontUrl, type: 'front' })}
                          className="text-blue-400"
                          data-testid={`button-view-front-${vendor.id}`}
                        >
                          <Eye className="w-4 h-4 mr-1" />
                          Frente
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setViewingDocument({ url: vendor.documentBackUrl, type: 'back' })}
                          className="text-blue-400"
                          data-testid={`button-view-back-${vendor.id}`}
                        >
                          <Eye className="w-4 h-4 mr-1" />
                          Verso
                        </Button>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => handleApprove(vendor)}
                          disabled={verifyMutation.isPending}
                          className="bg-green-600 hover:bg-green-700 text-white"
                          data-testid={`button-approve-${vendor.id}`}
                        >
                          {verifyMutation.isPending ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <>
                              <CheckCircle className="w-4 h-4 mr-1" />
                              Aprovar
                            </>
                          )}
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => openRejectDialog(vendor)}
                          disabled={verifyMutation.isPending}
                          data-testid={`button-reject-${vendor.id}`}
                        >
                          <XCircle className="w-4 h-4 mr-1" />
                          Rejeitar
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
