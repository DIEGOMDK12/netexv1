import { CheckCircle, Copy, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

interface DeliveryModalProps {
  open: boolean;
  onClose: () => void;
  content: string;
  themeColor?: string;
  textColor?: string;
}

export function DeliveryModal({ open, onClose, content, themeColor, textColor }: DeliveryModalProps) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const copyContent = async () => {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({
      title: "Copiado!",
      description: "Conteúdo copiado para a área de transferência",
    });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent
        className="max-w-lg w-[95vw] p-0 overflow-hidden"
        style={{ backgroundColor: "#1E1E1E", borderColor: "rgba(255,255,255,0.1)" }}
      >
        <DialogHeader className="p-4 border-b" style={{ borderColor: "rgba(255,255,255,0.1)" }}>
          <div className="flex items-center gap-2">
            <CheckCircle className="w-6 h-6 text-green-500" />
            <DialogTitle style={{ color: textColor || "#FFFFFF" }}>
              Pagamento Confirmado!
            </DialogTitle>
          </div>
        </DialogHeader>

        <div className="p-6 space-y-4">
          <div className="text-center mb-4">
            <div
              className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center"
              style={{ backgroundColor: "rgba(16, 185, 129, 0.2)" }}
            >
              <CheckCircle className="w-10 h-10 text-green-500" />
            </div>
            <h3
              className="text-lg font-semibold mb-1"
              style={{ color: textColor || "#FFFFFF" }}
            >
              Entrega Instantânea
            </h3>
            <p
              className="text-sm opacity-70"
              style={{ color: textColor || "#FFFFFF" }}
            >
              Seu produto digital está pronto!
            </p>
          </div>

          <div
            className="relative p-4 rounded-xl"
            style={{ backgroundColor: "#242424" }}
          >
            <pre
              className="whitespace-pre-wrap break-words text-sm font-mono max-h-60 overflow-y-auto"
              style={{ color: textColor || "#FFFFFF" }}
              data-testid="text-delivered-content"
            >
              {content}
            </pre>
          </div>

          <div className="flex gap-2">
            <Button
              className="flex-1 h-10 font-medium rounded-lg"
              style={{ backgroundColor: themeColor || "#3B82F6", color: "#FFFFFF" }}
              onClick={copyContent}
              data-testid="button-copy-content"
            >
              {copied ? (
                <>
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Copiado!
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 mr-2" />
                  Copiar
                </>
              )}
            </Button>
            <Button
              variant="secondary"
              className="h-10 px-4"
              onClick={onClose}
              data-testid="button-close-delivery"
            >
              Fechar
            </Button>
          </div>

          <p
            className="text-xs text-center opacity-60"
            style={{ color: textColor || "#FFFFFF" }}
          >
            Este conteúdo também foi enviado para o seu e-mail
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
