import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  MessageCircle,
  Send,
  Paperclip,
  Image,
  X,
  Loader2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ChatMessage {
  id: number;
  orderId: number;
  senderId: string;
  senderType: string;
  senderName: string | null;
  message: string | null;
  attachmentUrl: string | null;
  attachmentType: string | null;
  read: boolean;
  createdAt: string;
}

interface OrderChatProps {
  orderId: number;
  buyerEmail: string;
  buyerName?: string;
}

export function OrderChat({ orderId, buyerEmail, buyerName }: OrderChatProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const { data: messages = [], isLoading } = useQuery<ChatMessage[]>({
    queryKey: ["/api/chat", orderId],
    queryFn: async () => {
      const response = await fetch(`/api/chat/${orderId}`);
      if (!response.ok) throw new Error("Falha ao carregar mensagens");
      return response.json();
    },
    enabled: isOpen,
    refetchInterval: isOpen ? 5000 : false,
  });

  const { data: unreadCount = 0 } = useQuery<number>({
    queryKey: ["/api/chat/unread", orderId, "buyer"],
    queryFn: async () => {
      const response = await fetch(`/api/chat/${orderId}/unread?for=buyer`);
      if (!response.ok) return 0;
      const data = await response.json();
      return data.count || 0;
    },
    refetchInterval: 30000,
  });

  const sendMessageMutation = useMutation({
    mutationFn: async (data: { message?: string; file?: File }) => {
      if (data.file) {
        const formData = new FormData();
        formData.append("attachment", data.file);
        formData.append("senderId", buyerEmail);
        formData.append("senderType", "buyer");
        formData.append("senderName", buyerName || buyerEmail);
        if (data.message) {
          formData.append("message", data.message);
        }

        const response = await fetch(`/api/chat/${orderId}/attachment`, {
          method: "POST",
          body: formData,
        });

        if (!response.ok) throw new Error("Falha ao enviar anexo");
        return response.json();
      } else {
        return apiRequest("POST", `/api/chat/${orderId}`, {
          senderId: buyerEmail,
          senderType: "buyer",
          senderName: buyerName || buyerEmail,
          message: data.message,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/chat", orderId] });
      setMessage("");
      setSelectedFile(null);
      setPreviewUrl(null);
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Falha ao enviar mensagem",
        variant: "destructive",
      });
    },
  });

  const markAsReadMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", `/api/chat/${orderId}/read`, {
        senderType: "buyer",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/chat/unread", orderId, "buyer"],
      });
    },
  });

  useEffect(() => {
    if (isOpen && messages.length > 0) {
      markAsReadMutation.mutate();
    }
  }, [isOpen, messages.length]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        toast({
          title: "Arquivo muito grande",
          description: "O tamanho maximo permitido e 10MB",
          variant: "destructive",
        });
        return;
      }

      setSelectedFile(file);
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
    }
  };

  const handleSend = () => {
    if (!message.trim() && !selectedFile) return;

    sendMessageMutation.mutate({
      message: message.trim() || undefined,
      file: selectedFile || undefined,
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const clearFile = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        onClick={() => setIsOpen(true)}
        className="relative bg-transparent border-blue-500/30 text-blue-400"
        data-testid={`button-chat-${orderId}`}
      >
        <MessageCircle className="w-4 h-4 mr-1" />
        Suporte
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
            {unreadCount}
          </span>
        )}
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent
          className="max-w-md h-[500px] flex flex-col p-0"
          style={{
            backgroundColor: "#1E1E1E",
            borderColor: "rgba(255,255,255,0.2)",
          }}
        >
          <DialogHeader className="p-4 border-b border-gray-700">
            <DialogTitle className="text-white flex items-center gap-2">
              <MessageCircle className="w-5 h-5 text-blue-400" />
              Chat - Pedido #{orderId}
            </DialogTitle>
          </DialogHeader>

          <ScrollArea
            className="flex-1 p-4"
            ref={scrollRef}
          >
            {isLoading ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
              </div>
            ) : messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-400">
                <MessageCircle className="w-12 h-12 mb-2 opacity-50" />
                <p className="text-sm">Nenhuma mensagem ainda</p>
                <p className="text-xs mt-1">
                  Envie uma mensagem para iniciar o chat
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${
                      msg.senderType === "buyer" ? "justify-end" : "justify-start"
                    }`}
                  >
                    <div
                      className={`max-w-[80%] rounded-lg p-3 ${
                        msg.senderType === "buyer"
                          ? "bg-blue-600 text-white"
                          : "bg-zinc-800 text-white"
                      }`}
                    >
                      <p className="text-xs opacity-70 mb-1">
                        {msg.senderType === "buyer" ? "Voce" : msg.senderName || "Vendedor"}
                      </p>
                      {msg.attachmentUrl && (
                        <a
                          href={msg.attachmentUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block mb-2"
                        >
                          {msg.attachmentType?.startsWith("image/") ? (
                            <img
                              src={msg.attachmentUrl}
                              alt="Anexo"
                              className="rounded max-w-full max-h-48 object-contain"
                            />
                          ) : (
                            <div className="flex items-center gap-2 text-sm underline">
                              <Paperclip className="w-4 h-4" />
                              Ver anexo
                            </div>
                          )}
                        </a>
                      )}
                      {msg.message && (
                        <p className="text-sm whitespace-pre-wrap break-words">
                          {msg.message}
                        </p>
                      )}
                      <p className="text-xs opacity-50 mt-1 text-right">
                        {format(new Date(msg.createdAt), "HH:mm", {
                          locale: ptBR,
                        })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>

          {previewUrl && (
            <div className="px-4 py-2 border-t border-gray-700 bg-zinc-900">
              <div className="relative inline-block">
                <img
                  src={previewUrl}
                  alt="Preview"
                  className="h-16 rounded object-cover"
                />
                <Button
                  size="icon"
                  variant="destructive"
                  className="absolute -top-2 -right-2 h-5 w-5 rounded-full"
                  onClick={clearFile}
                >
                  <X className="w-3 h-3" />
                </Button>
              </div>
            </div>
          )}

          <div className="p-4 border-t border-gray-700">
            <div className="flex items-center gap-2">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileSelect}
                accept="image/*"
                className="hidden"
              />
              <Button
                size="icon"
                variant="ghost"
                onClick={() => fileInputRef.current?.click()}
                disabled={sendMessageMutation.isPending}
                data-testid={`button-attach-${orderId}`}
              >
                <Image className="w-5 h-5 text-gray-400" />
              </Button>
              <Input
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Digite sua mensagem..."
                className="flex-1 bg-zinc-800 border-gray-700 text-white"
                disabled={sendMessageMutation.isPending}
                data-testid={`input-chat-message-${orderId}`}
              />
              <Button
                size="icon"
                onClick={handleSend}
                disabled={
                  sendMessageMutation.isPending ||
                  (!message.trim() && !selectedFile)
                }
                data-testid={`button-send-${orderId}`}
              >
                {sendMessageMutation.isPending ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Send className="w-5 h-5" />
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
