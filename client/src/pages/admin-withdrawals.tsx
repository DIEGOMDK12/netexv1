import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, CheckCircle, XCircle, Clock, Wallet, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import type { WithdrawalRequest } from "@shared/schema";

interface WithdrawalWithReseller extends WithdrawalRequest {
  reseller?: {
    id: number;
    storeName: string;
    email: string;
  };
}

export default function AdminWithdrawals() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedWithdrawal, setSelectedWithdrawal] = useState<WithdrawalWithReseller | null>(null);
  const [actionType, setActionType] = useState<"approve" | "reject" | null>(null);
  const [adminNotes, setAdminNotes] = useState("");
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: withdrawals, isLoading } = useQuery<WithdrawalWithReseller[]>({
    queryKey: ["/api/admin/withdrawals"],
    queryFn: async () => {
      const token = localStorage.getItem("admin_token");
      if (!token) throw new Error("No auth token");
      
      const response = await fetch("/api/admin/withdrawals", {
        headers: {
          "Authorization": `Bearer ${token}`,
        },
      });
      if (!response.ok) {
        throw new Error("Failed to fetch withdrawals");
      }
      return response.json();
    },
  });

  const updateWithdrawalMutation = useMutation({
    mutationFn: async ({ id, status, adminNotes }: { id: number; status: string; adminNotes?: string }) => {
      const token = localStorage.getItem("admin_token");
      if (!token) throw new Error("No auth token");
      
      const response = await fetch(`/api/admin/withdrawals/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({ status, adminNotes }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Erro ao atualizar retirada");
      }
      return response.json();
    },
    onSuccess: (_, variables) => {
      toast({
        title: variables.status === "approved" ? "Retirada aprovada!" : "Retirada rejeitada",
        description: variables.status === "approved" 
          ? "O saldo foi debitado da conta do revendedor."
          : "O revendedor foi notificado sobre a rejeicao.",
      });
      setSelectedWithdrawal(null);
      setActionType(null);
      setAdminNotes("");
      queryClient.invalidateQueries({ queryKey: ["/api/admin/withdrawals"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleAction = (withdrawal: WithdrawalWithReseller, action: "approve" | "reject") => {
    setSelectedWithdrawal(withdrawal);
    setActionType(action);
    setAdminNotes("");
  };

  const confirmAction = () => {
    if (!selectedWithdrawal || !actionType) return;
    
    updateWithdrawalMutation.mutate({
      id: selectedWithdrawal.id,
      status: actionType === "approve" ? "approved" : "rejected",
      adminNotes: adminNotes.trim() || undefined,
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return {
          bg: "rgba(245, 158, 11, 0.2)",
          color: "#f59e0b",
          icon: <Clock className="w-3 h-3" />,
          text: "Pendente",
        };
      case "approved":
        return {
          bg: "rgba(16, 185, 129, 0.2)",
          color: "#10b981",
          icon: <CheckCircle className="w-3 h-3" />,
          text: "Aprovado",
        };
      case "rejected":
        return {
          bg: "rgba(239, 68, 68, 0.2)",
          color: "#ef4444",
          icon: <XCircle className="w-3 h-3" />,
          text: "Rejeitado",
        };
      default:
        return {
          bg: "rgba(156, 163, 175, 0.2)",
          color: "#9ca3af",
          icon: <Clock className="w-3 h-3" />,
          text: status,
        };
    }
  };

  const formatDate = (dateString: string | Date | null) => {
    if (!dateString) return "-";
    const date = new Date(dateString);
    return date.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const filteredWithdrawals = withdrawals?.filter((w) => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      w.reseller?.storeName?.toLowerCase().includes(search) ||
      w.reseller?.email?.toLowerCase().includes(search) ||
      w.pixKey.toLowerCase().includes(search)
    );
  });

  const pendingCount = withdrawals?.filter(w => w.status === "pending").length ?? 0;
  const totalPendingAmount = withdrawals
    ?.filter(w => w.status === "pending")
    .reduce((sum, w) => sum + parseFloat(w.amount.toString()), 0) ?? 0;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-teal-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-2xl font-bold text-white">Gerenciar Retiradas</h1>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card
          style={{
            background: "linear-gradient(135deg, rgba(245, 158, 11, 0.15) 0%, rgba(217, 119, 6, 0.15) 100%)",
            backdropFilter: "blur(12px)",
            border: "1px solid rgba(245, 158, 11, 0.3)",
          }}
          className="shadow-lg"
          data-testid="card-pending-withdrawals"
        >
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-gray-400">Retiradas Pendentes</CardTitle>
              <Clock className="w-5 h-5 text-amber-500" />
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-amber-400">{pendingCount}</p>
            <p className="text-xs text-gray-500 mt-2">Aguardando aprovacao</p>
          </CardContent>
        </Card>

        <Card
          style={{
            background: "linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(5, 150, 105, 0.15) 100%)",
            backdropFilter: "blur(12px)",
            border: "1px solid rgba(16, 185, 129, 0.3)",
          }}
          className="shadow-lg"
          data-testid="card-pending-amount"
        >
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-gray-400">Valor Total Pendente</CardTitle>
              <Wallet className="w-5 h-5 text-emerald-500" />
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-emerald-400">R$ {totalPendingAmount.toFixed(2)}</p>
            <p className="text-xs text-gray-500 mt-2">Para ser pago via PIX</p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-500" />
        <Input
          placeholder="Buscar por loja, email ou chave PIX..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10 bg-zinc-900 border-zinc-700 text-white"
          data-testid="input-search-withdrawals"
        />
      </div>

      {/* Withdrawals Table */}
      <Card
        style={{
          background: "rgba(30, 30, 30, 0.4)",
          backdropFilter: "blur(12px)",
          border: "1px solid rgba(255, 255, 255, 0.1)",
        }}
        className="shadow-lg"
        data-testid="card-withdrawals-table"
      >
        <CardHeader>
          <CardTitle className="text-white text-lg">Solicitacoes de Retirada</CardTitle>
        </CardHeader>
        <CardContent>
          {!filteredWithdrawals || filteredWithdrawals.length === 0 ? (
            <p className="text-center text-gray-400 py-8">Nenhuma solicitacao de retirada encontrada</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left py-3 px-3 text-gray-400 font-medium">Data</th>
                    <th className="text-left py-3 px-3 text-gray-400 font-medium">Loja</th>
                    <th className="text-right py-3 px-3 text-gray-400 font-medium">Valor</th>
                    <th className="text-left py-3 px-3 text-gray-400 font-medium hidden xl:table-cell">Titular</th>
                    <th className="text-left py-3 px-3 text-gray-400 font-medium hidden lg:table-cell">Chave PIX</th>
                    <th className="text-left py-3 px-3 text-gray-400 font-medium hidden md:table-cell">Tipo</th>
                    <th className="text-center py-3 px-3 text-gray-400 font-medium">Status</th>
                    <th className="text-center py-3 px-3 text-gray-400 font-medium">Acoes</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredWithdrawals.map((withdrawal) => {
                    const badge = getStatusBadge(withdrawal.status);
                    return (
                      <tr key={withdrawal.id} className="border-b border-white/5 hover:bg-white/5 transition">
                        <td className="py-3 px-3 text-gray-300 text-sm">
                          {formatDate(withdrawal.createdAt)}
                        </td>
                        <td className="py-3 px-3">
                          <div>
                            <p className="text-white font-medium">{withdrawal.reseller?.storeName || "N/A"}</p>
                            <p className="text-xs text-gray-500">{withdrawal.reseller?.email || ""}</p>
                          </div>
                        </td>
                        <td className="py-3 px-3 text-right font-semibold text-emerald-400">
                          R$ {parseFloat(withdrawal.amount.toString()).toFixed(2)}
                        </td>
                        <td className="py-3 px-3 text-white hidden xl:table-cell text-sm truncate max-w-[150px]">
                          {withdrawal.pixHolderName || "-"}
                        </td>
                        <td className="py-3 px-3 text-gray-400 hidden lg:table-cell text-sm truncate max-w-[200px]">
                          {withdrawal.pixKey}
                        </td>
                        <td className="py-3 px-3 text-gray-400 hidden md:table-cell text-sm uppercase">
                          {withdrawal.pixKeyType}
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span
                            className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium"
                            style={{
                              background: badge.bg,
                              color: badge.color,
                            }}
                          >
                            {badge.icon}
                            {badge.text}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-center">
                          {withdrawal.status === "pending" ? (
                            <div className="flex items-center justify-center gap-2">
                              <Button
                                size="sm"
                                onClick={() => handleAction(withdrawal, "approve")}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white"
                                data-testid={`button-approve-${withdrawal.id}`}
                              >
                                <CheckCircle className="w-3 h-3 mr-1" />
                                Aprovar
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleAction(withdrawal, "reject")}
                                className="border-red-500/50 text-red-400 hover:bg-red-500/10"
                                data-testid={`button-reject-${withdrawal.id}`}
                              >
                                <XCircle className="w-3 h-3 mr-1" />
                                Rejeitar
                              </Button>
                            </div>
                          ) : (
                            <span className="text-gray-500 text-xs">
                              {withdrawal.processedAt ? formatDate(withdrawal.processedAt) : "-"}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Confirmation Dialog */}
      <Dialog open={!!selectedWithdrawal && !!actionType} onOpenChange={() => { setSelectedWithdrawal(null); setActionType(null); }}>
        <DialogContent 
          className="sm:max-w-md"
          style={{
            background: "#1A1A1A",
            border: "1px solid rgba(255, 255, 255, 0.1)",
          }}
        >
          <DialogHeader>
            <DialogTitle className="text-white">
              {actionType === "approve" ? "Aprovar Retirada" : "Rejeitar Retirada"}
            </DialogTitle>
            <DialogDescription className="text-gray-400">
              {actionType === "approve" 
                ? "Confirme que voce ja realizou o pagamento via PIX para o revendedor."
                : "Informe o motivo da rejeicao para o revendedor."}
            </DialogDescription>
          </DialogHeader>
          
          {selectedWithdrawal && (
            <div className="space-y-4 py-4">
              <div className="p-3 rounded-lg" style={{ background: "rgba(30, 30, 30, 0.6)", border: "1px solid rgba(255, 255, 255, 0.1)" }}>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <p className="text-gray-500">Loja</p>
                    <p className="text-white font-medium">{selectedWithdrawal.reseller?.storeName}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Valor Solicitado</p>
                    <p className="text-emerald-400 font-bold">R$ {parseFloat(selectedWithdrawal.amount.toString()).toFixed(2)}</p>
                  </div>
                  {selectedWithdrawal.netAmount && (
                    <div>
                      <p className="text-gray-500">Valor Liquido</p>
                      <p className="text-white font-bold">R$ {parseFloat(selectedWithdrawal.netAmount.toString()).toFixed(2)}</p>
                    </div>
                  )}
                  {selectedWithdrawal.withdrawalFee && (
                    <div>
                      <p className="text-gray-500">Taxa</p>
                      <p className="text-yellow-400">R$ {parseFloat(selectedWithdrawal.withdrawalFee.toString()).toFixed(2)}</p>
                    </div>
                  )}
                  <div className="col-span-2">
                    <p className="text-gray-500">Titular da Conta</p>
                    <p className="text-white font-medium">{selectedWithdrawal.pixHolderName || "Nao informado"}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-gray-500">Chave PIX ({selectedWithdrawal.pixKeyType.toUpperCase()})</p>
                    <p className="text-white font-mono">{selectedWithdrawal.pixKey}</p>
                  </div>
                </div>
              </div>
              
              {actionType === "reject" && (
                <div className="space-y-2">
                  <Label htmlFor="adminNotes" className="text-gray-300">Motivo da rejeicao</Label>
                  <Textarea
                    id="adminNotes"
                    placeholder="Explique o motivo da rejeicao..."
                    value={adminNotes}
                    onChange={(e) => setAdminNotes(e.target.value)}
                    className="bg-zinc-900 border-zinc-700 text-white"
                    data-testid="textarea-admin-notes"
                  />
                </div>
              )}
              
              {actionType === "approve" && (
                <div className="space-y-2">
                  <Label htmlFor="adminNotes" className="text-gray-300">Observacoes (opcional)</Label>
                  <Textarea
                    id="adminNotes"
                    placeholder="Adicione observacoes se necessario..."
                    value={adminNotes}
                    onChange={(e) => setAdminNotes(e.target.value)}
                    className="bg-zinc-900 border-zinc-700 text-white"
                    data-testid="textarea-admin-notes"
                  />
                </div>
              )}
            </div>
          )}
          
          <DialogFooter className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => { setSelectedWithdrawal(null); setActionType(null); }}
              className="border-zinc-700 text-gray-300"
              data-testid="button-cancel-action"
            >
              Cancelar
            </Button>
            <Button
              onClick={confirmAction}
              disabled={updateWithdrawalMutation.isPending || (actionType === "reject" && !adminNotes.trim())}
              className={actionType === "approve" 
                ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                : "bg-red-600 hover:bg-red-700 text-white"
              }
              data-testid="button-confirm-action"
            >
              {updateWithdrawalMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : null}
              {actionType === "approve" ? "Confirmar Aprovacao" : "Confirmar Rejeicao"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
