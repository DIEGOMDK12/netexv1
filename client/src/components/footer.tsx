import { MessageCircle, Shield, CreditCard, Lock } from "lucide-react";
import { useStore } from "@/lib/store-context";
import { SiPix } from "react-icons/si";

export function Footer() {
  const { settings } = useStore();
  const storeName = settings?.storeName || "Digital Store";
  const supportEmail = (settings as any)?.supportEmail || "support@goldstore.com";
  const whatsappContact = (settings as any)?.whatsappContact || "5585988007000";

  const currentYear = new Date().getFullYear();

  const openWhatsApp = () => {
    const whatsappUrl = `https://wa.me/${whatsappContact}?text=Olá%2C%20preciso%20de%20ajuda%20com%20os%20produtos`;
    window.open(whatsappUrl, "_blank");
  };

  return (
    <footer className="bg-zinc-950 border-t border-zinc-800 mt-16">
      <div className="max-w-7xl mx-auto px-6 py-6">
        {/* Top Row: Brand + Slogan */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold mb-1" style={{ color: "#FCD34D" }} data-testid="footer-brand">
            {storeName}
          </h2>
          <p className="text-gray-400 text-xs">Produtos digitais confiáveis, entrega instantânea</p>
        </div>

        {/* Middle Row: 2 Column Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
          {/* Column 1: Atendimento */}
          <div>
            <h3 className="text-white text-xs font-bold uppercase tracking-wide mb-3" style={{ color: "#FCD34D" }}>
              Atendimento
            </h3>
            <div className="space-y-2">
              {/* Email */}
              <a
                href={`mailto:${supportEmail}`}
                className="flex items-center gap-2 text-gray-300 hover:text-yellow-400 transition-colors text-sm"
                data-testid="link-footer-email"
              >
                <span className="text-gray-500">✉</span>
                {supportEmail}
              </a>

              {/* WhatsApp */}
              <button
                onClick={openWhatsApp}
                className="flex items-center gap-2 text-gray-300 hover:text-green-400 transition-colors text-sm"
                data-testid="button-footer-whatsapp"
              >
                <MessageCircle className="w-4 h-4 text-green-500" />
                WhatsApp 24/7
              </button>
            </div>
          </div>

          {/* Column 2: Institucional */}
          <div>
            <h3 className="text-white text-xs font-bold uppercase tracking-wide mb-3" style={{ color: "#FCD34D" }}>
              Institucional
            </h3>
            <div className="space-y-2">
              <a
                href="#termos"
                className="block text-gray-300 hover:text-yellow-400 transition-colors text-sm"
                data-testid="link-footer-terms"
              >
                Termos de Serviço
              </a>
              <a
                href="#garantia"
                className="block text-gray-300 hover:text-yellow-400 transition-colors text-sm"
                data-testid="link-footer-warranty"
              >
                Garantia e Reembolso
              </a>
            </div>
          </div>
        </div>

        {/* Payment & Trust Row */}
        <div className="border-t border-zinc-800 pt-6 mb-6">
          <p className="text-gray-400 text-xs mb-3 font-semibold">Pagamento Seguro:</p>
          <div className="flex items-center gap-4 flex-wrap">
            {/* Pix */}
            <div className="flex items-center gap-1.5 text-gray-300">
              <SiPix className="w-4 h-4" style={{ color: "#10B981" }} />
              <span className="text-xs">Pix</span>
            </div>

            {/* Card */}
            <div className="flex items-center gap-1.5 text-gray-300">
              <CreditCard className="w-4 h-4" style={{ color: "#3B82F6" }} />
              <span className="text-xs">Cartão</span>
            </div>

            {/* Shield */}
            <div className="flex items-center gap-1.5 text-gray-300">
              <Shield className="w-4 h-4" style={{ color: "#8B5CF6" }} />
              <span className="text-xs">Seguro</span>
            </div>

            {/* Lock Icon */}
            <div className="flex items-center gap-1.5 text-gray-300">
              <Lock className="w-4 h-4" style={{ color: "#EC4899" }} />
              <span className="text-xs">Criptografado</span>
            </div>
          </div>
        </div>

        {/* Copyright Footer */}
        <div className="text-center border-t border-zinc-800 pt-6">
          <p className="text-gray-500 text-xs">
            © {currentYear} {storeName} — Todos os direitos reservados
          </p>
        </div>
      </div>
    </footer>
  );
}
