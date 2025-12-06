import { useQuery, useMutation } from "@tanstack/react-query";
import { Loader2, Check, Trash2, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Order } from "@shared/schema";

export default function AdminOrders() {
  const { toast } = useToast();
  const { data: orders, isLoading } = useQuery<Order[]>({
    queryKey: ["/api/admin/orders"],
  });

  const approveMutation = useMutation({
    mutationFn: async (orderId: number) => {
      const response = await apiRequest("POST", `/api/admin/orders/${orderId}/approve`, {});
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/orders"] });
      toast({ title: "Pagamento aprovado com sucesso!" });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao aprovar pagamento",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (orderId: number) => {
      console.log("[AdminOrders] DELETE order:", orderId);
      const response = await apiRequest("DELETE", `/api/orders/${orderId}`, null);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/orders"] });
      toast({ title: "Encomenda excluída com sucesso!" });
    },
    onError: (error: any) => {
      console.error("[AdminOrders] DELETE error:", error);
      toast({
        title: "Erro ao excluir encomenda",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const openWhatsApp = (whatsapp: string | null) => {
    if (!whatsapp) return;
    const url = `https://wa.me/${whatsapp}?text=Olá%2C%20verificar%20status%20do%20pedido`;
    window.open(url, "_blank");
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-8 h-8 animate-spin text-teal-500" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold text-white">Encomendas</h2>
        <p className="text-gray-400 text-sm mt-1">{orders?.length || 0} encomendas no total</p>
      </div>

      {/* Orders Table */}
      <div
        className="rounded-lg border overflow-hidden"
        style={{ backgroundColor: "#1E1E1E", borderColor: "rgba(255,255,255,0.1)" }}
      >
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr
                style={{ backgroundColor: "#242424", borderColor: "rgba(255,255,255,0.1)" }}
                className="border-b"
              >
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">ID</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">Email</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">WhatsApp</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">IMEI</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">Valor</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">Ações</th>
              </tr>
            </thead>
            <tbody>
              {orders && orders.length > 0 ? (
                orders.map((order) => (
                  <tr
                    key={order.id}
                    style={{ borderColor: "rgba(255,255,255,0.1)" }}
                    className="border-b hover:bg-zinc-800/50 transition-colors"
                    data-testid={`order-row-${order.id}`}
                  >
                    <td className="px-6 py-3 text-white font-medium">#{order.id}</td>
                    <td className="px-6 py-3 text-gray-300">{order.email}</td>
                    <td className="px-6 py-3">
                      {order.whatsapp ? (
                        <div className="flex items-center gap-2">
                          <span className="text-gray-300">{order.whatsapp}</span>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => openWhatsApp(order.whatsapp)}
                            className="text-teal-400 hover:text-teal-300 p-0 h-auto"
                            data-testid={`button-whatsapp-${order.id}`}
                          >
                            <MessageCircle className="w-4 h-4" />
                          </Button>
                        </div>
                      ) : (
                        <span className="text-gray-500">-</span>
                      )}
                    </td>
                    <td className="px-6 py-3 text-gray-300">
                      {order.imei ? (
                        <span className="font-mono text-sm bg-zinc-900 px-3 py-1 rounded">{order.imei}</span>
                      ) : (
                        <span className="text-gray-500">-</span>
                      )}
                    </td>
                    <td className="px-6 py-3 text-white">R$ {Number(order.totalAmount).toFixed(2)}</td>
                    <td className="px-6 py-3">
                      <span
                        className={`text-xs px-3 py-1 rounded inline-block font-medium ${
                          order.status === "paid"
                            ? "bg-green-500/20 text-green-400"
                            : order.status === "completed"
                              ? "bg-blue-500/20 text-blue-400"
                              : order.status === "pending"
                                ? "bg-yellow-500/20 text-yellow-400"
                                : "bg-red-500/20 text-red-400"
                        }`}
                      >
                        {order.status === "paid"
                          ? "Pago"
                          : order.status === "completed"
                            ? "Completo"
                            : order.status === "pending"
                              ? "Pendente"
                              : "Cancelado"}
                      </span>
                    </td>
                    <td className="px-6 py-3 flex gap-2">
                      {order.status === "pending" && (
                        <Button
                          size="sm"
                          onClick={() => approveMutation.mutate(order.id)}
                          disabled={approveMutation.isPending}
                          className="bg-green-600 hover:bg-green-700 text-white"
                          data-testid={`button-approve-${order.id}`}
                        >
                          {approveMutation.isPending ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <>
                              <Check className="w-3 h-3 mr-1" />
                              Aprovar
                            </>
                          )}
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => deleteMutation.mutate(order.id)}
                        disabled={deleteMutation.isPending}
                        className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                        data-testid={`button-delete-${order.id}`}
                      >
                        {deleteMutation.isPending ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </Button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-400">
                    Nenhuma encomenda registrada ainda.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
