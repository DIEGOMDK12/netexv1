import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, TrendingUp, ShoppingBag, DollarSign, Copy, Check, CheckCircle, Clock, Eye, AlertTriangle, Wallet, XCircle, ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import type { Reseller, Order, WithdrawalRequest } from "@shared/schema";

interface DashboardMainProps {
  vendorId: number;
  isAdmin?: boolean;
  subscriptionExpiresAt?: string | null;
}

interface VendorStats {
  totalRevenue: string;
  totalOrders: number;
  pendingOrders: number;
  paidOrders: number;
}

interface OrderWithDetails extends Order {
  items?: any[];
}

export function DashboardMain({ vendorId, isAdmin, subscriptionExpiresAt }: DashboardMainProps) {
  const [copiedLink, setCopiedLink] = useState(false);
  const [recentOrders, setRecentOrders] = useState<OrderWithDetails[]>([]);
  const [productsCount, setProductsCount] = useState(0);
  const [daysRemaining, setDaysRemaining] = useState<number | null>(null);
  const [withdrawalDialogOpen, setWithdrawalDialogOpen] = useState(false);
  const [withdrawalAmount, setWithdrawalAmount] = useState("");
  const [pixKey, setPixKey] = useState("");
  const [pixKeyType, setPixKeyType] = useState("cpf");
  const [pixHolderName, setPixHolderName] = useState("");
  
  // NOVA LÓGICA: Taxa cobrada apenas no SAQUE (não na venda)
  // O revendedor recebe 100% do valor da venda, taxa descontada apenas na retirada
  const TAXA_DE_SAQUE_FIXA = 1.60;
  const MIN_WITHDRAWAL = 5.00;
  
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  useEffect(() => {
    if (subscriptionExpiresAt) {
      const expiresAt = new Date(subscriptionExpiresAt);
      const now = new Date();
      const diffTime = expiresAt.getTime() - now.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      setDaysRemaining(diffDays);
    }
  }, [subscriptionExpiresAt]);
  
  const { data: vendor, isLoading } = useQuery<Reseller>({
    queryKey: ["/api/vendor/profile", vendorId],
  });

  const { data: stats } = useQuery<VendorStats>({
    queryKey: ["/api/vendor/stats"],
    queryFn: async () => {
      const token = localStorage.getItem("vendor_token");
      console.log("[DashboardMain] Fetching stats with token:", !!token);
      if (!token) throw new Error("No auth token");
      
      const response = await fetch("/api/vendor/stats", {
        headers: {
          "Authorization": `Bearer ${token}`,
        },
      });
      if (!response.ok) {
        const error = await response.json();
        console.error("[DashboardMain] Stats fetch failed:", error);
        throw new Error("Failed to fetch stats");
      }
      const data = await response.json();
      console.log("[DashboardMain] Stats received:", data);
      return data;
    },
    enabled: !!localStorage.getItem("vendor_token"),
  });

  const { data: withdrawals, isLoading: isLoadingWithdrawals } = useQuery<WithdrawalRequest[]>({
    queryKey: ["/api/vendor/withdrawals"],
    queryFn: async () => {
      const token = localStorage.getItem("vendor_token");
      if (!token) throw new Error("No auth token");
      
      const response = await fetch("/api/vendor/withdrawals", {
        headers: {
          "Authorization": `Bearer ${token}`,
        },
      });
      if (!response.ok) {
        throw new Error("Failed to fetch withdrawals");
      }
      return response.json();
    },
    enabled: !!localStorage.getItem("vendor_token"),
  });

  const createWithdrawalMutation = useMutation({
    mutationFn: async (data: { amount: string; pixKey: string; pixKeyType: string; pixHolderName: string }) => {
      const token = localStorage.getItem("vendor_token");
      if (!token) throw new Error("No auth token");
      
      const response = await fetch("/api/vendor/withdrawals", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Erro ao solicitar retirada");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Solicitacao enviada!",
        description: "Sua solicitacao de retirada foi enviada para analise.",
      });
      setWithdrawalDialogOpen(false);
      setWithdrawalAmount("");
      setPixKey("");
      setPixKeyType("cpf");
      setPixHolderName("");
      queryClient.invalidateQueries({ queryKey: ["/api/vendor/withdrawals"] });
      queryClient.invalidateQueries({ queryKey: ["/api/vendor/profile", vendorId] });
      queryClient.invalidateQueries({ queryKey: ["/api/vendor/stats"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    const fetchOrders = async () => {
      try {
        const response = await fetch(`/api/vendor/orders?vendorId=${vendorId}`);
        if (response.ok) {
          const data = await response.json();
          setRecentOrders(data.slice(0, 5));
        }
      } catch (error) {
        console.error("Failed to fetch orders:", error);
      }
    };

    const fetchProducts = async () => {
      try {
        const response = await fetch(`/api/vendor/products?vendorId=${vendorId}`);
        if (response.ok) {
          const data = await response.json();
          setProductsCount(data.length);
        }
      } catch (error) {
        console.error("Failed to fetch products:", error);
      }
    };

    if (vendorId) {
      fetchOrders();
      fetchProducts();
    }
  }, [vendorId]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  const storeLink = vendor?.slug ? `${window.location.origin}/loja/${vendor.slug}` : "";
  const availableBalance = vendor?.totalCommission ? parseFloat(vendor.totalCommission.toString()) : 0;

  const handleCopyLink = () => {
    if (storeLink) {
      navigator.clipboard.writeText(storeLink);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  const handleWithdrawalSubmit = () => {
    const amount = parseFloat(withdrawalAmount);
    if (isNaN(amount) || amount <= 0) {
      toast({
        title: "Valor invalido",
        description: "Digite um valor valido para retirada.",
        variant: "destructive",
      });
      return;
    }
    if (amount < MIN_WITHDRAWAL) {
      toast({
        title: "Valor minimo nao atingido",
        description: `O valor minimo para retirada e R$ ${MIN_WITHDRAWAL.toFixed(2)}.`,
        variant: "destructive",
      });
      return;
    }
    if (amount > availableBalance) {
      toast({
        title: "Saldo insuficiente",
        description: "O valor solicitado e maior que seu saldo disponivel.",
        variant: "destructive",
      });
      return;
    }
    if (!pixHolderName.trim()) {
      toast({
        title: "Nome do titular obrigatorio",
        description: "Digite o nome do titular da conta PIX.",
        variant: "destructive",
      });
      return;
    }
    if (!pixKey.trim()) {
      toast({
        title: "Chave PIX obrigatoria",
        description: "Digite sua chave PIX para receber o pagamento.",
        variant: "destructive",
      });
      return;
    }
    
    createWithdrawalMutation.mutate({
      amount: withdrawalAmount,
      pixKey: pixKey.trim(),
      pixKeyType,
      pixHolderName: pixHolderName.trim(),
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
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-3xl font-bold text-white">Dashboard</h1>
        {!isAdmin && vendor && vendor.slug && (
          <Button
            onClick={() => window.open(`${window.location.origin}/loja/${vendor.slug}`, "_blank")}
            variant="outline"
            className="flex items-center gap-2 border-blue-500/50 text-blue-400 hover:bg-blue-500/10"
            data-testid="button-view-store"
          >
            <Eye className="w-4 h-4" />
            Ver Minha Loja
          </Button>
        )}
      </div>


      {/* Subscription Status Card */}
      {daysRemaining !== null && (
        <Card
          style={{
            background: daysRemaining <= 7 
              ? "linear-gradient(135deg, rgba(239, 68, 68, 0.15) 0%, rgba(220, 38, 38, 0.15) 100%)"
              : "linear-gradient(135deg, rgba(59, 130, 246, 0.15) 0%, rgba(139, 92, 246, 0.15) 100%)",
            backdropFilter: "blur(12px)",
            border: daysRemaining <= 7 
              ? "1px solid rgba(239, 68, 68, 0.4)"
              : "1px solid rgba(59, 130, 246, 0.4)",
          }}
          className="shadow-lg"
          data-testid="card-subscription-status"
        >
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              {daysRemaining <= 7 ? (
                <AlertTriangle className="w-8 h-8 text-red-500 flex-shrink-0" />
              ) : (
                <Clock className="w-8 h-8 text-blue-500 flex-shrink-0" />
              )}
              <div>
                <p className="text-sm text-gray-400 font-semibold">Sua Assinatura Expira em</p>
                <p className={`text-2xl font-bold ${daysRemaining <= 7 ? 'text-red-400' : 'text-white'}`}>
                  {daysRemaining} dia{daysRemaining !== 1 ? 's' : ''}
                </p>
                {daysRemaining <= 7 && (
                  <p className="text-xs text-red-400 mt-1">Renove sua assinatura para continuar vendendo</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats Grid - 4 Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {/* Saldo Disponível */}
        <Card
          style={{
            background: "linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(5, 150, 105, 0.15) 100%)",
            backdropFilter: "blur(12px)",
            border: "1px solid rgba(16, 185, 129, 0.3)",
          }}
          className="shadow-lg"
          data-testid="card-saldo-disponivel"
        >
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-gray-400">Saldo Disponivel</CardTitle>
              <Wallet className="w-5 h-5 text-emerald-500" />
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-emerald-400">
              R$ {availableBalance.toFixed(2)}
            </p>
            <Button
              onClick={() => setWithdrawalDialogOpen(true)}
              disabled={availableBalance <= 0}
              className="mt-3 w-full bg-emerald-600 hover:bg-emerald-700 text-white"
              data-testid="button-solicitar-retirada"
            >
              <ArrowUpRight className="w-4 h-4 mr-2" />
              Solicitar Retirada
            </Button>
          </CardContent>
        </Card>

        {/* Total Vendido */}
        <Card
          style={{
            background: "rgba(30, 30, 30, 0.4)",
            backdropFilter: "blur(12px)",
            border: "1px solid rgba(255, 255, 255, 0.1)",
          }}
          className="shadow-lg"
          data-testid="card-total-vendido"
        >
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-gray-400">Total Vendido</CardTitle>
              <DollarSign className="w-5 h-5 text-green-500" />
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-white">
              R$ {stats?.totalRevenue ? parseFloat(stats.totalRevenue).toFixed(2) : "0.00"}
            </p>
            <p className="text-xs text-gray-500 mt-2">{stats?.paidOrders ?? 0} pedidos confirmados</p>
          </CardContent>
        </Card>

        {/* Pedidos Hoje */}
        <Card
          style={{
            background: "rgba(30, 30, 30, 0.4)",
            backdropFilter: "blur(12px)",
            border: "1px solid rgba(255, 255, 255, 0.1)",
          }}
          className="shadow-lg"
          data-testid="card-pedidos-hoje"
        >
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-gray-400">Pedidos Hoje</CardTitle>
              <Clock className="w-5 h-5 text-yellow-500" />
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-white">{stats?.pendingOrders ?? 0}</p>
            <p className="text-xs text-gray-500 mt-2">Aguardando aprovacao</p>
          </CardContent>
        </Card>

        {/* Produtos Ativos */}
        <Card
          style={{
            background: "rgba(30, 30, 30, 0.4)",
            backdropFilter: "blur(12px)",
            border: "1px solid rgba(255, 255, 255, 0.1)",
          }}
          className="shadow-lg"
          data-testid="card-produtos-ativos"
        >
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-gray-400">Produtos Ativos</CardTitle>
              <ShoppingBag className="w-5 h-5 text-purple-500" />
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-white">{productsCount}</p>
            <p className="text-xs text-gray-500 mt-2">Prontos para venda</p>
          </CardContent>
        </Card>
      </div>

      {/* Withdrawal History */}
      <Card
        style={{
          background: "rgba(30, 30, 30, 0.4)",
          backdropFilter: "blur(12px)",
          border: "1px solid rgba(255, 255, 255, 0.1)",
        }}
        className="shadow-lg"
        data-testid="card-historico-retiradas"
      >
        <CardHeader>
          <CardTitle className="text-white text-lg">Historico de Retiradas</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoadingWithdrawals ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
            </div>
          ) : !withdrawals || withdrawals.length === 0 ? (
            <p className="text-center text-gray-400 py-8">Nenhuma solicitacao de retirada</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left py-3 px-3 text-gray-400 font-medium">Data</th>
                    <th className="text-right py-3 px-3 text-gray-400 font-medium">Valor</th>
                    <th className="text-left py-3 px-3 text-gray-400 font-medium hidden md:table-cell">Chave PIX</th>
                    <th className="text-center py-3 px-3 text-gray-400 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {withdrawals.map((withdrawal) => {
                    const badge = getStatusBadge(withdrawal.status);
                    return (
                      <tr key={withdrawal.id} className="border-b border-white/5 hover:bg-white/5 transition">
                        <td className="py-3 px-3 text-white text-sm">
                          {formatDate(withdrawal.createdAt)}
                        </td>
                        <td className="py-3 px-3 text-right font-semibold text-emerald-400">
                          R$ {parseFloat(withdrawal.amount.toString()).toFixed(2)}
                        </td>
                        <td className="py-3 px-3 text-gray-400 hidden md:table-cell text-sm truncate max-w-[200px]">
                          {withdrawal.pixKey}
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
                          {withdrawal.status === "rejected" && withdrawal.adminNotes && (
                            <p className="text-xs text-red-400 mt-1">{withdrawal.adminNotes}</p>
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

      {/* Últimas Vendas - Table */}
      <Card
        style={{
          background: "rgba(30, 30, 30, 0.4)",
          backdropFilter: "blur(12px)",
          border: "1px solid rgba(255, 255, 255, 0.1)",
        }}
        className="shadow-lg"
        data-testid="card-ultimas-vendas"
      >
        <CardHeader>
          <CardTitle className="text-white text-lg">Ultimas Vendas</CardTitle>
        </CardHeader>
        <CardContent>
          {recentOrders.length === 0 ? (
            <p className="text-center text-gray-400 py-8">Nenhum pedido ainda</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left py-3 px-3 text-gray-400 font-medium">Cliente</th>
                    <th className="text-left py-3 px-3 text-gray-400 font-medium hidden md:table-cell">Produto</th>
                    <th className="text-right py-3 px-3 text-gray-400 font-medium">Valor</th>
                    <th className="text-center py-3 px-3 text-gray-400 font-medium">Status</th>
                    <th className="text-center py-3 px-3 text-gray-400 font-medium">Acao</th>
                  </tr>
                </thead>
                <tbody>
                  {recentOrders.map((order) => (
                    <tr key={order.id} className="border-b border-white/5 hover:bg-white/5 transition">
                      <td className="py-3 px-3 text-white text-sm truncate">{order.email}</td>
                      <td className="py-3 px-3 text-gray-400 hidden md:table-cell text-sm truncate">
                        {order.id}
                      </td>
                      <td className="py-3 px-3 text-right font-semibold text-green-400">
                        R$ {parseFloat(order.totalAmount.toString()).toFixed(2)}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span
                          className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium"
                          style={{
                            background:
                              order.status === "paid"
                                ? "rgba(16, 185, 129, 0.2)"
                                : "rgba(245, 158, 11, 0.2)",
                            color:
                              order.status === "paid"
                                ? "#10b981"
                                : "#f59e0b",
                          }}
                        >
                          {order.status === "paid" ? (
                            <CheckCircle className="w-3 h-3" />
                          ) : (
                            <Clock className="w-3 h-3" />
                          )}
                          {order.status === "paid" ? "Pago" : "Pendente"}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-blue-400 hover:text-blue-300 hover:bg-blue-500/10"
                          data-testid={`button-view-order-${order.id}`}
                        >
                          Ver
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

      {/* Withdrawal Request Dialog */}
      <Dialog open={withdrawalDialogOpen} onOpenChange={setWithdrawalDialogOpen}>
        <DialogContent 
          className="sm:max-w-md"
          style={{
            background: "#1A1A1A",
            border: "1px solid rgba(255, 255, 255, 0.1)",
          }}
        >
          <DialogHeader>
            <DialogTitle className="text-white">Solicitar Retirada</DialogTitle>
            <DialogDescription className="text-gray-400">
              Preencha os dados para solicitar uma retirada de saldo via PIX.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="p-3 rounded-lg" style={{ background: "rgba(16, 185, 129, 0.1)", border: "1px solid rgba(16, 185, 129, 0.3)" }}>
              <p className="text-sm text-gray-400">Saldo disponivel</p>
              <p className="text-2xl font-bold text-emerald-400">R$ {availableBalance.toFixed(2)}</p>
            </div>
            
            <div className="p-3 rounded-lg space-y-2" style={{ background: "rgba(245, 158, 11, 0.1)", border: "1px solid rgba(245, 158, 11, 0.3)" }}>
              <p className="text-sm font-medium text-yellow-400">Como funciona</p>
              <div className="text-xs text-gray-400 space-y-1">
                <p>Voce recebe <span className="text-emerald-400 font-medium">100% do valor</span> de cada venda!</p>
                <p>Taxa fixa de saque: <span className="text-white font-medium">R$ {TAXA_DE_SAQUE_FIXA.toFixed(2)}</span> (cobrada apenas na retirada)</p>
                <p>Valor minimo para retirada: <span className="text-white">R$ {MIN_WITHDRAWAL.toFixed(2)}</span></p>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="amount" className="text-gray-300">Valor que deseja receber via PIX (minimo R$ {MIN_WITHDRAWAL.toFixed(2)})</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                min={MIN_WITHDRAWAL}
                max={Math.max(0, availableBalance - TAXA_DE_SAQUE_FIXA)}
                placeholder={MIN_WITHDRAWAL.toFixed(2)}
                value={withdrawalAmount}
                onChange={(e) => setWithdrawalAmount(e.target.value)}
                className="bg-zinc-900 border-zinc-700 text-white"
                data-testid="input-withdrawal-amount"
              />
              {withdrawalAmount && parseFloat(withdrawalAmount) >= MIN_WITHDRAWAL && (
                <div className="text-xs text-gray-400 mt-1 p-2 rounded" style={{ background: "rgba(16, 185, 129, 0.1)" }}>
                  <p>Voce recebera via PIX: <span className="text-emerald-400 font-bold text-sm">R$ {parseFloat(withdrawalAmount).toFixed(2)}</span></p>
                  <p>Taxa de saque (descontada do saldo): <span className="text-yellow-400">R$ {TAXA_DE_SAQUE_FIXA.toFixed(2)}</span></p>
                  <p className="mt-1 text-white">Total a debitar do seu saldo: <span className="font-medium">R$ {(parseFloat(withdrawalAmount) + TAXA_DE_SAQUE_FIXA).toFixed(2)}</span></p>
                </div>
              )}
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="pixHolderName" className="text-gray-300">Nome do titular da conta PIX</Label>
              <Input
                id="pixHolderName"
                type="text"
                placeholder="Nome completo do titular"
                value={pixHolderName}
                onChange={(e) => setPixHolderName(e.target.value)}
                className="bg-zinc-900 border-zinc-700 text-white"
                data-testid="input-pix-holder-name"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="pixKeyType" className="text-gray-300">Tipo de chave PIX</Label>
              <Select value={pixKeyType} onValueChange={setPixKeyType}>
                <SelectTrigger className="bg-zinc-900 border-zinc-700 text-white" data-testid="select-pix-key-type">
                  <SelectValue placeholder="Selecione o tipo" />
                </SelectTrigger>
                <SelectContent className="bg-zinc-900 border-zinc-700">
                  <SelectItem value="cpf" data-testid="select-item-cpf">CPF</SelectItem>
                  <SelectItem value="cnpj" data-testid="select-item-cnpj">CNPJ</SelectItem>
                  <SelectItem value="email" data-testid="select-item-email">E-mail</SelectItem>
                  <SelectItem value="phone" data-testid="select-item-phone">Telefone</SelectItem>
                  <SelectItem value="random" data-testid="select-item-random">Chave aleatoria</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="pixKey" className="text-gray-300">Chave PIX</Label>
              <Input
                id="pixKey"
                type="text"
                placeholder={pixKeyType === "cpf" ? "000.000.000-00" : pixKeyType === "email" ? "email@exemplo.com" : "Digite sua chave PIX"}
                value={pixKey}
                onChange={(e) => setPixKey(e.target.value)}
                className="bg-zinc-900 border-zinc-700 text-white"
                data-testid="input-pix-key"
              />
            </div>
          </div>
          
          <DialogFooter className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setWithdrawalDialogOpen(false)}
              className="border-zinc-700 text-gray-300"
              data-testid="button-cancel-withdrawal"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleWithdrawalSubmit}
              disabled={createWithdrawalMutation.isPending}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
              data-testid="button-confirm-withdrawal"
            >
              {createWithdrawalMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : null}
              Confirmar Solicitacao
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
