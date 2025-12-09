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
    { id: "home" as const, label: "Dashboard", shortLabel: "Inicio", icon: Home },
    { id: "resellers" as const, label: "Lojas/Revendas", shortLabel: "Lojas", icon: Store },
    { id: "verifications" as const, label: "Verificacoes", shortLabel: "Verificar", icon: FileCheck },
    { id: "products" as const, label: "Produtos", shortLabel: "Produtos", icon: Package },
    { id: "withdrawals" as const, label: "Retiradas", shortLabel: "Saques", icon: Wallet },
    { id: "settings" as const, label: "Configuracoes", shortLabel: "Config", icon: Settings },
  ];

  return (
    <div className="flex flex-col h-screen" style={{ backgroundColor: "#121212" }}>
      {/* Top Navigation Bar - Desktop Only */}
      <div
        className="h-16 border-b hidden md:flex items-center justify-between px-6"
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
                <span className="text-sm font-medium">{item.label}</span>
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
          <span>Sair</span>
        </Button>
      </div>

      {/* Mobile Header */}
      <div
        className="h-12 border-b flex md:hidden items-center justify-between px-4"
        style={{ backgroundColor: "#1A1A1A", borderColor: "rgba(255,255,255,0.1)" }}
      >
        <h1 className="text-base font-bold text-white">Painel Admin</h1>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto p-4 md:p-6 pb-16 md:pb-6">
        {currentPage === "home" && <AdminHome />}
        {currentPage === "resellers" && <AdminResellers />}
        {currentPage === "verifications" && <AdminVerifications />}
        {currentPage === "products" && <AdminProductsModeration />}
        {currentPage === "withdrawals" && <AdminWithdrawals />}
        {currentPage === "settings" && <AdminSettings />}
      </div>

      {/* Bottom Navigation Bar - Mobile Only */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-50 md:hidden safe-area-inset-bottom"
        style={{
          background: "rgba(10, 10, 10, 0.85)",
          backdropFilter: "blur(8px)",
          borderTop: "1px solid rgba(255,255,255,0.05)",
        }}
      >
        <div className="flex items-center justify-around h-12 max-w-lg mx-auto px-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = currentPage === item.id;
            
            return (
              <div
                key={item.id}
                onClick={() => setCurrentPage(item.id)}
                className={`relative flex flex-col items-center justify-center py-1 px-2 rounded-lg transition-all duration-200 cursor-pointer ${
                  active ? "bg-emerald-500/10" : ""
                }`}
                data-testid={`button-admin-nav-${item.id}`}
              >
                <Icon className={`w-4 h-4 ${active ? "text-emerald-400" : "text-gray-500"}`} />
                <span className={`text-[9px] font-medium mt-0.5 ${active ? "text-emerald-400" : "text-gray-500"}`}>
                  {item.shortLabel}
                </span>
              </div>
            );
          })}

          {/* Logout Button */}
          <div 
            onClick={handleLogout}
            className="flex flex-col items-center justify-center py-1 px-2 rounded-lg transition-all duration-200 cursor-pointer"
            data-testid="button-admin-logout-mobile"
          >
            <LogOut className="w-4 h-4 text-red-400" />
            <span className="text-[9px] font-medium mt-0.5 text-red-400">Sair</span>
          </div>
        </div>
      </nav>
    </div>
  );
}
