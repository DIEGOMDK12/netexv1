import { CheckCircle } from "lucide-react";
import { VendorBottomNav } from "./vendor-bottom-nav";
import { VendorNavbarDesktop } from "./vendor-navbar-desktop";
import { Badge } from "@/components/ui/badge";
import { useNotifications } from "@/hooks/use-notifications";

interface VendorLayoutProps {
  currentPage: string;
  onLogout: () => void;
  storeName?: string;
  logoUrl?: string;
  vendorEmail?: string;
  vendorId?: number;
  verificationStatus?: string | null;
  children: React.ReactNode;
}

export function VendorLayout({
  currentPage,
  onLogout,
  storeName,
  logoUrl,
  vendorEmail,
  vendorId,
  verificationStatus,
  children,
}: VendorLayoutProps) {
  const isVerified = verificationStatus === "verified";
  
  useNotifications({
    vendorId,
    vendorEmail,
    enabled: !!vendorId || !!vendorEmail,
  });

  return (
    <div className="flex flex-col h-screen" style={{ backgroundColor: "#121212" }}>
      {/* Desktop Navbar - Hidden on mobile */}
      <VendorNavbarDesktop storeName={storeName} logoUrl={logoUrl} vendorEmail={vendorEmail} vendorId={vendorId} onLogout={onLogout} />

      {/* Main Content - Adjust padding based on screen size */}
      <main className="flex-1 overflow-auto p-6 md:pt-16">
        <div className="max-w-7xl mx-auto">
          {/* Mobile Store Name Header - Only on small screens */}
          <div className="md:hidden mb-6 flex items-center gap-2">
            {logoUrl ? (
              <img src={logoUrl} alt={storeName} className="h-12 max-h-12 object-contain" />
            ) : (
              <h1 className="text-2xl font-bold text-white">{storeName || "Minha Loja"}</h1>
            )}
            {isVerified && (
              <Badge 
                className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                data-testid="badge-vendor-verified"
              >
                <CheckCircle className="w-3 h-3 mr-1" />
                Verificado
              </Badge>
            )}
          </div>
          
          {children}
        </div>
      </main>

      {/* Bottom Navigation - Only on mobile (< md) */}
      <VendorBottomNav vendorEmail={vendorEmail} vendorId={vendorId} onLogout={onLogout} />
    </div>
  );
}
