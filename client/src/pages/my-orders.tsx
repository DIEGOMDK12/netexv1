import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useLocation } from "wouter";
import { Loader2, Copy, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

export default function MyOrders() {
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [copied, setCopied] = useState<number | null>(null);
  const { toast } = useToast();

  const { data: orders, isLoading } = useQuery({
    queryKey: ["/api/orders/by-email", email],
    enabled: submitted && !!email,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email.trim()) {
      setSubmitted(true);
    }
  };

  const copyContent = async (content: string, orderId: number) => {
    await navigator.clipboard.writeText(content);
    setCopied(orderId);
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
              ← Voltar
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
                      <div className="flex items-start justify-between">
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
                          <p key={item.id} className="text-gray-400">
                            • {item.productName} (Qtd: {item.quantity})
                          </p>
                        ))}
                      </div>

                      <div className="border-t border-gray-700 pt-3">
                        <p className="text-lg font-bold text-blue-400">
                          Total: R$ {Number(order.totalAmount).toFixed(2)}
                        </p>
                      </div>

                      {order.status === "paid" ? (
                        <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
                          <p className="text-green-400 text-sm font-semibold mb-3">✓ Dados de Acesso Liberados:</p>
                          {order.items?.map((item: any) => (
                            <div key={item.id} className="space-y-2 mb-3 last:mb-0">
                              <p className="text-xs text-gray-400">{item.productName}:</p>
                              <div
                                className="bg-zinc-900 p-3 rounded border border-gray-700"
                                data-testid={`secret-content-${item.id}`}
                              >
                                <p className="text-white text-sm whitespace-pre-wrap font-mono break-words">
                                  {item.secretContent || "(Sem dados de acesso configurado)"}
                                </p>
                              </div>
                              {item.secretContent && (
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  onClick={() => copyContent(item.secretContent, item.id)}
                                  className="w-full mt-2"
                                  data-testid={`button-copy-content-${item.id}`}
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
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
                          <p className="text-yellow-400 text-sm">
                            ⏳ Aguardando aprovação para liberar acesso
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
    </div>
  );
}
