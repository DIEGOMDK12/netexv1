import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import type { Order } from "@shared/schema";

interface VendorOrdersProps {
  vendorId?: number;
}

export function VendorOrders({ vendorId }: VendorOrdersProps) {
  const [orders, setOrders] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchOrders = async () => {
      console.log("[VendorOrders] useEffect triggered with vendorId:", vendorId);
      
      if (!vendorId) {
        console.log("[VendorOrders] ❌ No vendorId provided");
        setIsLoading(false);
        return;
      }

      try {
        const url = `/api/vendor/orders?vendorId=${vendorId}`;
        console.log("[VendorOrders] 📡 Fetching from:", url);
        
        const response = await fetch(url);
        console.log("[VendorOrders] Response status:", response.status);
        
        if (response.ok) {
          const data = await response.json();
          console.log("[VendorOrders] ✅ Orders fetched:", data.length, "orders");
          
          if (data.length > 0) {
            console.log("[VendorOrders] First order details:", {
              id: data[0].id,
              itemsCount: data[0].items?.length,
              firstItem: data[0].items?.[0] ? {
                productId: data[0].items[0].productId,
                productName: data[0].items[0].productName,
                hasProductObject: !!data[0].items[0].product,
                productNameFromObject: data[0].items[0].product?.name
              } : null
            });
          }
          
          setOrders(data);
        } else {
          console.error("[VendorOrders] ❌ Failed to fetch:", response.status);
        }
      } catch (error) {
        console.error("[VendorOrders] ❌ Error:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchOrders();
  }, [vendorId]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-8 h-8 animate-spin text-teal-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-white">Pedidos</h1>

      <Card
        style={{
          background: "rgba(30, 30, 30, 0.4)",
          backdropFilter: "blur(12px)",
          border: "1px solid rgba(255, 255, 255, 0.1)",
        }}
      >
        <CardHeader>
          <CardTitle className="text-white">Histórico de Pedidos</CardTitle>
        </CardHeader>
        <CardContent>
          {orders.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-400 mb-2">Nenhum pedido registrado ainda</p>
              <p className="text-xs text-gray-500">
                Seus pedidos aparecerão aqui quando clientes comprarem seus produtos
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left py-3 text-gray-400">ID Pedido</th>
                    <th className="text-left py-3 text-gray-400">Email</th>
                    <th className="text-left py-3 text-gray-400">Produto</th>
                    <th className="text-left py-3 text-gray-400">Valor</th>
                    <th className="text-left py-3 text-gray-400">Status</th>
                    <th className="text-left py-3 text-gray-400">Data</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order) => {
                    const productNames = order.items && order.items.length > 0
                      ? order.items.map((item: any) => {
                          const name = item.product?.name || item.productName || "Produto desconhecido";
                          console.log(`[Order ${order.id}] Item ${item.productId}: name from product object = "${item.product?.name}", name from item.productName = "${item.productName}", final = "${name}"`);
                          return name;
                        }).join(", ")
                      : "Sem itens";
                    
                    return (
                    <tr key={order.id} className="border-b border-white/5 hover:bg-white/5">
                      <td className="py-3 text-white">#{order.id}</td>
                      <td className="py-3 text-gray-400">{order.email}</td>
                      <td className="py-3 text-gray-400" data-testid={`product-name-${order.id}`}>
                        {productNames}
                      </td>
                      <td className="py-3 text-green-400">R$ {parseFloat(order.totalAmount || "0").toFixed(2)}</td>
                      <td className="py-3">
                        <Badge
                          variant={order.status === "paid" ? "default" : "secondary"}
                          data-testid={`badge-order-status-${order.id}`}
                        >
                          {order.status === "paid" ? "Pago" : "Pendente"}
                        </Badge>
                      </td>
                      <td className="py-3 text-gray-400">
                        {order.createdAt ? new Date(order.createdAt).toLocaleDateString("pt-BR") : "-"}
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
    </div>
  );
}
