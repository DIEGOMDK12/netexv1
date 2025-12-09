import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Copy, CheckCircle, Gift, Package, ShoppingBag, Calendar, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { OrderChat } from "@/components/OrderChat";

interface OrderItem {
  id: number;
  productName: string;
  quantity: number;
  unitPrice: string;
  secretContent: string | null;
  productImageUrl?: string | null;
}

interface Order {
  id: number;
  status: string;
  totalAmount: string;
  createdAt: string;
  items: OrderItem[];
}

interface VendorMyPurchasesProps {
  vendorEmail: string;
}

export function VendorMyPurchases({ vendorEmail }: VendorMyPurchasesProps) {
  const [copied, setCopied] = useState<number | null>(null);
  const [selectedItem, setSelectedItem] = useState<OrderItem | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const { toast } = useToast();

  const { data: orders = [], isLoading } = useQuery<Order[]>({
    queryKey: ["/api/orders/by-email", vendorEmail],
    queryFn: async () => {
      const response = await fetch(`/api/orders/by-email?email=${encodeURIComponent(vendorEmail)}`);
      if (!response.ok) throw new Error("Falha ao carregar pedidos");
      return response.json();
    },
    enabled: !!vendorEmail,
  });

  useEffect(() => {
    if (vendorEmail && orders.length > 0) {
      fetch("/api/orders/mark-viewed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: vendorEmail }),
      }).then(() => {
        queryClient.invalidateQueries({ queryKey: ["/api/orders/unviewed-count", vendorEmail] });
      }).catch(console.error);
    }
  }, [vendorEmail, orders.length]);

  const copyContent = async (content: string, itemId: number) => {
    await navigator.clipboard.writeText(content);
    setCopied(itemId);
    setTimeout(() => setCopied(null), 2000);
    toast({
      title: "Copiado!",
      description: "Dados de acesso copiados para a area de transferencia",
    });
  };

  const openAccessDialog = (item: OrderItem) => {
    setSelectedItem(item);
    setDialogOpen(true);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "paid":
        return <Badge className="bg-green-500/20 text-green-400 border-green-500/30">Pago</Badge>;
      case "pending":
        return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">Pendente</Badge>;
      case "cancelled":
        return <Badge className="bg-red-500/20 text-red-400 border-red-500/30">Cancelado</Badge>;
      default:
        return <Badge className="bg-gray-500/20 text-gray-400 border-gray-500/30">{status}</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20 md:pb-6">
      <div className="flex items-center gap-3">
        <ShoppingBag className="w-6 h-6 text-blue-500" />
        <h1 className="text-2xl font-bold text-white">Minhas Compras</h1>
      </div>

      <p className="text-gray-400 text-sm">
        Aqui voce encontra todos os produtos que voce comprou no marketplace.
      </p>

      {orders.length === 0 ? (
        <Card style={{ backgroundColor: "#1E1E1E", borderColor: "rgba(255,255,255,0.1)" }}>
          <CardContent className="py-12 text-center">
            <ShoppingBag className="w-12 h-12 mx-auto mb-4 text-gray-600" />
            <p className="text-gray-400">Voce ainda nao fez nenhuma compra</p>
            <p className="text-gray-500 text-sm mt-2">
              Explore o marketplace e encontre produtos incriveis!
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => (
            <Card 
              key={order.id} 
              style={{ backgroundColor: "#1E1E1E", borderColor: "rgba(255,255,255,0.1)" }}
              data-testid={`purchase-order-${order.id}`}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <CardTitle className="text-white text-lg flex items-center gap-2">
                      Pedido #{order.id}
                    </CardTitle>
                    <div className="flex items-center gap-2 mt-1 text-sm text-gray-400">
                      <Calendar className="w-4 h-4" />
                      {new Date(order.createdAt).toLocaleDateString("pt-BR", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </div>
                  </div>
                  {getStatusBadge(order.status)}
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                {order.items?.map((item) => (
                  <div 
                    key={item.id} 
                    className="flex items-start gap-4 p-3 rounded-lg bg-zinc-900/50 border border-gray-800"
                  >
                    <div className="w-16 h-16 rounded-lg overflow-hidden bg-gray-800 flex-shrink-0">
                      {item.productImageUrl ? (
                        <img 
                          src={item.productImageUrl} 
                          alt={item.productName}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Package className="w-6 h-6 text-gray-600" />
                        </div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <h4 className="text-white font-medium truncate" data-testid={`purchase-item-name-${item.id}`}>
                        {item.productName}
                      </h4>
                      <p className="text-sm text-gray-400">Qtd: {item.quantity}</p>
                      <p className="text-sm text-blue-400 font-semibold">
                        R$ {Number(item.unitPrice).toFixed(2)}
                      </p>
                    </div>

                    {order.status === "paid" && item.secretContent && (
                      <Button
                        size="sm"
                        onClick={() => openAccessDialog(item)}
                        className="bg-green-600/20 text-green-400 border border-green-500/30 flex-shrink-0"
                        data-testid={`button-view-access-${item.id}`}
                      >
                        <Eye className="w-4 h-4 mr-1" />
                        Ver Acesso
                      </Button>
                    )}
                  </div>
                ))}

                <div className="flex items-center justify-between pt-3 border-t border-gray-700 flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-gray-400">Total:</span>
                    <span className="text-lg font-bold text-blue-400">
                      R$ {Number(order.totalAmount).toFixed(2)}
                    </span>
                  </div>
                  {order.status === "paid" && (
                    <OrderChat
                      orderId={order.id}
                      buyerEmail={vendorEmail}
                      buyerName={vendorEmail.split("@")[0]}
                    />
                  )}
                </div>

                {order.status === "pending" && (
                  <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3">
                    <p className="text-yellow-400 text-sm">
                      Aguardando confirmacao do pagamento para liberar o acesso
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent style={{ backgroundColor: "#1E1E1E", borderColor: "rgba(255,255,255,0.2)" }}>
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Gift className="w-5 h-5 text-green-400" />
              Dados de Acesso
            </DialogTitle>
            <DialogDescription className="text-gray-400">
              {selectedItem?.productName}
            </DialogDescription>
          </DialogHeader>

          {selectedItem && (
            <div className="space-y-4 mt-4">
              <div className="bg-zinc-900 p-4 rounded-lg border border-gray-700">
                <p className="text-xs text-gray-400 mb-2">Seus dados de acesso:</p>
                <p 
                  className="text-white text-sm whitespace-pre-wrap font-mono break-words select-all"
                  data-testid={`dialog-access-content-${selectedItem.id}`}
                >
                  {selectedItem.secretContent}
                </p>
              </div>

              <Button
                className="w-full bg-blue-600"
                onClick={() => selectedItem.secretContent && copyContent(selectedItem.secretContent, selectedItem.id)}
                data-testid={`button-dialog-copy-${selectedItem.id}`}
              >
                {copied === selectedItem.id ? (
                  <>
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Copiado!
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 mr-2" />
                    Copiar para Area de Transferencia
                  </>
                )}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
