import { CheckCircle } from "lucide-react";
import { VendorBottomNav } from "./vendor-bottom-nav";
import { VendorNavbarDesktop } from "./vendor-navbar-desktop";

interface VendorLayoutProps {
  currentPage: string;
  onLogout: () => void;
  storeName?: string;
  logoUrl?: string;
  vendorEmail?: string;
  children: React.ReactNode;
}

export function VendorLayout({
  currentPage,
  onLogout,
  storeName,
  logoUrl,
  vendorEmail,
  children,
}: VendorLayoutProps) {
  return (
    <div className="flex flex-col h-screen" style={{ backgroundColor: "#121212" }}>
      {/* Desktop Navbar - Hidden on mobile */}
      <VendorNavbarDesktop storeName={storeName} logoUrl={logoUrl} vendorEmail={vendorEmail} onLogout={onLogout} />

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
            <CheckCircle className="w-6 h-6 text-blue-500 flex-shrink-0" />
          </div>
          
          {children}
        </div>
      </main>

      {/* Bottom Navigation - Only on mobile (< md) */}
      <VendorBottomNav vendorEmail={vendorEmail} onLogout={onLogout} />
    </div>
  );
}
