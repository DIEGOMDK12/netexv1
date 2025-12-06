import { useLocation } from "wouter";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";
import AdminResellers from "./admin-resellers";
import AdminProductsModeration from "./admin-products-moderation";

export default function AdminHome() {
  const [, setLocation] = useLocation();
  
  const vendorId = localStorage.getItem("vendor_id");
  const vendorToken = localStorage.getItem("vendor_token");
  const adminToken = localStorage.getItem("admin_token");

  useEffect(() => {
    // Prevent vendor from accessing admin panel
    if (vendorToken && !adminToken) {
      setLocation("/vendor/dashboard");
      return;
    }
    
    if (!adminToken) {
      setLocation("/admin/login");
    }
  }, [vendorToken, adminToken, setLocation]);

  if (!adminToken) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-8 h-8 animate-spin text-teal-500" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-bold text-white mb-2">Painel de Administração</h1>
        <p className="text-gray-400">Gerencie produtos, revendas e moderação da plataforma</p>
      </div>
      <AdminProductsModeration />
      <AdminResellers />
    </div>
  );
}
