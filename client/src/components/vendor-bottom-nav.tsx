import { Home, Package, ShoppingCart, Settings, LogOut, Wallet, ShoppingBag } from "lucide-react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";

interface VendorBottomNavProps {
  vendorEmail?: string;
  vendorId?: number;
  onLogout: () => void;
}

export function VendorBottomNav({ vendorEmail, vendorId, onLogout }: VendorBottomNavProps) {
  const [location] = useLocation();
  const [, setLocation] = useLocation();

  // Get unviewed orders count for buyer (purchases)
  const { data: unviewedData } = useQuery<{ count: number }>({
    queryKey: ["/api/orders/unviewed-count", vendorEmail],
    queryFn: async () => {
      const response = await fetch(`/api/orders/unviewed-count?email=${encodeURIComponent(vendorEmail || "")}`);
      if (!response.ok) return { count: 0 };
      return response.json();
    },
    enabled: !!vendorEmail,
    refetchInterval: 30000,
  });

  // Get unread chat messages count for buyer (purchases)
  const { data: unreadChatData } = useQuery<{ count: number }>({
    queryKey: ["/api/chat/unread-total", vendorEmail],
    queryFn: async () => {
      const response = await fetch(`/api/chat/unread-total?email=${encodeURIComponent(vendorEmail || "")}`);
      if (!response.ok) return { count: 0 };
      return response.json();
    },
    enabled: !!vendorEmail,
    refetchInterval: 10000,
  });

  // Get unread chat messages count for seller (orders from customers)
  const { data: sellerUnreadChatData } = useQuery<{ count: number }>({
    queryKey: ["/api/chat/seller-unread-total", vendorId],
    queryFn: async () => {
      const response = await fetch(`/api/chat/seller-unread-total?resellerId=${vendorId}`);
      if (!response.ok) return { count: 0 };
      return response.json();
    },
    enabled: !!vendorId,
    refetchInterval: 10000,
  });

  const unviewedCount = unviewedData?.count || 0;
  const unreadChatCount = unreadChatData?.count || 0;
  const sellerUnreadChatCount = sellerUnreadChatData?.count || 0;
  const hasPurchasesNotification = unviewedCount > 0 || unreadChatCount > 0;
  const hasOrdersNotification = sellerUnreadChatCount > 0;

  const isActive = (href: string) => location === href;

  const navItems = [
    { label: "Inicio", href: "/vendor/dashboard", icon: Home, showBadge: false },
    { label: "Produtos", href: "/vendor/products", icon: Package, showBadge: false },
    { label: "Pedidos", href: "/vendor/orders", icon: ShoppingCart, showBadge: hasOrdersNotification },
    { label: "Compras", href: "/vendor/my-purchases", icon: ShoppingBag, showBadge: hasPurchasesNotification },
    { label: "Sacar", href: "/vendor/settings", icon: Wallet, showBadge: false },
  ];

  const handleLogout = () => {
    onLogout();
    setLocation("/");
  };

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 border-t md:hidden"
      style={{
        backgroundColor: "#1A1A1A",
        borderColor: "rgba(255,255,255,0.1)",
      }}
    >
      <div className="flex items-center justify-around h-16 max-w-md mx-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);
          
          return (
            <Link key={item.href} href={item.href}>
              <div className="relative">
                <Button
                  variant="ghost"
                  size="icon"
                  className={`rounded-lg transition ${
                    active
                      ? "text-teal-400 bg-teal-500/20 border border-teal-500/30"
                      : "text-gray-400 hover:text-gray-200"
                  }`}
                  data-testid={`button-bottom-nav-${item.label.toLowerCase()}`}
                >
                  <Icon className="w-5 h-5" />
                </Button>
                {item.showBadge && (
                  <span 
                    className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-pulse"
                    data-testid="notification-badge-purchases-mobile"
                  />
                )}
              </div>
            </Link>
          );
        })}

        {/* Logout Button */}
        <Button
          variant="ghost"
          size="icon"
          onClick={handleLogout}
          className="rounded-lg text-red-400 hover:text-red-300 hover:bg-red-500/10 transition"
          data-testid="button-bottom-logout"
        >
          <LogOut className="w-5 h-5" />
        </Button>
      </div>
    </nav>
  );
}
