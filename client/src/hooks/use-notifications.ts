import { useEffect, useRef, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";

interface UseNotificationsOptions {
  vendorId?: number;
  vendorEmail?: string;
  enabled?: boolean;
}

export function useNotifications({ vendorId, vendorEmail, enabled = true }: UseNotificationsOptions) {
  const { toast } = useToast();
  const lastOrderCountRef = useRef<number | null>(null);
  const lastChatCountRef = useRef<number | null>(null);
  const lastSellerChatCountRef = useRef<number | null>(null);

  const checkNotifications = useCallback(async () => {
    if (!enabled) return;

    try {
      if (vendorEmail) {
        const orderRes = await fetch(`/api/orders/unviewed-count?email=${encodeURIComponent(vendorEmail)}`);
        if (orderRes.ok) {
          const orderData = await orderRes.json();
          const currentOrderCount = orderData.count || 0;
          
          if (lastOrderCountRef.current !== null && currentOrderCount > lastOrderCountRef.current) {
            const newOrders = currentOrderCount - lastOrderCountRef.current;
            toast({
              title: "Novo Pedido!",
              description: `Voc\u00EA tem ${newOrders} novo(s) pedido(s) pago(s)`,
              duration: 5000,
            });
            
            if ('vibrate' in navigator) {
              navigator.vibrate([200, 100, 200]);
            }
          }
          lastOrderCountRef.current = currentOrderCount;
        }

        const chatRes = await fetch(`/api/chat/unread-total?email=${encodeURIComponent(vendorEmail)}`);
        if (chatRes.ok) {
          const chatData = await chatRes.json();
          const currentChatCount = chatData.count || 0;
          
          if (lastChatCountRef.current !== null && currentChatCount > lastChatCountRef.current) {
            const newMessages = currentChatCount - lastChatCountRef.current;
            toast({
              title: "Nova Mensagem!",
              description: `Voc\u00EA tem ${newMessages} nova(s) mensagem(ns) nas suas compras`,
              duration: 5000,
            });
          }
          lastChatCountRef.current = currentChatCount;
        }
      }

      if (vendorId) {
        const sellerChatRes = await fetch(`/api/chat/seller-unread-total?resellerId=${vendorId}`);
        if (sellerChatRes.ok) {
          const sellerChatData = await sellerChatRes.json();
          const currentSellerChatCount = sellerChatData.count || 0;
          
          if (lastSellerChatCountRef.current !== null && currentSellerChatCount > lastSellerChatCountRef.current) {
            const newMessages = currentSellerChatCount - lastSellerChatCountRef.current;
            toast({
              title: "Nova Mensagem de Cliente!",
              description: `Voc\u00EA tem ${newMessages} nova(s) mensagem(ns) de clientes`,
              duration: 5000,
            });
          }
          lastSellerChatCountRef.current = currentSellerChatCount;
        }
      }
    } catch (error) {
      console.error("[Notifications] Error checking notifications:", error);
    }
  }, [vendorId, vendorEmail, enabled, toast]);

  useEffect(() => {
    if (!enabled) return;

    checkNotifications();

    const interval = setInterval(checkNotifications, 10000);

    return () => clearInterval(interval);
  }, [checkNotifications, enabled]);

  return { checkNotifications };
}
