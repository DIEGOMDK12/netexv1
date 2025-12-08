import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useLocation } from "wouter";
import { Loader2, Copy, CheckCircle, Gift, Mail, MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

interface RedeemItem {
  id: number;
  productName: string;
  secretContent: string;
}

export default function MyOrders() {
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [copied, setCopied] = useState<number | null>(null);
  const [redeemDialogOpen, setRedeemDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<RedeemItem | null>(null);
  const [resendingOrderId, setResendingOrderId] = useState<number | null>(null);
  const { toast } = useToast();

  const resendEmailMutation = useMutation({
    mutationFn: async (orderId: number) => {
      const response = await apiRequest("POST", `/api/orders/${orderId}/resend-email`, { email });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "E-mail reenviado!",
        description: "Verifique sua caixa de entrada e spam",
      });
      setResendingOrderId(null);
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao reenviar e-mail",
        description: error.message || "Tente novamente mais tarde",
        variant: "destructive",
      });
      setResendingOrderId(null);
    },
  });

  const handleResendEmail = (orderId: number) => {
    setResendingOrderId(orderId);
    resendEmailMutation.mutate(orderId);
  };

  const { data: orders, isLoading } = useQuery({
    queryKey: ["/api/orders/by-email", email],
    queryFn: async () => {
      const response = await fetch(`/api/orders/by-email?email=${encodeURIComponent(email)}`);
      if (!response.ok) throw new Error("Failed to fetch orders");
      return response.json();
    },
    enabled: submitted && !!email,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email.trim()) {
      setSubmitted(true);
    }
  };

  const openRedeemDialog = (item: RedeemItem) => {
    setSelectedItem(item);
    setRedeemDialogOpen(true);
  };

  const copyContent = async (content: string, itemId: number) => {
    await navigator.clipboard.writeText(content);
    setCopied(itemId);
    setTimeout(() => setCopied(null), 2000);
    toast({
      title: "Copiado!",
      description: "Dados de acesso copiados para a área de transferência",
    });
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#121212" }}>
      <header
        className="sticky top-0 z-50 h-16 flex items-center px-4 border-b"
        style={{ backgroundColor: "#1A1A1A", borderColor: "rgba(255,255,255,0.1)" }}
      >
        <h1 className="text-lg font-bold text-white">Meus Pedidos</h1>
      </header>

      <main className="max-w-2xl mx-auto p-4">
        {!submitted ? (
          <Card style={{ backgroundColor: "#1E1E1E", borderColor: "rgba(255,255,255,0.1)" }}>
            <CardHeader>
              <CardTitle className="text-white">Verificar Pedidos</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <label className="block text-sm text-gray-300">E-mail cadastrado na compra</label>
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="seu@email.com"
                    required
                    style={{
                      backgroundColor: "#242424",
                      borderColor: "rgba(255,255,255,0.1)",
                      color: "#FFFFFF",
                    }}
                    data-testid="input-search-email"
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full"
                  style={{ backgroundColor: "#3B82F6", color: "#FFFFFF" }}
                  data-testid="button-search-orders"
                >
                  Buscar Pedidos
                </Button>
              </form>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            <Button
              variant="outline"
              onClick={() => {
                setSubmitted(false);
                setEmail("");
              }}
              className="mb-4"
              data-testid="button-back-search"
            >
              Voltar
            </Button>

            {isLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
              </div>
            ) : !orders || orders.length === 0 ? (
              <Card style={{ backgroundColor: "#1E1E1E", borderColor: "rgba(255,255,255,0.1)" }}>
                <CardContent className="py-12 text-center text-gray-400">
                  Nenhum pedido encontrado com este e-mail
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {orders.map((order: any) => (
                  <Card
                    key={order.id}
                    style={{ backgroundColor: "#1E1E1E", borderColor: "rgba(255,255,255,0.1)" }}
                    data-testid={`order-card-${order.id}`}
                  >
                    <CardHeader>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <CardTitle className="text-white">Pedido #{order.id}</CardTitle>
                          <p className="text-sm text-gray-400 mt-1">
                            {new Date(order.createdAt).toLocaleDateString("pt-BR", {
                              day: "2-digit",
                              month: "2-digit",
                              year: "numeric",
                            })}
                          </p>
                        </div>
                        <span
                          className={`text-xs px-3 py-1 rounded font-semibold ${
                            order.status === "paid"
                              ? "bg-green-500/20 text-green-400"
                              : "bg-yellow-500/20 text-yellow-400"
                          }`}
                        >
                          {order.status === "paid" ? "Pago" : "Pendente"}
                        </span>
                      </div>
                    </CardHeader>

                    <CardContent className="space-y-4">
                      <div className="text-sm text-gray-300">
                        <p className="font-semibold text-white mb-2">Produtos:</p>
                        {order.items?.map((item: any) => (
                          <div key={item.id} className="py-3 border-b border-gray-700 last:border-b-0">
                            <div className="flex items-center justify-between gap-2 mb-2">
                              <div className="flex-1">
                                <p className="text-gray-300 font-medium">{item.productName}</p>
                                <p className="text-xs text-gray-500">Qtd: {item.quantity}</p>
                              </div>
                              {order.status === "paid" && item.secretContent && (
                                <div className="flex items-center gap-2 flex-wrap">
                                  <Button
                                    size="sm"
                                    onClick={() => copyContent(item.secretContent, item.id)}
                                    style={{ backgroundColor: "#3B82F6", color: "#FFFFFF" }}
                                    data-testid={`button-copy-${item.id}`}
                                  >
                                    {copied === item.id ? (
                                      <>
                                        <CheckCircle className="w-3 h-3 mr-1" />
                                        Copiado!
                                      </>
                                    ) : (
                                      <>
                                        <Copy className="w-3 h-3 mr-1" />
                                        Copiar
                                      </>
                                    )}
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => openRedeemDialog({
                                      id: item.id,
                                      productName: item.productName,
                                      secretContent: item.secretContent,
                                    })}
                                    className="border-green-500/50 text-green-400"
                                    data-testid={`button-redeem-${item.id}`}
                                  >
                                    <Gift className="w-3 h-3 mr-1" />
                                    Ver
                                  </Button>
                                </div>
                              )}
                            </div>
                            {order.status === "paid" && item.secretContent && (
                              <div className="bg-zinc-900/50 p-3 rounded-md border border-gray-700 mt-2">
                                <p className="text-xs text-gray-400 mb-1">Conteudo entregue:</p>
                                <p 
                                  className="text-white text-sm font-mono break-all whitespace-pre-wrap select-all cursor-text"
                                  data-testid={`text-secret-content-${item.id}`}
                                >
                                  {item.secretContent}
                                </p>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>

                      <div className="border-t border-gray-700 pt-3">
                        <p className="text-lg font-bold text-blue-400">
                          Total: R$ {Number(order.totalAmount).toFixed(2)}
                        </p>
                      </div>

                      {order.status !== "paid" && (
                        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
                          <p className="text-yellow-400 text-sm">
                            Aguardando aprovacao para liberar acesso
                          </p>
                        </div>
                      )}

                      {order.status === "paid" && order.items?.some((item: any) => item.secretContent) && (
                        <div className="border-t border-gray-700 pt-3 mt-3">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleResendEmail(order.id)}
                            disabled={resendingOrderId === order.id}
                            className="w-full border-blue-500/50 text-blue-400"
                            data-testid={`button-resend-email-${order.id}`}
                          >
                            {resendingOrderId === order.id ? (
                              <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Reenviando...
                              </>
                            ) : (
                              <>
                                <Mail className="w-4 h-4 mr-2" />
                                Reenviar E-mail de Entrega
                              </>
                            )}
                          </Button>
                          <p className="text-xs text-gray-500 text-center mt-2">
                            Nao recebeu o e-mail? Clique para reenviar
                          </p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      <Dialog open={redeemDialogOpen} onOpenChange={setRedeemDialogOpen}>
        <DialogContent style={{ backgroundColor: "#1E1E1E", borderColor: "rgba(255,255,255,0.2)" }}>
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Gift className="w-5 h-5 text-green-400" />
              Resgatar Produto
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
                  className="text-white text-sm whitespace-pre-wrap font-mono break-words"
                  data-testid={`dialog-secret-content-${selectedItem.id}`}
                >
                  {selectedItem.secretContent}
                </p>
              </div>
              
              <Button
                className="w-full"
                onClick={() => copyContent(selectedItem.secretContent, selectedItem.id)}
                style={{ backgroundColor: "#3B82F6", color: "#FFFFFF" }}
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
