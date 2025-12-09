import { LogOut, CheckCircle } from "lucide-react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";

interface VendorNavbarDesktopProps {
  storeName?: string;
  logoUrl?: string;
  vendorEmail?: string;
  vendorId?: number;
  onLogout: () => void;
}

export function VendorNavbarDesktop({ storeName, logoUrl, vendorEmail, vendorId, onLogout }: VendorNavbarDesktopProps) {
  const [location] = useLocation();
  const [, setLocation] = useLocation();

  // Unviewed orders for buyer (purchases)
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

  // Unread chat messages for buyer (purchases)
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

  // Unread chat messages for seller (orders from customers)
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

  const menuItems = [
    { label: "Dashboard", href: "/vendor/dashboard", showBadge: false },
    { label: "Meus Produtos", href: "/vendor/products", showBadge: false },
    { label: "Pedidos", href: "/vendor/orders", showBadge: hasOrdersNotification },
    { label: "Minhas Compras", href: "/vendor/my-purchases", showBadge: hasPurchasesNotification },
    { label: "Sacar", href: "/vendor/settings", showBadge: false },
  ];

  const handleLogout = () => {
    onLogout();
    setLocation("/");
  };

  return (
    <nav
      className="hidden md:flex h-16 border-b items-center justify-between px-6 fixed top-0 left-0 right-0 z-50"
      style={{ backgroundColor: "#1A1A1A", borderColor: "rgba(255,255,255,0.1)" }}
    >
      <div className="flex items-center gap-8">
        {/* Logo/Store Name - Left */}
        <Link href="/vendor/dashboard">
          <div className="flex items-center gap-2 cursor-pointer">
            {logoUrl ? (
              <img src={logoUrl} alt={storeName} className="h-10 max-h-10 object-contain" />
            ) : (
              <h1 className="text-lg font-bold text-white">
                {storeName || "Minha Loja"}
              </h1>
            )}
            <CheckCircle className="w-5 h-5 text-blue-500 flex-shrink-0" />
          </div>
        </Link>

        {/* Desktop Menu - Center */}
        <nav className="flex items-center gap-2">
          {menuItems.map((item) => {
            const isActive = location === item.href;
            return (
              <Link key={item.href} href={item.href}>
                <button
                  className={`relative flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
                    isActive
                      ? "bg-teal-500/20 text-teal-400 border border-teal-500/30"
                      : "text-gray-400 hover:text-white hover:bg-zinc-800/50"
                  }`}
                  data-testid={`button-nav-desktop-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
                >
                  <span className="text-sm font-medium">{item.label}</span>
                  {item.showBadge && (
                    <span 
                      className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-pulse"
                      data-testid="notification-badge-purchases"
                    />
                  )}
                </button>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Logout Button - Right */}
      <Button
        onClick={handleLogout}
        variant="ghost"
        className="text-gray-400 hover:text-red-400 hover:bg-red-500/10"
        data-testid="button-nav-desktop-logout"
      >
        <LogOut className="w-5 h-5 mr-2" />
        <span className="hidden sm:inline">Sair</span>
      </Button>
    </nav>
  );
}
