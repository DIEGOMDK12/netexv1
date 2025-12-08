import { Home, Package, ShoppingCart, Settings, LogOut, Tag, Megaphone } from "lucide-react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";

interface VendorBottomNavProps {
  onLogout: () => void;
}

export function VendorBottomNav({ onLogout }: VendorBottomNavProps) {
  const [location] = useLocation();
  const [, setLocation] = useLocation();

  const isActive = (href: string) => location === href;

  const navItems = [
    { label: "Inicio", href: "/vendor/dashboard", icon: Home },
    { label: "Produtos", href: "/vendor/products", icon: Package },
    { label: "Pedidos", href: "/vendor/orders", icon: ShoppingCart },
    { label: "Cupons", href: "/vendor/coupons", icon: Tag },
    { label: "Anuncio", href: "/vendor/announcement", icon: Megaphone },
    { label: "Config", href: "/vendor/settings", icon: Settings },
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
