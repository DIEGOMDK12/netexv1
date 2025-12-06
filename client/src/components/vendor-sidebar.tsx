import { LayoutDashboard, Package, ShoppingCart, Settings, LogOut, Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";

interface VendorSidebarProps {
  currentPage: string;
  onLogout: () => void;
  storeName?: string;
  onClose?: () => void;
}

export function VendorSidebar({ currentPage, onLogout, storeName, onClose }: VendorSidebarProps) {
  const [, setLocation] = useLocation();

  const handleNavClick = (page: string) => {
    setLocation(`/vendor/${page}`);
    onClose?.();
  };

  const menuItems = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "products", label: "Meus Produtos", icon: Package },
    { id: "orders", label: "Pedidos", icon: ShoppingCart },
    { id: "settings", label: "Configurações", icon: Settings },
  ];

  return (
    <div
      className="w-64 h-screen sticky top-0 flex flex-col p-6 border-r"
      style={{
        background: "rgba(30, 30, 30, 0.4)",
        backdropFilter: "blur(12px)",
        borderColor: "rgba(255, 255, 255, 0.1)",
      }}
    >
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-2">
          <Store className="w-5 h-5 text-blue-500" />
          <h2 className="text-lg font-bold text-white">{storeName || "Minha Loja"}</h2>
        </div>
        <p className="text-xs text-gray-400">Painel do Vendedor</p>
      </div>

      <nav className="flex-1 space-y-2">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentPage === item.id;
          
          return (
            <Button
              key={item.id}
              onClick={() => handleNavClick(item.id)}
              variant={isActive ? "default" : "ghost"}
              className="w-full justify-start gap-2"
              style={{
                background: isActive ? "rgba(59, 130, 246, 0.3)" : "transparent",
                color: isActive ? "#3B82F6" : "#FFFFFF",
                borderColor: isActive ? "rgba(59, 130, 246, 0.5)" : "transparent",
              }}
              data-testid={`menu-${item.id}`}
            >
              <Icon className="w-4 h-4" />
              {item.label}
            </Button>
          );
        })}
      </nav>

      <Button
        onClick={onLogout}
        variant="ghost"
        className="w-full justify-start gap-2 text-red-400 hover:text-red-300"
        data-testid="button-logout-sidebar"
      >
        <LogOut className="w-4 h-4" />
        Sair
      </Button>
    </div>
  );
}
