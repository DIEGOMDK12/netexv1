import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { 
  Search, 
  Bell, 
  ShoppingCart, 
  Menu,
  Play,
  ChevronRight,
  Star,
  Shield,
  Zap
} from "lucide-react";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Product } from "@shared/schema";

export default function Home() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ["/api/products"],
  });

  const activeProducts = products.filter(p => p.active);
  
  const popularCategories = [
    { name: "Warzone", image: "https://images.unsplash.com/photo-1542751371-adc38448a05e?w=200&h=200&fit=crop", slug: "warzone" },
    { name: "Clash", image: "https://images.unsplash.com/photo-1511512578047-dfb367046420?w=200&h=200&fit=crop", slug: "clash" },
    { name: "Roblox", image: "https://images.unsplash.com/photo-1493711662062-fa541f7f70cd?w=200&h=200&fit=crop", slug: "roblox" },
    { name: "Fortnite", image: "https://images.unsplash.com/photo-1538481199705-c710c4e965fc?w=200&h=200&fit=crop", slug: "fortnite" },
    { name: "FIFA", image: "https://images.unsplash.com/photo-1493711662062-fa541f7f70cd?w=200&h=200&fit=crop", slug: "fifa" },
  ];

  const steamProducts = activeProducts.filter(p => 
    p.category?.toLowerCase().includes('steam') || 
    p.name?.toLowerCase().includes('steam')
  ).slice(0, 4);

  const subscriptionProducts = activeProducts.filter(p => 
    p.category?.toLowerCase().includes('premium') || 
    p.category?.toLowerCase().includes('assinatura') ||
    p.name?.toLowerCase().includes('premium') ||
    p.name?.toLowerCase().includes('netflix') ||
    p.name?.toLowerCase().includes('spotify')
  ).slice(0, 4);

  const featuredProducts = activeProducts.slice(0, 8);

  return (
    <div className="min-h-screen bg-[#0f172a]">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-[#0f172a]/95 backdrop-blur-md border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <span className="text-lg font-bold text-white">GGMAX</span>
          </div>
          
          <div className="flex items-center gap-2">
            <Button size="icon" variant="ghost" className="text-gray-400 hover:text-white" data-testid="button-search">
              <Search className="w-5 h-5" />
            </Button>
            <Button size="icon" variant="ghost" className="text-gray-400 hover:text-white" data-testid="button-notifications">
              <Bell className="w-5 h-5" />
            </Button>
            <Button size="icon" variant="ghost" className="text-gray-400 hover:text-white" data-testid="button-cart">
              <ShoppingCart className="w-5 h-5" />
            </Button>
            <Button 
              size="icon" 
              variant="ghost" 
              className="text-gray-400 hover:text-white"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              data-testid="button-menu"
            >
              <Menu className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </header>

      {/* Mobile Menu */}
      {isMenuOpen && (
        <div className="fixed inset-0 z-40 bg-[#0f172a]/95 backdrop-blur-md pt-14">
          <div className="p-4 space-y-4">
            <Link href="/login">
              <Button variant="outline" className="w-full border-gray-700 text-white" data-testid="link-login">
                Entrar
              </Button>
            </Link>
            <Link href="/register">
              <Button className="w-full bg-blue-600 hover:bg-blue-700" data-testid="link-register">
                Criar Conta
              </Button>
            </Link>
          </div>
        </div>
      )}

      {/* Hero Section */}
      <section className="relative py-16 px-4 text-center overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-blue-600/10 to-transparent" />
        <div className="relative max-w-2xl mx-auto">
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-3">
            Comprar e Vender
          </h1>
          <p className="text-lg text-gray-400 mb-8">
            contas, jogos, gift cards e muito mais
          </p>
          <Button 
            size="lg" 
            className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-6 text-lg font-semibold rounded-xl"
            data-testid="button-how-it-works"
          >
            <Play className="w-5 h-5 mr-2" />
            COMO FUNCIONA?
          </Button>
        </div>
      </section>

      {/* Popular Categories */}
      <section className="px-4 py-8">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            Categorias Populares
            <ChevronRight className="w-5 h-5 text-gray-500" />
          </h2>
          <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide">
            {popularCategories.map((cat) => (
              <div 
                key={cat.slug}
                className="flex-shrink-0 w-20 text-center cursor-pointer group"
                data-testid={`category-${cat.slug}`}
              >
                <div className="w-20 h-20 rounded-xl overflow-hidden mb-2 border-2 border-transparent group-hover:border-blue-500 transition-colors">
                  <img 
                    src={cat.image} 
                    alt={cat.name}
                    className="w-full h-full object-cover"
                  />
                </div>
                <span className="text-xs text-gray-400 group-hover:text-white transition-colors">
                  {cat.name}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Steam Section */}
      {steamProducts.length > 0 && (
        <section className="px-4 py-6">
          <div className="max-w-7xl mx-auto">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <span className="text-blue-500">Steam</span>
              <ChevronRight className="w-5 h-5 text-gray-500" />
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {steamProducts.map((product) => (
                <ProductCardMini key={product.id} product={product} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Subscriptions Section */}
      {subscriptionProducts.length > 0 && (
        <section className="px-4 py-6">
          <div className="max-w-7xl mx-auto">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <span className="text-purple-500">Assinaturas e Premium</span>
              <ChevronRight className="w-5 h-5 text-gray-500" />
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {subscriptionProducts.map((product) => (
                <ProductCardMini key={product.id} product={product} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Featured Products */}
      <section className="px-4 py-6">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <Star className="w-5 h-5 text-yellow-500" />
            Em Destaque
            <ChevronRight className="w-5 h-5 text-gray-500" />
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {featuredProducts.map((product) => (
              <ProductCardMini key={product.id} product={product} />
            ))}
          </div>
        </div>
      </section>

      {/* Trust Badges */}
      <section className="px-4 py-12">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="bg-[#1e293b] rounded-xl p-4 text-center">
              <Shield className="w-8 h-8 text-green-500 mx-auto mb-2" />
              <p className="text-sm font-medium text-white">Compra Segura</p>
              <p className="text-xs text-gray-500">Garantia em todas as compras</p>
            </div>
            <div className="bg-[#1e293b] rounded-xl p-4 text-center">
              <Zap className="w-8 h-8 text-blue-500 mx-auto mb-2" />
              <p className="text-sm font-medium text-white">Entrega Instantanea</p>
              <p className="text-xs text-gray-500">Receba na hora</p>
            </div>
            <div className="bg-[#1e293b] rounded-xl p-4 text-center col-span-2 md:col-span-1">
              <Star className="w-8 h-8 text-yellow-500 mx-auto mb-2" />
              <p className="text-sm font-medium text-white">Vendedores Verificados</p>
              <p className="text-xs text-gray-500">Reputacao comprovada</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="px-4 py-12">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-2xl font-bold text-white mb-4">
            Quer vender seus produtos?
          </h2>
          <p className="text-gray-400 mb-6">
            Crie sua conta e comece a vender hoje mesmo
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/register">
              <Button size="lg" className="bg-blue-600 hover:bg-blue-700 px-8" data-testid="button-cta-register">
                Criar Conta Gratis
              </Button>
            </Link>
            <Link href="/login">
              <Button size="lg" variant="outline" className="border-gray-700 text-white px-8" data-testid="button-cta-login">
                Ja tenho conta
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5 py-8 px-4">
        <div className="max-w-7xl mx-auto text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className="w-6 h-6 rounded bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
              <Zap className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-white">GGMAX</span>
          </div>
          <p className="text-sm text-gray-500">
            2024 GGMAX. Todos os direitos reservados.
          </p>
        </div>
      </footer>
    </div>
  );
}

function ProductCardMini({ product }: { product: Product }) {
  const stockLines = product.stock?.split("\n").filter((line) => line.trim()) || [];
  const hasStock = stockLines.length > 0;

  return (
    <Link href={`/product/${product.id}`}>
      <div 
        className="bg-[#1e293b] rounded-xl overflow-hidden cursor-pointer group"
        data-testid={`card-product-${product.id}`}
      >
        {/* Product Image */}
        <div className="aspect-square relative overflow-hidden">
          {product.imageUrl ? (
            <img 
              src={product.imageUrl} 
              alt={product.name}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-blue-900/50 to-slate-800 flex items-center justify-center">
              <ShoppingCart className="w-8 h-8 text-gray-600" />
            </div>
          )}
          {!hasStock && (
            <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
              <span className="text-white text-xs font-medium bg-red-500 px-2 py-1 rounded">Esgotado</span>
            </div>
          )}
        </div>

        {/* Product Info */}
        <div className="p-3">
          <h3 className="text-sm font-medium text-white line-clamp-2 min-h-[2.5rem] mb-2" data-testid={`text-product-name-${product.id}`}>
            {product.name}
          </h3>
          
          <div className="flex items-center justify-between">
            <span className="text-lg font-bold text-blue-500" data-testid={`text-price-${product.id}`}>
              R$ {Number(product.currentPrice).toFixed(2)}
            </span>
          </div>

          <p className="text-xs text-gray-500 mt-2 truncate" data-testid={`text-seller-${product.id}`}>
            Vendedor Verificado
          </p>
        </div>
      </div>
    </Link>
  );
}
