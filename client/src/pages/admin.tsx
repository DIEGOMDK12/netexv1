import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Home, Package, Settings, LogOut, Store, Wallet, FileCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import AdminHome from "./admin-home";
import AdminProductsModeration from "./admin-products-moderation";
import AdminSettings from "./admin-settings";
import AdminResellers from "./admin-resellers";
import AdminWithdrawals from "./admin-withdrawals";
import AdminVerifications from "./admin-verifications";

export default function Admin() {
  const [, setLocation] = useLocation();
  const [currentPage, setCurrentPage] = useState<"home" | "products" | "settings" | "resellers" | "withdrawals" | "verifications">("home");

  useEffect(() => {
    const token = localStorage.getItem("admin_token");
    if (!token) {
      setLocation("/admin");
    }
  }, [setLocation]);

  const handleLogout = () => {
    localStorage.removeItem("admin_token");
    setLocation("/admin");
  };

  const navItems = [
    { id: "home" as const, label: "Dashboard", icon: Home },
    { id: "resellers" as const, label: "Lojas/Revendas", icon: Store },
    { id: "verifications" as const, label: "Verificacoes", icon: FileCheck },
    { id: "products" as const, label: "Produtos", icon: Package },
    { id: "withdrawals" as const, label: "Retiradas", icon: Wallet },
    { id: "settings" as const, label: "Configuracoes", icon: Settings },
  ];

  return (
    <div className="flex flex-col h-screen" style={{ backgroundColor: "#121212" }}>
      {/* Top Navigation Bar */}
      <div
        className="h-16 border-b flex items-center justify-between px-6"
        style={{ backgroundColor: "#1A1A1A", borderColor: "rgba(255,255,255,0.1)" }}
      >
        <div className="flex items-center gap-8">
          <h1 className="text-lg font-bold text-white">Painel Admin</h1>
          
          {/* Navigation Links */}
          <nav className="flex items-center gap-2">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setCurrentPage(item.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
                  currentPage === item.id
                    ? "bg-teal-500/20 text-teal-400 border border-teal-500/30"
                    : "text-gray-400 hover:text-white hover:bg-zinc-800/50"
                }`}
              >
                <item.icon className="w-4 h-4" />
                <span className="text-sm font-medium hidden sm:inline">{item.label}</span>
              </button>
            ))}
          </nav>
        </div>

        {/* Logout Button */}
        <Button
          onClick={handleLogout}
          variant="ghost"
          className="text-gray-400 hover:text-red-400 hover:bg-red-500/10"
          data-testid="button-logout"
        >
          <LogOut className="w-5 h-5 mr-2" />
          <span className="hidden sm:inline">Sair</span>
        </Button>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto p-6">
        {currentPage === "home" && <AdminHome />}
        {currentPage === "resellers" && <AdminResellers />}
        {currentPage === "verifications" && <AdminVerifications />}
        {currentPage === "products" && <AdminProductsModeration />}
        {currentPage === "withdrawals" && <AdminWithdrawals />}
        {currentPage === "settings" && <AdminSettings />}
      </div>
    </div>
  );
}
