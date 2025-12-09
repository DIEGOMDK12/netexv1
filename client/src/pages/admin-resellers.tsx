import { useQuery, useMutation } from "@tanstack/react-query";
import { Loader2, Store, Lock, Trash2, Unlock, BadgeCheck, ShieldOff } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface ResellerData {
  id: number;
  storeName: string;
  email: string;
  createdAt: string;
  active: boolean;
  productCount: number;
  subscriptionStatus?: string;
  subscriptionExpiresAt?: string;
  verificationStatus?: string;
}

export default function AdminResellers() {
  const { toast } = useToast();
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const { data: resellers = [], isLoading } = useQuery<ResellerData[]>({
    queryKey: ["/api/admin/resellers"],
  });

  const banMutation = useMutation({
    mutationFn: async (resellerId: number) => {
      return apiRequest("PATCH", `/api/admin/resellers/${resellerId}/ban`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/resellers"] });
      toast({ title: "Revenda bloqueada com sucesso" });
    },
  });

  const unbanMutation = useMutation({
    mutationFn: async (resellerId: number) => {
      return apiRequest("PATCH", `/api/admin/resellers/${resellerId}/unban`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/resellers"] });
      toast({ title: "Revenda desbloqueada com sucesso" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (resellerId: number) => {
      return apiRequest("DELETE", `/api/admin/resellers/${resellerId}`, null);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/resellers"] });
      toast({ title: "Revenda deletada com sucesso" });
      setDeleteConfirm(null);
    },
  });

  const renewSubscriptionMutation = useMutation({
    mutationFn: async (resellerId: number) => {
      const response = await apiRequest("PUT", `/api/admin/resellers/${resellerId}/activate-sub`, {});
      return response;
    },
    onSuccess: (data) => {
      console.log("[🟢 Admin] Assinatura ativada - invalidando cache e refetch...");
      // Invalidate admin resellers list
      queryClient.invalidateQueries({ queryKey: ["/api/admin/resellers"] });
      // Invalidate vendor profile if it was activated
      queryClient.invalidateQueries({ queryKey: ["/api/vendor/profile"] });
      // Force refetch immediately
      queryClient.refetchQueries({ queryKey: ["/api/admin/resellers"] });
      toast({ title: "Assinatura ativada por 30 dias!" });
    },
    onError: (error: any) => {
      toast({ 
        title: "Erro ao ativar assinatura", 
        description: error.message,
        variant: "destructive"
      });
    },
  });

  const toggleVerificationMutation = useMutation({
    mutationFn: async ({ resellerId, action }: { resellerId: number; action: 'approve' | 'revoke' }) => {
      return apiRequest("POST", `/api/admin/resellers/${resellerId}/toggle-verification`, { action });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/resellers"] });
      toast({ 
        title: variables.action === 'approve' 
          ? "Revenda verificada com sucesso!" 
          : "Verificacao removida"
      });
    },
    onError: (error: any) => {
      toast({ 
        title: "Erro ao alterar verificacao", 
        description: error.message,
        variant: "destructive"
      });
    },
  });

  // REMOVED: Loading state no longer blocks UI - shows empty state while loading
  // if (isLoading) {
  //   return (
  //     <div className="flex items-center justify-center min-h-[50vh]">
  //       <Loader2 className="w-8 h-8 animate-spin text-teal-500" />
  //     </div>
  //   );
  // }

  return (
    <div className="space-y-6">
      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteConfirm !== null} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogTitle>Deletar Revenda?</AlertDialogTitle>
          <AlertDialogDescription>
            Tem certeza que deseja deletar esta revenda permanentemente? Todos os produtos e pedidos serão removidos. Esta ação não pode ser desfeita.
          </AlertDialogDescription>
          <div className="flex gap-2 justify-end">
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteConfirm) {
                  deleteMutation.mutate(deleteConfirm);
                }
              }}
              className="bg-red-600 hover:bg-red-700"
            >
              Deletar
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      <div>
        <h1 className="text-3xl font-bold text-white">Lojas/Revendas Cadastradas</h1>
        <p className="text-gray-400 text-sm mt-1">Gerencie todos os revendedores da plataforma</p>
      </div>

      <Card
        style={{
          backgroundColor: "#1E1E1E",
          borderColor: "rgba(255,255,255,0.1)",
        }}
      >
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Store className="w-5 h-5" />
            Total de Revendas: {resellers.length}
          </CardTitle>
        </CardHeader>

        <CardContent>
          {resellers.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-400 mb-2">Nenhuma revenda encontrada</p>
              <p className="text-xs text-gray-500">
                Novas lojas aparecerão aqui quando revendedores se cadastrarem
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr
                    className="border-b"
                    style={{ borderColor: "rgba(255,255,255,0.1)" }}
                  >
                    <th className="text-left py-4 text-gray-400 font-semibold">
                      Nome da Loja
                    </th>
                    <th className="text-left py-4 text-gray-400 font-semibold">
                      E-mail
                    </th>
                    <th className="text-center py-4 text-gray-400 font-semibold">
                      Produtos
                    </th>
                    <th className="text-left py-4 text-gray-400 font-semibold">
                      Data de Cadastro
                    </th>
                    <th className="text-center py-4 text-gray-400 font-semibold">
                      Status
                    </th>
                    <th className="text-center py-4 text-gray-400 font-semibold">
                      Ações
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {resellers.map((reseller) => (
                    <tr
                      key={reseller.id}
                      className="border-b hover:bg-zinc-800/50 transition-colors"
                      style={{ borderColor: "rgba(255,255,255,0.05)" }}
                      data-testid={`row-reseller-${reseller.id}`}
                    >
                      <td className="py-4 text-white font-medium">
                        <div className="flex items-center gap-2">
                          {reseller.storeName || "Sem nome"}
                          {reseller.verificationStatus === "approved" && (
                            <BadgeCheck className="w-5 h-5 text-emerald-400" data-testid={`icon-verified-${reseller.id}`} />
                          )}
                        </div>
                      </td>
                      <td className="py-4 text-gray-300">{reseller.email}</td>
                      <td className="py-4 text-center">
                        <span className="text-white">{reseller.productCount}</span>
                      </td>
                      <td className="py-4 text-gray-400">
                        {new Date(reseller.createdAt).toLocaleDateString("pt-BR")}
                      </td>
                      <td className="py-4 text-center">
                        <Badge
                          variant={reseller.active ? "default" : "secondary"}
                          className={
                            reseller.active
                              ? "bg-green-500/20 text-green-400 border border-green-500/30"
                              : "bg-red-500/20 text-red-400 border border-red-500/30"
                          }
                          data-testid={`badge-status-${reseller.id}`}
                        >
                          {reseller.active ? "Ativo" : "Bloqueado"}
                        </Badge>
                      </td>
                      <td className="py-4 text-center flex flex-wrap gap-2 justify-center">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            const isVerified = reseller.verificationStatus === "approved";
                            toggleVerificationMutation.mutate({
                              resellerId: reseller.id,
                              action: isVerified ? 'revoke' : 'approve'
                            });
                          }}
                          disabled={toggleVerificationMutation.isPending}
                          className={reseller.verificationStatus === "approved" ? "text-emerald-400 hover:bg-emerald-500/10" : "text-gray-400 hover:bg-gray-500/10"}
                          data-testid={`button-toggle-verification-${reseller.id}`}
                        >
                          {toggleVerificationMutation.isPending ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : reseller.verificationStatus === "approved" ? (
                            <>
                              <BadgeCheck className="w-3 h-3 mr-1" />
                              Verificado
                            </>
                          ) : (
                            <>
                              <ShieldOff className="w-3 h-3 mr-1" />
                              Verificar
                            </>
                          )}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            if (reseller.active) {
                              banMutation.mutate(reseller.id);
                            } else {
                              unbanMutation.mutate(reseller.id);
                            }
                          }}
                          disabled={banMutation.isPending || unbanMutation.isPending}
                          className={reseller.active ? "text-yellow-400 hover:bg-yellow-500/10" : "text-green-400 hover:bg-green-500/10"}
                          data-testid={`button-ban-reseller-${reseller.id}`}
                        >
                          {banMutation.isPending || unbanMutation.isPending ? (
                            <>
                              <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                              {reseller.active ? "Bloqueando..." : "Desbloqueando..."}
                            </>
                          ) : reseller.active ? (
                            <>
                              <Lock className="w-3 h-3 mr-1" />
                              Bloquear
                            </>
                          ) : (
                            <>
                              <Unlock className="w-3 h-3 mr-1" />
                              Desbloquear
                            </>
                          )}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-red-400 hover:bg-red-500/10"
                          onClick={() => setDeleteConfirm(reseller.id)}
                          disabled={deleteMutation.isPending}
                          data-testid={`button-delete-reseller-${reseller.id}`}
                        >
                          {deleteMutation.isPending ? (
                            <>
                              <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                              Deletando...
                            </>
                          ) : (
                            <>
                              <Trash2 className="w-3 h-3 mr-1" />
                              Deletar
                            </>
                          )}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
