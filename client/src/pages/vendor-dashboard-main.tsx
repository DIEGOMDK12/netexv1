import { useQuery } from "@tanstack/react-query";
import { Loader2, TrendingUp, ShoppingBag, DollarSign, Copy, Check, CheckCircle, Clock, Eye, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useState, useEffect } from "react";
import type { Reseller, Order } from "@shared/schema";

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

  // Fetch vendor stats (total sales only from paid orders)
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

  // Fetch recent orders for this vendor
  useEffect(() => {
    const fetchOrders = async () => {
      try {
        const response = await fetch(`/api/vendor/orders?vendorId=${vendorId}`);
        if (response.ok) {
          const data = await response.json();
          // Get only last 5 orders
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

  const handleCopyLink = () => {
    if (storeLink) {
      navigator.clipboard.writeText(storeLink);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
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

      {/* Stats Grid - 3 Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
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
            <p className="text-4xl font-bold text-white">
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
            <p className="text-4xl font-bold text-white">{stats?.pendingOrders ?? 0}</p>
            <p className="text-xs text-gray-500 mt-2">Aguardando aprovação</p>
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
            <p className="text-4xl font-bold text-white">{productsCount}</p>
            <p className="text-xs text-gray-500 mt-2">Prontos para venda</p>
          </CardContent>
        </Card>
      </div>

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
          <CardTitle className="text-white text-lg">Últimas Vendas</CardTitle>
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
                    <th className="text-center py-3 px-3 text-gray-400 font-medium">Ação</th>
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
    </div>
  );
}
