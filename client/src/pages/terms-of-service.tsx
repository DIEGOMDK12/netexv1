import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowLeft, FileText } from "lucide-react";
import { useStore } from "@/lib/store-context";

export default function TermsOfService() {
  const { settings } = useStore();
  const storeName = settings?.storeName || "GOLDNET";

  return (
    <div className="min-h-screen bg-[#1a1814]">
      <header className="sticky top-0 z-50 bg-[#1a1814]/95 backdrop-blur-md border-b border-[#DAA520]/10">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center gap-4">
          <Link href="/">
            <Button size="icon" variant="ghost" className="text-gray-400" data-testid="button-back">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-500" />
            <span className="text-lg font-bold text-white">Termos de Servico</span>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="prose prose-invert max-w-none">
          <h1 className="text-3xl font-bold text-white mb-6">Termos de Servico</h1>
          
          <p className="text-gray-400 mb-6">
            Ultima atualizacao: {new Date().toLocaleDateString("pt-BR")}
          </p>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-white mb-4">1. Aceitacao dos Termos</h2>
            <p className="text-gray-300 mb-4">
              Ao acessar e usar a plataforma {storeName}, voce concorda em cumprir e estar vinculado a estes Termos de Servico. 
              Se voce nao concordar com qualquer parte destes termos, nao devera usar nossos servicos.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-white mb-4">2. Descricao dos Servicos</h2>
            <p className="text-gray-300 mb-4">
              {storeName} e uma plataforma de marketplace digital que permite a compra e venda de produtos digitais, 
              incluindo, mas nao limitado a: contas de jogos, gift cards, assinaturas de streaming, cursos online e softwares.
            </p>
            <ul className="list-disc list-inside text-gray-300 space-y-2">
              <li>Facilitamos transacoes entre compradores e vendedores</li>
              <li>Processamos pagamentos de forma segura via PIX e cartao</li>
              <li>Oferecemos entrega instantanea de produtos digitais</li>
              <li>Fornecemos suporte ao cliente para resolucao de disputas</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-white mb-4">3. Cadastro e Conta</h2>
            <p className="text-gray-300 mb-4">
              Para utilizar determinados servicos, voce devera criar uma conta fornecendo informacoes precisas e atualizadas. 
              Voce e responsavel por manter a confidencialidade de sua senha e por todas as atividades que ocorram em sua conta.
            </p>
            <ul className="list-disc list-inside text-gray-300 space-y-2">
              <li>Voce deve ter pelo menos 18 anos para criar uma conta</li>
              <li>Informacoes falsas podem resultar em suspensao da conta</li>
              <li>Cada pessoa pode ter apenas uma conta na plataforma</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-white mb-4">4. Responsabilidades do Vendedor</h2>
            <p className="text-gray-300 mb-4">
              Vendedores que utilizam nossa plataforma concordam em:
            </p>
            <ul className="list-disc list-inside text-gray-300 space-y-2">
              <li>Fornecer produtos digitais conforme descrito nos anuncios</li>
              <li>Manter estoque atualizado e disponivel</li>
              <li>Responder prontamente a duvidas dos compradores</li>
              <li>Nao vender produtos ilegais ou fraudulentos</li>
              <li>Garantir que os produtos entregues funcionem conforme anunciado</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-white mb-4">5. Responsabilidades do Comprador</h2>
            <p className="text-gray-300 mb-4">
              Compradores que utilizam nossa plataforma concordam em:
            </p>
            <ul className="list-disc list-inside text-gray-300 space-y-2">
              <li>Fornecer informacoes de pagamento validas</li>
              <li>Nao solicitar reembolsos de forma fraudulenta</li>
              <li>Utilizar os produtos adquiridos de forma legal</li>
              <li>Reportar problemas dentro do prazo estabelecido</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-white mb-4">6. Pagamentos e Taxas</h2>
            <p className="text-gray-300 mb-4">
              Todos os pagamentos sao processados de forma segura. A plataforma pode cobrar taxas de servico 
              sobre as transacoes realizadas. Os valores e percentuais serao informados previamente.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-white mb-4">7. Propriedade Intelectual</h2>
            <p className="text-gray-300 mb-4">
              Todo o conteudo da plataforma, incluindo textos, graficos, logos e software, e protegido por direitos autorais. 
              E proibida a reproducao sem autorizacao previa.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-white mb-4">8. Limitacao de Responsabilidade</h2>
            <p className="text-gray-300 mb-4">
              {storeName} atua como intermediador entre compradores e vendedores. Nao nos responsabilizamos por:
            </p>
            <ul className="list-disc list-inside text-gray-300 space-y-2">
              <li>Qualidade dos produtos vendidos por terceiros</li>
              <li>Disputas entre usuarios</li>
              <li>Perdas indiretas ou consequenciais</li>
              <li>Interrupcoes temporarias do servico</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-white mb-4">9. Contato</h2>
            <p className="text-gray-300 mb-4">
              Para duvidas sobre estes termos, entre em contato atraves do nosso suporte ao cliente.
            </p>
          </section>
        </div>
      </main>
    </div>
  );
}
