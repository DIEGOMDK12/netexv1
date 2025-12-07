import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { 
  Tv, 
  Gamepad2, 
  Zap, 
  Shield, 
  TrendingUp, 
  Users, 
  ArrowRight,
  Check,
  Trophy,
  Wallet,
  Headphones,
  Link2,
  Store,
  Smartphone,
  Sparkles,
  Star
} from "lucide-react";
import logoImage from "@assets/generated_images/nexstore_digital_marketplace_logo.png";

export default function Home() {
  const categories = [
    {
      icon: Tv,
      title: "Streaming",
      description: "Netflix, Disney+, HBO Max, Spotify e muito mais",
      color: "#E50914"
    },
    {
      icon: Gamepad2,
      title: "Xbox & Games",
      description: "Game Pass, Xbox Live Gold, jogos digitais",
      color: "#107C10"
    },
    {
      icon: Trophy,
      title: "Contas Premium",
      description: "Contas verificadas com garantia total",
      color: "#FFD700"
    },
    {
      icon: Headphones,
      title: "Entretenimento",
      description: "YouTube Premium, Canva Pro, Deezer e outros",
      color: "#FF0000"
    }
  ];

  const benefits = [
    {
      icon: Zap,
      title: "Entrega Automática",
      description: "Produtos entregues instantaneamente após o pagamento via PIX"
    },
    {
      icon: Shield,
      title: "100% Seguro",
      description: "Plataforma segura com garantia em todos os produtos"
    },
    {
      icon: TrendingUp,
      title: "Lucros Altos",
      description: "Margem de lucro atrativa para revendedores"
    },
    {
      icon: Users,
      title: "Suporte Dedicado",
      description: "Equipe pronta para ajudar você a crescer"
    }
  ];

  const steps = [
    {
      number: "01",
      title: "Crie sua conta",
      description: "Cadastre-se gratuitamente e receba seu link exclusivo"
    },
    {
      number: "02",
      title: "Adicione produtos",
      description: "Cadastre seus produtos de streaming, jogos e contas premium"
    },
    {
      number: "03",
      title: "Divulgue seu link",
      description: "Compartilhe no Instagram, WhatsApp e TikTok"
    },
    {
      number: "04",
      title: "Receba via PIX",
      description: "Clientes pagam via PIX e você recebe na hora"
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
      {/* Header */}
      <header className="sticky top-0 z-50 backdrop-blur-xl border-b border-white/5 bg-slate-950/80">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <img src={logoImage} alt="NexStore Logo" className="w-10 h-10 rounded-xl object-contain" />
            <span className="text-xl font-bold bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">NexStore</span>
          </div>
          
          <div className="flex items-center gap-3">
            <Link href="/login">
              <Button variant="ghost" className="text-gray-300 hover:text-white" data-testid="button-login">
                Entrar
              </Button>
            </Link>
            <Link href="/register">
              <Button className="bg-gradient-to-r from-blue-500 to-violet-600 hover:from-blue-600 hover:to-violet-700 shadow-lg shadow-blue-500/25" data-testid="button-register">
                Criar Loja
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative py-24 md:py-36 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-900/20 via-transparent to-transparent" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-gradient-to-r from-blue-500/20 to-violet-500/20 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-violet-500/10 rounded-full blur-[100px]" />
        
        <div className="relative max-w-7xl mx-auto px-4 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-green-500/10 to-emerald-500/10 border border-green-500/20 mb-8">
            <Sparkles className="w-4 h-4 text-green-400" />
            <span className="text-sm font-medium text-green-300">7 Dias Grátis para Testar</span>
          </div>
          
          <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold text-white mb-6 leading-tight tracking-tight">
            Revenda Produtos<br />
            <span className="bg-gradient-to-r from-blue-400 via-violet-400 to-purple-400 bg-clip-text text-transparent">Digitais Premium</span>
          </h1>
          
          <p className="text-lg md:text-xl text-gray-400 max-w-2xl mx-auto mb-12 leading-relaxed">
            Crie sua loja de revenda em minutos. Streaming, jogos, contas premium 
            e muito mais com entrega automática via PIX.
          </p>
          
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/register">
              <Button size="lg" className="text-lg px-8 py-6 bg-gradient-to-r from-blue-500 to-violet-600 hover:from-blue-600 hover:to-violet-700 shadow-xl shadow-blue-500/25 group" data-testid="button-hero-register">
                Criar Minha Loja Grátis
                <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
              </Button>
            </Link>
            <Link href="/login">
              <Button size="lg" variant="outline" className="text-lg px-8 py-6 border-gray-700/50 text-gray-300 bg-white/5 backdrop-blur-sm hover:bg-white/10 hover:border-gray-600" data-testid="button-hero-login">
                Já tenho conta
              </Button>
            </Link>
          </div>
          
          <div className="mt-14 flex flex-wrap items-center justify-center gap-8 text-gray-400">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-full bg-green-500/20 flex items-center justify-center">
                <Check className="w-3 h-3 text-green-400" />
              </div>
              <span>Sem mensalidade inicial</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-full bg-green-500/20 flex items-center justify-center">
                <Check className="w-3 h-3 text-green-400" />
              </div>
              <span>Lucro imediato</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-full bg-green-500/20 flex items-center justify-center">
                <Check className="w-3 h-3 text-green-400" />
              </div>
              <span>Suporte 24 horas</span>
            </div>
          </div>
        </div>
      </section>

      {/* Categories Section */}
      <section className="py-24 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-slate-900/50 to-slate-950/50" />
        <div className="relative max-w-7xl mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Categorias de Produtos
            </h2>
            <p className="text-gray-400 max-w-xl mx-auto">
              Revenda os produtos digitais mais procurados do mercado
            </p>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {categories.map((category, index) => (
              <Card
                key={index}
                className="p-6 bg-white/[0.03] border-white/5 hover:bg-white/[0.06] hover:border-white/10 transition-all duration-300 group cursor-pointer"
                data-testid={`card-category-${index}`}
              >
                <div 
                  className="w-14 h-14 rounded-xl flex items-center justify-center mb-4 transition-transform group-hover:scale-110"
                  style={{ backgroundColor: `${category.color}15` }}
                >
                  <category.icon className="w-7 h-7" style={{ color: category.color }} />
                </div>
                <h3 className="text-xl font-semibold text-white mb-2">{category.title}</h3>
                <p className="text-gray-400 text-sm leading-relaxed">{category.description}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Your Exclusive Store Section */}
      <section className="py-24 relative overflow-hidden">
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-blue-500/5 rounded-full blur-[100px]" />
        <div className="relative max-w-7xl mx-auto px-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div>
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-green-500/10 border border-green-500/20 mb-8">
                <Link2 className="w-4 h-4 text-green-400" />
                <span className="text-sm font-medium text-green-300">Sua Loja, Seu Link</span>
              </div>
              
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-6 leading-tight">
                Cada Revendedor tem sua<br />
                <span className="bg-gradient-to-r from-blue-400 to-violet-400 bg-clip-text text-transparent">Loja Exclusiva</span>
              </h2>
              
              <p className="text-gray-400 text-lg mb-8 leading-relaxed">
                Ao criar sua conta, você recebe automaticamente um link exclusivo para sua loja. 
                Seus clientes acessam diretamente pelo seu link e todas as vendas são gerenciadas por você.
              </p>
              
              <div className="space-y-5">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                    <Store className="w-6 h-6 text-blue-400" />
                  </div>
                  <div>
                    <h4 className="text-white font-semibold mb-1">Link personalizado</h4>
                    <p className="text-gray-400 text-sm">Sua loja fica em: seusite.com/loja/seunome</p>
                  </div>
                </div>
                
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                    <Smartphone className="w-6 h-6 text-blue-400" />
                  </div>
                  <div>
                    <h4 className="text-white font-semibold mb-1">Compartilhe nas redes</h4>
                    <p className="text-gray-400 text-sm">Divulgue seu link no Instagram, WhatsApp, TikTok e mais</p>
                  </div>
                </div>
                
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                    <Wallet className="w-6 h-6 text-blue-400" />
                  </div>
                  <div>
                    <h4 className="text-white font-semibold mb-1">Receba via PIX</h4>
                    <p className="text-gray-400 text-sm">Pagamentos vão direto para sua conta bancária</p>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="relative">
              <div className="rounded-2xl p-6 bg-white/[0.03] border border-white/10 backdrop-blur-sm">
                <div className="flex items-center gap-2 mb-4 pb-4 border-b border-white/5">
                  <div className="w-3 h-3 rounded-full bg-red-500" />
                  <div className="w-3 h-3 rounded-full bg-yellow-500" />
                  <div className="w-3 h-3 rounded-full bg-green-500" />
                  <div className="flex-1 ml-4 px-4 py-2 rounded-lg text-xs text-gray-400 bg-slate-900/50">
                    midiastore.com/loja/sualojaaqui
                  </div>
                </div>
                
                <div className="space-y-4">
                  <div className="h-32 rounded-xl bg-gradient-to-br from-blue-500/10 to-violet-500/10 flex items-center justify-center border border-white/5">
                    <Store className="w-12 h-12 text-blue-400" />
                  </div>
                  <div className="text-center">
                    <p className="text-white font-bold text-lg">Sua Loja</p>
                    <p className="text-gray-400 text-sm">Produtos exclusivos</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="h-24 rounded-xl bg-slate-900/50 border border-white/5" />
                    <div className="h-24 rounded-xl bg-slate-900/50 border border-white/5" />
                  </div>
                </div>
              </div>
              
              <div className="absolute -bottom-8 -right-8 w-32 h-32 bg-blue-500/20 rounded-full blur-[60px]" />
              <div className="absolute -top-8 -left-8 w-40 h-40 bg-violet-500/15 rounded-full blur-[60px]" />
            </div>
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-24 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-slate-950/50 to-slate-900/50" />
        <div className="relative max-w-7xl mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Por que ser um Revendedor?
            </h2>
            <p className="text-gray-400 max-w-xl mx-auto">
              Tudo o que você precisa para começar seu negócio digital
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {benefits.map((benefit, index) => (
              <div 
                key={index} 
                className="p-6 rounded-2xl bg-white/[0.03] border border-white/5 text-center hover:bg-white/[0.05] transition-all"
                data-testid={`benefit-${index}`}
              >
                <div 
                  className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500/20 to-violet-500/20 flex items-center justify-center mx-auto mb-5"
                >
                  <benefit.icon className="w-8 h-8 text-blue-400" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">{benefit.title}</h3>
                <p className="text-gray-400 text-sm leading-relaxed">{benefit.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it Works Section */}
      <section className="py-24 relative">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Como Funciona?
            </h2>
            <p className="text-gray-400 max-w-xl mx-auto">
              Comece a revender em 4 passos simples
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {steps.map((step, index) => (
              <div key={index} className="relative" data-testid={`step-${index}`}>
                <div className="text-6xl font-bold mb-4 bg-gradient-to-b from-blue-500/30 to-transparent bg-clip-text text-transparent">
                  {step.number}
                </div>
                <h3 className="text-xl font-semibold text-white mb-2">{step.title}</h3>
                <p className="text-gray-400 leading-relaxed">{step.description}</p>
                {index < steps.length - 1 && (
                  <div className="hidden lg:block absolute top-10 right-0 w-1/2 h-px bg-gradient-to-r from-blue-500/30 to-transparent" />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing/CTA Section */}
      <section className="py-24">
        <div className="max-w-4xl mx-auto px-4">
          <Card 
            className="p-10 md:p-14 text-center bg-gradient-to-br from-blue-500/10 via-violet-500/10 to-purple-500/10 border-white/10 relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full blur-[80px]" />
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-violet-500/10 rounded-full blur-[80px]" />
            <div className="relative">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-green-500/10 border border-green-500/20 mb-8">
                <Star className="w-4 h-4 text-green-400 fill-green-400" />
                <span className="text-sm font-medium text-green-300">7 Dias Grátis + Planos a partir de R$ 10,00/mês</span>
              </div>
              
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
                Pronto para Começar?
              </h2>
              
              <p className="text-gray-400 max-w-xl mx-auto mb-10 leading-relaxed">
                Crie sua loja agora e comece a lucrar revendendo produtos digitais 
                com entrega automática e pagamento via PIX.
              </p>
              
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link href="/register">
                  <Button size="lg" className="text-lg px-10 py-6 bg-gradient-to-r from-blue-500 to-violet-600 hover:from-blue-600 hover:to-violet-700 shadow-xl shadow-blue-500/25 group" data-testid="button-cta-register">
                    Criar Minha Loja Agora
                    <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </Link>
              </div>
              
              <div className="mt-10 flex flex-wrap items-center justify-center gap-6 text-gray-300">
                <div className="flex items-center gap-2">
                  <Check className="w-5 h-5 text-green-400" />
                  <span className="text-sm">Painel completo</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-5 h-5 text-green-400" />
                  <span className="text-sm">Link exclusivo</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-5 h-5 text-green-400" />
                  <span className="text-sm">Suporte via WhatsApp</span>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-10 border-t border-white/5">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <img src={logoImage} alt="NexStore Logo" className="w-9 h-9 rounded-xl object-contain" />
              <span className="text-lg font-bold text-white">NexStore</span>
            </div>
            
            <div className="flex items-center gap-6 text-sm text-gray-400">
              <a href="#" className="hover:text-white transition">Termos de Uso</a>
              <a href="#" className="hover:text-white transition">Privacidade</a>
            </div>
            
            <p className="text-sm text-gray-500">
              © 2024 NexStore. Todos os direitos reservados.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
