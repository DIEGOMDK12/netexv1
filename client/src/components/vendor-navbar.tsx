import { useState } from "react";
import { Menu, X, LogOut } from "lucide-react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";

interface VendorNavbarProps {
  storeName?: string;
  onLogout: () => void;
}

export function VendorNavbar({ storeName, onLogout }: VendorNavbarProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [, setLocation] = useLocation();

  const menuItems = [
    { label: "Dashboard", href: "/vendor/dashboard" },
    { label: "Meus Produtos", href: "/vendor/products" },
    { label: "Pedidos", href: "/vendor/orders" },
    { label: "Configurações", href: "/vendor/settings" },
  ];

  const handleLogout = () => {
    onLogout();
    setLocation("/");
  };

  return (
    <nav
      className="fixed top-0 left-0 right-0 z-50 border-b"
      style={{
        background: "linear-gradient(135deg, #0a0e27 0%, #1a1a3e 100%)",
        borderColor: "rgba(139, 92, 246, 0.2)",
      }}
    >
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
        {/* Logo/Store Name - Left */}
        <div className="flex-shrink-0">
          <Link href="/vendor/dashboard">
            <h1
              className="text-xl font-bold cursor-pointer"
              style={{ color: "#8b5cf6" }}
            >
              {storeName || "Minha Loja"}
            </h1>
          </Link>
        </div>

        {/* Desktop Menu - Center/Right */}
        <div className="hidden md:flex items-center gap-1">
          {menuItems.map((item) => (
            <Link key={item.href} href={item.href}>
              <Button
                variant="ghost"
                className="text-gray-300 hover:text-white hover:bg-white/10"
                data-testid={`button-nav-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
              >
                {item.label}
              </Button>
            </Link>
          ))}

          <div className="ml-2 pl-2 border-l border-white/10">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleLogout}
              className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
              data-testid="button-logout"
            >
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Mobile Menu Button */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="md:hidden text-gray-300 hover:text-white"
          data-testid="button-mobile-menu"
        >
          {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </Button>
      </div>

      {/* Mobile Menu - Dropdown */}
      {mobileMenuOpen && (
        <div
          className="md:hidden border-t"
          style={{
            background: "rgba(10, 14, 39, 0.95)",
            borderColor: "rgba(139, 92, 246, 0.2)",
          }}
        >
          <div className="flex flex-col p-4 gap-2">
            {menuItems.map((item) => (
              <Link key={item.href} href={item.href}>
                <Button
                  variant="ghost"
                  className="w-full justify-start text-gray-300 hover:text-white hover:bg-white/10"
                  onClick={() => setMobileMenuOpen(false)}
                  data-testid={`button-mobile-nav-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
                >
                  {item.label}
                </Button>
              </Link>
            ))}
            <Button
              variant="ghost"
              className="w-full justify-start text-red-400 hover:text-red-300 hover:bg-red-500/10"
              onClick={() => {
                setMobileMenuOpen(false);
                handleLogout();
              }}
              data-testid="button-mobile-logout"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Sair
            </Button>
          </div>
        </div>
      )}
    </nav>
  );
}
