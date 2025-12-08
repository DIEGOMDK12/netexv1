import { useEffect, useState } from "react";
import { useLocation, useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { VendorLayout } from "@/components/vendor-layout";
import { DashboardMain } from "./vendor-dashboard-main";
import { VendorStoreManagement } from "./vendor-store-management";
import { VendorOrdersEnhanced } from "./vendor-orders-enhanced";
import { VendorSettingsEnhanced } from "./vendor-settings-enhanced";
import { VendorCoupons } from "./vendor-coupons";
import { VendorAnnouncement } from "./vendor-announcement";
import type { Reseller } from "@shared/schema";

export default function VendorDashboard() {
  const [, setLocation] = useLocation();
  const [match, params] = useRoute("/vendor/:page");
  const currentPage = (params?.page as string) || "dashboard";
  
  const vendorId = localStorage.getItem("vendor_id");
  const vendorToken = localStorage.getItem("vendor_token");
  const adminToken = localStorage.getItem("admin_token");

  const { data: vendor, isLoading, refetch: refetchVendor } = useQuery<Reseller>({
    queryKey: ["/api/vendor/profile", vendorId],
    enabled: !!vendorId && !!vendorToken,
    // Refetch every 5 seconds to catch subscription updates
    refetchInterval: 5000,
  });

  useEffect(() => {
    // Prevent admin from accessing vendor dashboard
    if (adminToken && !vendorToken) {
      setLocation("/admin");
      return;
    }
    
    if (!vendorId || !vendorToken) {
      setLocation("/register");
      return;
    }

    // Check subscription status - redirect if inactive or expired
    if (vendor) {
      console.log("[🟢 VendorDashboard] Subscription check:", {
        subscriptionStatus: vendor.subscriptionStatus,
        subscriptionExpiresAt: vendor.subscriptionExpiresAt,
        timestamp: new Date().toISOString(),
      });

      // VALIDAÇÃO INFALÍVEL - Comparação precisa em milissegundos
      const subscriptionStatus = vendor.subscriptionStatus;
      const expiresAtValue = vendor.subscriptionExpiresAt;
      const now = new Date();
      
      // Parse string to Date - garantir que é um objeto Date válido
      const expiresAt = expiresAtValue ? new Date(expiresAtValue) : null;
      
      // Verificação robusta - status deve ser "active" ou "trial" e não expirado
      const isSubscriptionActive = subscriptionStatus === "active" || subscriptionStatus === "trial";
      const isNotExpired = expiresAt ? (expiresAt.getTime() > now.getTime()) : false;
      const canAccess = isSubscriptionActive && isNotExpired;

      console.log("[🟢 VendorDashboard] FINAL Access check:", {
        subscriptionStatus,
        isSubscriptionActive,
        expiresAtISO: expiresAt?.toISOString(),
        expiresAtMS: expiresAt?.getTime(),
        nowISO: now.toISOString(),
        nowMS: now.getTime(),
        isNotExpired,
        differenceMS: expiresAt ? expiresAt.getTime() - now.getTime() : 'N/A',
        canAccess,
      });

      // DECISÃO FINAL
      if (!canAccess) {
        console.log("[🟢 VendorDashboard] ❌ BLOQUEANDO - Motivo:", {
          statusCheck: isSubscriptionActive ? "OK" : "FAIL - Status não é 'active'",
          expirationCheck: isNotExpired ? "OK" : "FAIL - Data expirada ou inválida",
        });
        setLocation("/subscription-payment");
      } else {
        console.log("[🟢 VendorDashboard] ✅ ACESSO PERMITIDO - Subscription válida e ativa");
      }
    }
  }, [vendorId, vendorToken, adminToken, vendor, setLocation]);

  const handleLogout = () => {
    localStorage.removeItem("vendor_id");
    localStorage.removeItem("vendor_token");
    setLocation("/");
  };

  if (!vendorId || isLoading) {
    return (
      <div
        className="flex items-center justify-center h-screen"
        style={{
          background: "linear-gradient(135deg, #0a0e27 0%, #1a1a3e 50%, #0f0a2e 100%)",
        }}
      >
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div
      className="w-full"
      style={{
        background: "linear-gradient(135deg, #0a0e27 0%, #1a1a3e 50%, #0f0a2e 100%)",
      }}
    >
      <VendorLayout
        currentPage={currentPage}
        onLogout={handleLogout}
        storeName={vendor?.storeName}
        logoUrl={vendor?.logoUrl || undefined}
      >
        {currentPage === "dashboard" && <DashboardMain vendorId={parseInt(vendorId)} subscriptionExpiresAt={vendor?.subscriptionExpiresAt ? vendor.subscriptionExpiresAt.toString() : null} />}
        {currentPage === "products" && vendor && <VendorStoreManagement vendorId={parseInt(vendorId)} />}
        {currentPage === "orders" && vendor && <VendorOrdersEnhanced vendorId={parseInt(vendorId)} />}
        {currentPage === "coupons" && vendor && <VendorCoupons />}
        {currentPage === "announcement" && vendor && <VendorAnnouncement />}
        {currentPage === "settings" && vendor && <VendorSettingsEnhanced vendorId={parseInt(vendorId)} vendorData={vendor} />}
      </VendorLayout>
    </div>
  );
}
