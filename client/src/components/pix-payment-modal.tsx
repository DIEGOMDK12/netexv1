import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Copy, Check, AlertCircle } from "lucide-react";
import { useState } from "react";
import { apiRequest } from "@/lib/queryClient";

interface PixPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  productName: string;
  productPrice: number;
  restorerName: string;
  pixKey: string;
  productId: number;
  resellerId: number;
}

export function PixPaymentModal({
  isOpen,
  onClose,
  productName,
  productPrice,
  restorerName,
  pixKey,
  productId,
  resellerId,
}: PixPaymentModalProps) {
  const [copied, setCopied] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentData, setPaymentData] = useState<any>(null);
  const [error, setError] = useState("");

  const handleCopyCode = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePaymentConfirmed = async () => {
    // PIX manual mode - no external API calls
    // Just show the pixKey that was already passed
    console.log("[PixPaymentModal] Payment confirmed with manual PIX mode");
    // Payment confirmation is handled by showing the PIX key to user
    // They manually transfer the money
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-gray-900 border border-gray-700 max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-white">
            {paymentData ? "Opções de Pagamento" : "Gerar Pagamento"}
          </DialogTitle>
          <DialogDescription className="text-gray-400">
            {paymentData
              ? "Escolha como deseja pagar"
              : "Complete seu pedido via PagHiper"}
          </DialogDescription>
        </DialogHeader>

        {!paymentData ? (
          <div className="space-y-6">
            {/* Product Info */}
            <div className="bg-black/40 p-4 rounded-lg border border-gray-700 space-y-2">
              <p className="text-sm text-gray-400">Produto</p>
              <p className="text-lg font-semibold text-white">{productName}</p>
              <p className="text-xs text-gray-500">Vendedor: {restorerName}</p>
            </div>

            {/* Price */}
            <div className="bg-black/40 p-4 rounded-lg border border-gray-700 space-y-2">
              <p className="text-sm text-gray-400">Valor a pagar</p>
              <p className="text-3xl font-bold text-green-400">
                R$ {productPrice.toFixed(2)}
              </p>
            </div>

            {error && (
              <div className="bg-red-900/30 p-3 rounded-lg border border-red-700 flex gap-2">
                <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-300">{error}</p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-2">
              <Button
                onClick={onClose}
                disabled={isProcessing}
                className="flex-1 bg-gray-800 hover:bg-gray-700 text-white"
              >
                Cancelar
              </Button>
              <Button
                onClick={handlePaymentConfirmed}
                disabled={isProcessing || !!error}
                style={{
                  background: "linear-gradient(135deg, #3b82f6 0%, #8b5cf6 50%, #ec4899 100%)",
                  color: "#FFFFFF",
                  opacity: isProcessing ? 0.7 : 1,
                }}
                className="flex-1"
              >
                {isProcessing ? "Gerando..." : "Gerar Pagamento"}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* PIX */}
            {paymentData.pixCode && (
              <div className="bg-green-900/20 p-4 rounded-lg border border-green-600 space-y-3">
                <p className="text-sm font-semibold text-green-300">PIX Copia e Cola</p>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={paymentData.pixCode}
                    className="flex-1 bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white text-xs font-mono"
                  />
                  <Button
                    size="sm"
                    onClick={() => handleCopyCode(paymentData.pixCode)}
                    style={{
                      background: copied
                        ? "linear-gradient(135deg, #10b981 0%, #059669 100%)"
                        : "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                      color: "#FFFFFF",
                    }}
                  >
                    {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </Button>
                </div>
                {paymentData.qrCode && (
                  <div className="text-center">
                    <img
                      src={paymentData.qrCode}
                      alt="QR Code PIX"
                      className="w-40 h-40 mx-auto"
                    />
                  </div>
                )}
              </div>
            )}

            <div className="bg-gray-800/50 p-3 rounded-lg text-center">
              <p className="text-xs text-gray-400">Pedido será confirmado após o pagamento</p>
            </div>

            <Button
              onClick={onClose}
              variant="outline"
              className="w-full"
            >
              Fechar
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
