import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Check, MessageCircle, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useState } from "react";
import type { Order } from "@shared/schema";

export function VendorOrdersEnhanced({ vendorId }: { vendorId: number }) {
  const { toast } = useToast();
  const [approvingId, setApprovingId] = useState<number | null>(null);

  const { data: orders = [], isLoading, refetch } = useQuery<any[]>({
    queryKey: ["/api/vendor/orders", vendorId],
    queryFn: async () => {
      console.log("[VendorOrdersEnhanced] Fetching orders for vendorId:", vendorId);
      const response = await fetch(`/api/vendor/orders?vendorId=${vendorId}`);
      if (!response.ok) throw new Error("Failed to fetch orders");
      const data = await response.json();
      console.log("[VendorOrdersEnhanced] ✅ Received", data.length, "orders");
      if (data.length > 0) {
        console.log("[VendorOrdersEnhanced] First order product:", data[0].items?.[0]?.product?.name);
      }
      return data;
    },
    refetchInterval: 10000, // Polling a cada 10s
  });

  const handleApprovePayment = async (orderId: number) => {
    setApprovingId(orderId);
    try {
      const response = await apiRequest("POST", `/api/vendor/orders/${orderId}/approve`, {});
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Erro ao aprovar pedido");
      }
      
      const data = await response.json();
      
      // Encontrar o pedido para abrir WhatsApp automaticamente
      const order = orders.find((o: any) => o.id === orderId);
      
      toast({
        title: "Pedido Aprovado!",
        description: "Abrindo WhatsApp para enviar o produto ao cliente...",
      });

      // Atualizar a lista de pedidos
      refetch();
      queryClient.invalidateQueries({ queryKey: ["/api/vendor/orders", vendorId] });
      
      // Invalidate stats so dashboard updates immediately with new revenue
      queryClient.invalidateQueries({ queryKey: ["/api/vendor/stats"] });
      
      // Abrir WhatsApp automaticamente com o produto entregue
      if (order?.whatsapp && data.deliveredContent) {
        const phone = order.whatsapp.replace(/\D/g, "");
        const formattedPhone = phone.startsWith("55") ? phone : `55${phone}`;
        const contentLines = data.deliveredContent.split("\n").filter((l: string) => l.trim()).slice(0, 5);
        const contentPreview = contentLines.join("\n");
        
        const message = encodeURIComponent(
          `Ola! Seu pedido #${orderId} foi aprovado!\n\nSeu produto:\n${contentPreview}\n\nObrigado pela compra!`
        );
        
        // Pequeno delay para garantir que o toast apareça
        setTimeout(() => {
          window.open(`https://wa.me/+${formattedPhone}?text=${message}`, "_blank");
        }, 500);
      }
    } catch (error: any) {
      console.error("[Approve Payment] Error:", error);
      toast({
        title: "Erro ao aprovar",
        description: error.message || "Tente novamente",
        variant: "destructive",
      });
    } finally {
      setApprovingId(null);
    }
  };

  const handleOpenWhatsApp = (order: Order) => {
    const phone = order.whatsapp?.replace(/\D/g, "") || "";
    const formattedPhone = phone.startsWith("55") ? phone : `55${phone}`;
    const contentLines = order.deliveredContent?.split("\n").filter(l => l.trim()).slice(0, 5) || [];
    const contentPreview = contentLines.join("\n");
    
    const message = encodeURIComponent(
      `Ola! Seu pedido #${order.id} foi aprovado!\n\nSeu produto:\n${contentPreview || "(Conteudo disponivel)"}\n\nObrigado pela compra!`
    );
    window.open(`https://wa.me/+${formattedPhone}?text=${message}`, "_blank");
  };

  const handleDeleteOrder = async (orderId: number) => {
    console.log("\n█████████████████████████████████████████");
    console.log("[DELETE ORDER] ===== INICIANDO DELETE =====");
    console.log("█████████████████████████████████████████");
    
    // Recuperar token EXPLICITAMENTE
    const vendorToken = localStorage.getItem("vendor_token");
    console.log("[DELETE ORDER] Token recuperado?", !!vendorToken);
    if (vendorToken) {
      console.log("[DELETE ORDER] Token preview:", vendorToken.substring(0, 30) + "...");
    }
    
    if (!vendorToken) {
      console.error("[DELETE ORDER] ❌ TOKEN NÃO ENCONTRADO");
      toast({
        title: "Erro de Autenticação",
        description: "Token não encontrado. Faça login novamente.",
        variant: "destructive",
      });
      window.location.href = "/login";
      return;
    }
    
    if (!orderId || isNaN(orderId)) {
      toast({
        title: "Erro",
        description: "ID do pedido inválido",
        variant: "destructive",
      });
      return;
    }
    
    if (!window.confirm(`Tem certeza que deseja excluir o pedido #${orderId}? Esta ação não pode ser desfeita.`)) {
      return;
    }

    try {
      const url = `/api/orders/${orderId}`;
      console.log("[DELETE ORDER] URL:", url);
      console.log("[DELETE ORDER] Método: DELETE");
      console.log("[DELETE ORDER] Headers que serão ENVIADOS:");
      console.log("[DELETE ORDER]   Content-Type: application/json");
      console.log("[DELETE ORDER]   Authorization: Bearer [" + vendorToken.substring(0, 20) + "...]");
      
      // FETCH DIRETO - SEM apiRequest()
      const response = await fetch(url, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${vendorToken}`
        },
        credentials: "include"
      });
      
      console.log("[DELETE ORDER] Response status:", response.status);
      console.log("[DELETE ORDER] Response OK:", response.ok);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error("[DELETE ORDER] ❌ Erro na resposta:", errorText);
        
        let errorMessage = "Erro ao excluir pedido";
        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.error || errorMessage;
        } catch (e) {
          errorMessage = `Erro ${response.status}: ${errorText}`;
        }
        
        throw new Error(errorMessage);
      }

      const successData = await response.json();
      console.log("[DELETE ORDER] ✓ Sucesso:", successData);
      console.log("█████████████████████████████████████████");
      console.log("[DELETE ORDER] ===== DELETADO COM SUCESSO =====");
      console.log("█████████████████████████████████████████\n");

      toast({
        title: "✅ Pedido Excluído",
        description: "O pedido foi removido com sucesso.",
      });

      refetch();
      queryClient.invalidateQueries({ queryKey: ["/api/vendor/orders", vendorId] });
    } catch (error: any) {
      console.error("[DELETE ORDER] ❌ ERRO COMPLETO:", error);
      console.log("█████████████████████████████████████████");
      console.log("[DELETE ORDER] ===== ERRO =====");
      console.log("█████████████████████████████████████████\n");
      toast({
        title: "Erro ao excluir",
        description: error.message || "Tente novamente",
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-white">Pedidos</h1>

      {orders.length === 0 ? (
        <Card
          style={{
            background: "rgba(30, 30, 30, 0.4)",
            backdropFilter: "blur(12px)",
            border: "1px solid rgba(255, 255, 255, 0.1)",
          }}
        >
          <CardContent className="py-12 text-center">
            <p className="text-gray-400 mb-2">Nenhum pedido registrado ainda</p>
            <p className="text-xs text-gray-500">
              Seus pedidos aparecerão aqui quando clientes comprarem seus produtos
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => (
            <Card
              key={order.id}
              style={{
                background: "rgba(30, 30, 30, 0.4)",
                backdropFilter: "blur(12px)",
                border: `1px solid ${order.status === "pending" ? "rgba(234, 179, 8, 0.3)" : "rgba(34, 197, 94, 0.3)"}`,
              }}
            >
              <CardContent className="pt-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Informações do Pedido */}
                  <div className="space-y-3">
                    <div>
                      <p className="text-xs text-gray-500">Pedido</p>
                      <p className="text-white font-bold">#{order.id}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Valor</p>
                      <p className="text-green-400 font-bold">R$ {parseFloat(order.totalAmount as any).toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Data</p>
                      <p className="text-gray-300 text-sm">{new Date(order.createdAt as any).toLocaleDateString("pt-BR")}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Produto</p>
                      <p className="text-gray-300 text-sm" data-testid={`product-name-${order.id}`}>
                        {(() => {
                          console.log(`🟢 Rendering Order ${order.id}:`, {
                            hasItems: !!order.items,
                            itemsLength: order.items?.length,
                            firstItem: order.items?.[0] ? {
                              productId: order.items[0].productId,
                              productName: order.items[0].productName,
                              hasProduct: !!order.items[0].product,
                              productObjectName: order.items[0].product?.name,
                              productObjectFull: order.items[0].product
                            } : null
                          });
                          
                          const result = order.items && order.items.length > 0
                            ? order.items.map((item: any) => {
                                const name = item.product?.name || item.productName || "Desconhecido";
                                console.log(`🟢 Item ${item.productId}: final name = "${name}"`);
                                return name;
                              }).join(", ")
                            : "Sem produto";
                          
                          console.log(`🟢 Order ${order.id} final display: "${result}"`);
                          return result;
                        })()}
                      </p>
                    </div>
                    <div>
                      <Badge
                        variant={order.status === "paid" ? "default" : "secondary"}
                        className="text-xs"
                      >
                        {order.status === "paid" ? "✅ Aprovado" : "⏳ Pendente"}
                      </Badge>
                    </div>
                  </div>

                  {/* Dados do Cliente */}
                  <div className="space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-xs text-gray-500">E-mail do Cliente</p>
                        <p className="text-white break-all text-sm">{order.email}</p>
                      </div>
                      <Button
                        onClick={() => handleDeleteOrder(order.id!)}
                        size="sm"
                        variant="ghost"
                        className="text-red-500 hover:bg-red-500/10"
                        data-testid={`button-delete-order-${order.id}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                    {order.whatsapp && (
                      <div>
                        <p className="text-xs text-gray-500">WhatsApp do Cliente</p>
                        <a
                          href={`https://wa.me/${order.whatsapp?.replace(/\D/g, "")}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-400 hover:underline text-sm"
                          data-testid={`link-whatsapp-${order.id}`}
                        >
                          {order.whatsapp}
                        </a>
                      </div>
                    )}
                    {order.status === "pending" && (
                      <Button
                        onClick={() => handleApprovePayment(order.id!)}
                        disabled={approvingId === order.id}
                        className="w-full bg-green-600 hover:bg-green-700 text-white text-sm"
                        data-testid={`button-approve-order-${order.id}`}
                      >
                        {approvingId === order.id ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Aprovando Pagamento...
                          </>
                        ) : (
                          <>
                            <Check className="w-4 h-4 mr-2" />
                            ✅ Aprovar Pagamento
                          </>
                        )}
                      </Button>
                    )}
                    {order.status === "paid" && order.whatsapp && (
                      <div className="space-y-2">
                        <div className="p-2 bg-green-500/20 rounded-md border border-green-500/30">
                          <p className="text-xs text-green-400 font-medium text-center">
                            Produto pronto para entrega!
                          </p>
                        </div>
                        <Button
                          onClick={() => handleOpenWhatsApp(order)}
                          className="w-full bg-green-600 hover:bg-green-700 text-white text-sm animate-pulse"
                          data-testid={`button-whatsapp-order-${order.id}`}
                        >
                          <MessageCircle className="w-4 h-4 mr-2" />
                          Enviar Produto no WhatsApp
                        </Button>
                      </div>
                    )}
                    {order.status === "paid" && !order.whatsapp && (
                      <div className="p-2 bg-yellow-500/20 rounded-md border border-yellow-500/30">
                        <p className="text-xs text-yellow-400">
                          Cliente nao informou WhatsApp. Produto entregue via email.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
