import { useEffect, useState } from "react";
import { useLocation, useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { VendorLayout } from "@/components/vendor-layout";
import { DashboardMain } from "./vendor-dashboard-main";
import { VendorStoreManagement } from "./vendor-store-management";
import { VendorOrdersEnhanced } from "./vendor-orders-enhanced";
import { VendorSettingsEnhanced } from "./vendor-settings-enhanced";
import { VendorMyPurchases } from "./vendor-my-purchases";
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
  }, [vendorId, vendorToken, adminToken, setLocation]);

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
        storeName={vendor?.storeName || undefined}
        logoUrl={vendor?.logoUrl || undefined}
        vendorEmail={vendor?.email || undefined}
      >
        {currentPage === "dashboard" && <DashboardMain vendorId={parseInt(vendorId)} />}
        {currentPage === "products" && vendor && <VendorStoreManagement vendorId={parseInt(vendorId)} />}
        {currentPage === "orders" && vendor && <VendorOrdersEnhanced vendorId={parseInt(vendorId)} />}
        {currentPage === "my-purchases" && vendor && <VendorMyPurchases vendorEmail={vendor.email} />}
        {currentPage === "settings" && vendor && <VendorSettingsEnhanced vendorId={parseInt(vendorId)} vendorData={vendor} />}
      </VendorLayout>
    </div>
  );
}
