import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Shield, AlertCircle, CheckCircle, XCircle } from "lucide-react";
import { useStore } from "@/lib/store-context";

export default function RefundPolicy() {
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
            <Shield className="w-5 h-5 text-green-500" />
            <span className="text-lg font-bold text-white">Garantia e Reembolso</span>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="prose prose-invert max-w-none">
          <h1 className="text-3xl font-bold text-white mb-6">Politica de Garantia e Reembolso</h1>
          
          <p className="text-gray-400 mb-6">
            Ultima atualizacao: {new Date().toLocaleDateString("pt-BR")}
          </p>

          <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4 mb-8">
            <div className="flex items-center gap-2 mb-2">
              <Shield className="w-5 h-5 text-green-500" />
              <span className="font-semibold text-green-400">Compra Protegida</span>
            </div>
            <p className="text-gray-300 text-sm">
              Todas as compras realizadas na {storeName} sao protegidas. Se voce tiver problemas com seu pedido, 
              nossa equipe esta pronta para ajudar.
            </p>
          </div>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-white mb-4">Como Funciona a Garantia</h2>
            <p className="text-gray-300 mb-4">
              Entendemos que produtos digitais requerem atencao especial. Por isso, oferecemos garantia em todas as compras 
              realizadas atraves da nossa plataforma.
            </p>
            
            <div className="grid gap-4 md:grid-cols-2 mb-6">
              <div className="bg-[#1e293b] rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle className="w-5 h-5 text-green-500" />
                  <span className="font-medium text-white">Produtos com Garantia</span>
                </div>
                <ul className="text-sm text-gray-300 space-y-1">
                  <li>Contas de jogos e plataformas</li>
                  <li>Assinaturas de streaming</li>
                  <li>Gift cards e creditos</li>
                  <li>Licencas de software</li>
                  <li>Cursos e materiais educativos</li>
                </ul>
              </div>
              
              <div className="bg-[#1e293b] rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <AlertCircle className="w-5 h-5 text-yellow-500" />
                  <span className="font-medium text-white">Prazo de Garantia</span>
                </div>
                <ul className="text-sm text-gray-300 space-y-1">
                  <li>24 horas para contas e acessos</li>
                  <li>7 dias para assinaturas</li>
                  <li>Imediato para gift cards</li>
                  <li>Varia conforme anuncio</li>
                </ul>
              </div>
            </div>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-white mb-4">Quando Posso Solicitar Reembolso?</h2>
            
            <div className="space-y-4">
              <div className="flex items-start gap-3 bg-[#1e293b] rounded-lg p-4">
                <CheckCircle className="w-5 h-5 text-green-500 mt-0.5" />
                <div>
                  <p className="font-medium text-white">Produto nao entregue</p>
                  <p className="text-sm text-gray-400">Se voce nao recebeu o produto apos a confirmacao do pagamento.</p>
                </div>
              </div>
              
              <div className="flex items-start gap-3 bg-[#1e293b] rounded-lg p-4">
                <CheckCircle className="w-5 h-5 text-green-500 mt-0.5" />
                <div>
                  <p className="font-medium text-white">Produto diferente do anunciado</p>
                  <p className="text-sm text-gray-400">Se o produto recebido nao corresponde a descricao do anuncio.</p>
                </div>
              </div>
              
              <div className="flex items-start gap-3 bg-[#1e293b] rounded-lg p-4">
                <CheckCircle className="w-5 h-5 text-green-500 mt-0.5" />
                <div>
                  <p className="font-medium text-white">Produto com defeito</p>
                  <p className="text-sm text-gray-400">Se o produto digital nao funciona conforme prometido.</p>
                </div>
              </div>
              
              <div className="flex items-start gap-3 bg-[#1e293b] rounded-lg p-4">
                <CheckCircle className="w-5 h-5 text-green-500 mt-0.5" />
                <div>
                  <p className="font-medium text-white">Dados invalidos</p>
                  <p className="text-sm text-gray-400">Se as credenciais ou codigos fornecidos nao funcionam.</p>
                </div>
              </div>
            </div>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-white mb-4">Quando NAO Ha Direito a Reembolso?</h2>
            
            <div className="space-y-4">
              <div className="flex items-start gap-3 bg-red-500/10 border border-red-500/20 rounded-lg p-4">
                <XCircle className="w-5 h-5 text-red-500 mt-0.5" />
                <div>
                  <p className="font-medium text-white">Mudanca de ideia</p>
                  <p className="text-sm text-gray-400">Produtos digitais nao podem ser devolvidos por arrependimento apos o uso.</p>
                </div>
              </div>
              
              <div className="flex items-start gap-3 bg-red-500/10 border border-red-500/20 rounded-lg p-4">
                <XCircle className="w-5 h-5 text-red-500 mt-0.5" />
                <div>
                  <p className="font-medium text-white">Produto ja utilizado</p>
                  <p className="text-sm text-gray-400">Se voce ja resgatou, usou ou transferiu o produto.</p>
                </div>
              </div>
              
              <div className="flex items-start gap-3 bg-red-500/10 border border-red-500/20 rounded-lg p-4">
                <XCircle className="w-5 h-5 text-red-500 mt-0.5" />
                <div>
                  <p className="font-medium text-white">Fora do prazo</p>
                  <p className="text-sm text-gray-400">Solicitacoes feitas apos o prazo de garantia estabelecido.</p>
                </div>
              </div>
              
              <div className="flex items-start gap-3 bg-red-500/10 border border-red-500/20 rounded-lg p-4">
                <XCircle className="w-5 h-5 text-red-500 mt-0.5" />
                <div>
                  <p className="font-medium text-white">Uso indevido</p>
                  <p className="text-sm text-gray-400">Se o problema foi causado por mau uso do comprador.</p>
                </div>
              </div>
            </div>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-white mb-4">Como Solicitar Reembolso</h2>
            
            <ol className="list-decimal list-inside text-gray-300 space-y-3">
              <li className="pl-2">
                <span className="font-medium text-white">Acesse "Minhas Compras"</span>
                <p className="text-sm text-gray-400 ml-6">Entre na sua conta e va ate a secao de compras.</p>
              </li>
              <li className="pl-2">
                <span className="font-medium text-white">Selecione o pedido</span>
                <p className="text-sm text-gray-400 ml-6">Encontre o pedido com problema e clique em "Suporte".</p>
              </li>
              <li className="pl-2">
                <span className="font-medium text-white">Descreva o problema</span>
                <p className="text-sm text-gray-400 ml-6">Explique detalhadamente o que aconteceu com evidencias.</p>
              </li>
              <li className="pl-2">
                <span className="font-medium text-white">Aguarde a analise</span>
                <p className="text-sm text-gray-400 ml-6">Nossa equipe analisara seu caso em ate 48 horas.</p>
              </li>
              <li className="pl-2">
                <span className="font-medium text-white">Receba o reembolso</span>
                <p className="text-sm text-gray-400 ml-6">Se aprovado, o valor sera devolvido em ate 7 dias uteis.</p>
              </li>
            </ol>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-white mb-4">Formas de Reembolso</h2>
            <p className="text-gray-300 mb-4">
              O reembolso sera realizado pela mesma forma de pagamento utilizada na compra:
            </p>
            <ul className="list-disc list-inside text-gray-300 space-y-2">
              <li><span className="font-medium text-white">PIX:</span> Devolucao em ate 24 horas uteis</li>
              <li><span className="font-medium text-white">Cartao de Credito:</span> Estorno em ate 2 faturas</li>
              <li><span className="font-medium text-white">Creditos na Plataforma:</span> Disponivel imediatamente</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-white mb-4">Contato</h2>
            <p className="text-gray-300 mb-4">
              Se voce tiver duvidas sobre nossa politica de garantia e reembolso, entre em contato com nosso suporte 
              atraves do chat no pedido ou pelo WhatsApp.
            </p>
          </section>
        </div>
      </main>
    </div>
  );
}
