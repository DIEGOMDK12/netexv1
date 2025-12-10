import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import nexStoreLogo from "@assets/generated_images/nex_store_modern_logo.png";
import { 
  Search, 
  Bell, 
  ShoppingCart, 
  Menu,
  Play,
  ChevronRight,
  Star,
  Shield,
  Zap,
  User,
  Gamepad2,
  Tv,
  Gift,
  Coins,
  Headphones,
  Smartphone,
  Package
} from "lucide-react";
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Product, Category } from "@shared/schema";

type ProductWithSeller = Product & {
  seller: {
    id: number;
    name: string;
    storeName: string | null;
    logoUrl: string | null;
    slug: string;
  } | null;
};

type SellerStats = Record<number, { averageRating: number; totalReviews: number }>;

const categoryIcons: Record<string, any> = {
  "games-mobile": Smartphone,
  "games-pc": Gamepad2,
  "steam-plataformas": Gamepad2,
  "streaming": Tv,
  "cursos": Star,
  "softwares": Headphones,
  "default": Gamepad2,
};

const categoryImages: Record<string, string> = {
  "games-mobile": "https://images.unsplash.com/photo-1511512578047-dfb367046420?w=200&h=200&fit=crop",
  "games-pc": "https://images.unsplash.com/photo-1542751371-adc38448a05e?w=200&h=200&fit=crop",
  "steam-plataformas": "https://images.unsplash.com/photo-1511512578047-dfb367046420?w=200&h=200&fit=crop",
  "streaming": "https://images.unsplash.com/photo-1574375927938-d5a98e8ffe85?w=200&h=200&fit=crop",
  "cursos": "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=200&h=200&fit=crop",
  "softwares": "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=200&h=200&fit=crop",
  "default": "https://images.unsplash.com/photo-1511512578047-dfb367046420?w=200&h=200&fit=crop",
};

export default function Home() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedSubcategory, setSelectedSubcategory] = useState<string | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const vendorId = localStorage.getItem("vendor_id");
      const vendorToken = localStorage.getItem("vendor_token");
      setIsLoggedIn(!!vendorId && !!vendorToken);
    }
  }, []);

  const { data: products = [], isLoading } = useQuery<ProductWithSeller[]>({
    queryKey: ["/api/marketplace/products"],
  });

  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ["/api/marketplace/categories"],
  });

  const { data: globalCategories = [] } = useQuery<Category[]>({
    queryKey: ["/api/categories/with-subcategories"],
    queryFn: async () => {
      const response = await fetch("/api/categories/with-subcategories");
      if (!response.ok) throw new Error("Failed to fetch categories");
      return response.json();
    },
  });

  // Get unique seller IDs from products
  const uniqueSellerIds = Array.from(new Set(products.map(p => p.seller?.id).filter(Boolean) as number[]));

  // Fetch batch seller stats
  const { data: sellerStats = {} } = useQuery<SellerStats>({
    queryKey: ["/api/marketplace/seller-stats", uniqueSellerIds],
    queryFn: async () => {
      if (uniqueSellerIds.length === 0) return {};
      const response = await fetch("/api/marketplace/seller-stats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sellerIds: uniqueSellerIds }),
      });
      if (!response.ok) throw new Error("Failed to fetch seller stats");
      return response.json();
    },
    enabled: uniqueSellerIds.length > 0,
  });

  const activeProducts = products.filter(p => p.active);
  
  const selectedCategoryData = globalCategories.find(c => c.name === selectedCategory);
  const availableSubcategories = selectedCategoryData?.subcategories || [];
  
  const filteredProducts = activeProducts.filter(p => {
    // Filtro de busca
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      const matchesSearch = 
        p.name?.toLowerCase().includes(query) ||
        p.description?.toLowerCase().includes(query) ||
        p.category?.toLowerCase().includes(query);
      if (!matchesSearch) return false;
    }
    
    if (!selectedCategory) return true;
    if (p.category !== selectedCategory) return false;
    if (selectedSubcategory && p.subcategory !== selectedSubcategory) return false;
    return true;
  });

  const handleCategoryClick = (categoryName: string) => {
    if (selectedCategory === categoryName) {
      setSelectedCategory(null);
      setSelectedSubcategory(null);
    } else {
      setSelectedCategory(categoryName);
      setSelectedSubcategory(null);
    }
  };

  const handleSubcategoryClick = (subcategoryName: string) => {
    if (selectedSubcategory === subcategoryName) {
      setSelectedSubcategory(null);
    } else {
      setSelectedSubcategory(subcategoryName);
    }
  };

  const defaultCategories = [
    { id: 1, name: "Games", slug: "games", subcategories: ["Contas", "Itens", "Moedas", "Servicos", "Outros"] },
    { id: 2, name: "Steam", slug: "steam", subcategories: ["Chaves (Keys)", "Contas", "Gift Cards", "Jogos", "Saldo"] },
    { id: 3, name: "Streaming & TV", slug: "streaming-tv", subcategories: ["Netflix", "Disney+", "Prime Video", "Spotify", "IPTV", "Outros"] },
    { id: 4, name: "Cursos & Tutoriais", slug: "cursos-tutoriais", subcategories: ["Marketing", "Programacao", "Metodos", "E-books", "Mentoria"] },
    { id: 5, name: "Outros", slug: "outros", subcategories: ["Diversos", "Vouchers", "Promocoes"] },
  ];

  const displayCategories = globalCategories.length > 0 ? globalCategories : 
    categories.length > 0 
    ? categories.reduce((acc: { id: number; name: string; slug: string; subcategories?: string[] | null }[], cat) => {
        if (!acc.find(c => c.slug === cat.slug)) {
          acc.push({ id: cat.id, name: cat.name, slug: cat.slug, subcategories: cat.subcategories });
        }
        return acc;
      }, []).slice(0, 8)
    : defaultCategories;

  const steamProducts = activeProducts.filter(p => 
    p.category === 'Steam' || 
    p.name?.toLowerCase().includes('steam')
  ).slice(0, 4);

  const subscriptionProducts = activeProducts.filter(p => 
    p.category === 'Streaming & TV' ||
    p.name?.toLowerCase().includes('netflix') ||
    p.name?.toLowerCase().includes('spotify') ||
    p.name?.toLowerCase().includes('disney') ||
    p.name?.toLowerCase().includes('prime video')
  ).slice(0, 4);

  const featuredProducts = activeProducts.slice(0, 8);

  return (
    <div className="min-h-screen bg-[#0f172a]">
      <header className="sticky top-0 z-50 bg-[#0f172a]/95 backdrop-blur-md border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <img src={nexStoreLogo} alt="ELITEVAULT" className="w-8 h-8 rounded-lg" />
            <span className="text-lg font-bold text-white">ELITEVAULT</span>
          </div>
          
          <div className="flex items-center gap-2">
            <Button 
              size="icon" 
              variant="ghost" 
              className="text-gray-400"
              onClick={() => setIsSearchOpen(!isSearchOpen)}
              data-testid="button-search"
            >
              <Search className="w-5 h-5" />
            </Button>
            <Button size="icon" variant="ghost" className="text-gray-400" data-testid="button-notifications">
              <Bell className="w-5 h-5" />
            </Button>
            <Button 
              size="icon" 
              variant="ghost" 
              className="text-gray-400"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              data-testid="button-menu"
            >
              <Menu className="w-5 h-5" />
            </Button>
          </div>
        </div>
        
        {isSearchOpen && (
          <div className="border-t border-white/5 px-4 py-2 bg-[#0f172a]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar produtos..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-[#1e293b] border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
                autoFocus
                data-testid="input-search"
              />
            </div>
          </div>
        )}
      </header>

      {isMenuOpen && (
        <div className="fixed inset-0 z-40 bg-[#0f172a]/95 backdrop-blur-md pt-14">
          <div className="p-4 space-y-4">
            {isLoggedIn ? (
              <>
                <Link href="/vendor/dashboard">
                  <Button className="w-full bg-blue-600" data-testid="link-back-dashboard">
                    Voltar para o Painel
                  </Button>
                </Link>
                <Link href="/vendor/my-purchases">
                  <Button variant="outline" className="w-full border-gray-700 text-white" data-testid="link-my-purchases">
                    Minhas Compras
                  </Button>
                </Link>
              </>
            ) : (
              <>
                <Link href="/login">
                  <Button variant="outline" className="w-full border-gray-700 text-white" data-testid="link-login">
                    Entrar
                  </Button>
                </Link>
                <Link href="/register">
                  <Button className="w-full bg-blue-600" data-testid="link-register">
                    Criar Conta
                  </Button>
                </Link>
              </>
            )}
          </div>
        </div>
      )}

      <section className="relative py-8 px-2 text-center overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-blue-600/10 to-transparent" />
        <div className="relative max-w-2xl mx-auto">
          <h1 className="text-2xl md:text-4xl font-bold text-white mb-2">
            Comprar e Vender
          </h1>
          <p className="text-sm text-gray-400 mb-4">
            contas, jogos, gift cards e muito mais
          </p>
          <Button 
            className="bg-blue-600 text-white px-6 py-3 text-sm font-semibold rounded-lg"
            data-testid="button-how-it-works"
            onClick={() => document.getElementById('como-funciona')?.scrollIntoView({ behavior: 'smooth' })}
          >
            <Play className="w-4 h-4 mr-1.5" />
            COMO FUNCIONA?
          </Button>
        </div>
      </section>

      <section className="px-2 md:px-4 py-4 md:py-6">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-base md:text-xl font-bold text-white mb-3 md:mb-5 flex items-center gap-2 px-1">
            Categorias
            <ChevronRight className="w-4 h-4 text-gray-500" />
          </h2>
          <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 gap-3 md:gap-4">
            {displayCategories.map((cat) => {
              const imageSrc = categoryImages[cat.slug.toLowerCase()] || categoryImages.default;
              const isSelected = selectedCategory === cat.name;
              return (
                <div 
                  key={`cat-${cat.id}`}
                  className={`text-center cursor-pointer group ${isSelected ? 'ring-2 ring-blue-500 rounded-xl' : ''}`}
                  onClick={() => handleCategoryClick(cat.name)}
                  data-testid={`category-${cat.slug}`}
                >
                  <div className={`w-full aspect-square rounded-xl overflow-hidden mb-2 border-2 ${isSelected ? 'border-blue-500' : 'border-transparent group-hover:border-blue-500'} transition-colors`}>
                    <img 
                      src={imageSrc} 
                      alt={cat.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <span className={`text-xs md:text-sm ${isSelected ? 'text-blue-400 font-semibold' : 'text-gray-400 group-hover:text-white'} transition-colors line-clamp-2`}>
                    {cat.name}
                  </span>
                </div>
              );
            })}
          </div>

          {selectedCategory && availableSubcategories.length > 0 && (
            <div className="mt-3 px-1">
              <h3 className="text-sm font-semibold text-gray-300 mb-2">
                Subcategorias de {selectedCategory}:
              </h3>
              <div className="flex gap-2 flex-wrap">
                {availableSubcategories.map((sub) => {
                  const isSubSelected = selectedSubcategory === sub;
                  return (
                    <button
                      key={sub}
                      onClick={() => handleSubcategoryClick(sub)}
                      className={`px-3 py-1.5 text-xs rounded-full transition-colors ${
                        isSubSelected 
                          ? 'bg-blue-600 text-white' 
                          : 'bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-white'
                      }`}
                      data-testid={`subcategory-${sub.toLowerCase().replace(/\s+/g, '-')}`}
                    >
                      {sub}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </section>

      {(selectedCategory || selectedSubcategory) && (
        <section className="px-2 py-4">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-center justify-between mb-3 px-1">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                {selectedSubcategory || selectedCategory}
                <span className="text-sm text-gray-400">({filteredProducts.length} produtos)</span>
              </h2>
              <button
                onClick={() => {
                  setSelectedCategory(null);
                  setSelectedSubcategory(null);
                }}
                className="text-xs text-gray-400 hover:text-white"
                data-testid="button-clear-filters"
              >
                Limpar filtros
              </button>
            </div>
            {filteredProducts.length > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
                {filteredProducts.map((product) => (
                  <ProductCardMini key={product.id} product={product} stats={product.seller?.id ? sellerStats[product.seller.id] : undefined} />
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-gray-400">Nenhum produto encontrado nesta categoria.</p>
              </div>
            )}
          </div>
        </section>
      )}

      {steamProducts.length > 0 && (
        <section className="px-2 py-4">
          <div className="max-w-7xl mx-auto">
            <h2 className="text-lg font-bold text-white mb-3 flex items-center gap-2 px-1">
              <span className="text-blue-500">Steam</span>
              <ChevronRight className="w-4 h-4 text-gray-500" />
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
              {steamProducts.map((product) => (
                <ProductCardMini key={product.id} product={product} stats={product.seller?.id ? sellerStats[product.seller.id] : undefined} />
              ))}
            </div>
          </div>
        </section>
      )}

      {subscriptionProducts.length > 0 && (
        <section className="px-2 py-4">
          <div className="max-w-7xl mx-auto">
            <h2 className="text-lg font-bold text-white mb-3 flex items-center gap-2 px-1">
              <span className="text-purple-500">Assinaturas e Premium</span>
              <ChevronRight className="w-4 h-4 text-gray-500" />
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
              {subscriptionProducts.map((product) => (
                <ProductCardMini key={product.id} product={product} stats={product.seller?.id ? sellerStats[product.seller.id] : undefined} />
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="px-2 py-4">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-lg font-bold text-white mb-3 flex items-center gap-2 px-1">
            <Star className="w-4 h-4 text-yellow-500" />
            Em Destaque
            <ChevronRight className="w-4 h-4 text-gray-500" />
          </h2>
          {isLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="bg-[#1e293b] rounded-lg animate-pulse aspect-square" />
              ))}
            </div>
          ) : featuredProducts.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
              {featuredProducts.map((product) => (
                <ProductCardMini key={product.id} product={product} stats={product.seller?.id ? sellerStats[product.seller.id] : undefined} />
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <ShoppingCart className="w-10 h-10 mx-auto mb-3 opacity-50" />
              <p className="text-sm">Nenhum produto disponivel no momento</p>
            </div>
          )}
        </div>
      </section>

      <section className="px-4 py-12 bg-gradient-to-b from-[#0f172a] to-[#1e293b]/50" id="como-funciona">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-white text-center mb-2">
            Como Funciona?
          </h2>
          <p className="text-gray-400 text-center mb-8 text-sm">
            Entenda o processo de compra e venda na nossa plataforma
          </p>
          
          <div className="grid gap-6 md:grid-cols-2 mb-8">
            <div className="bg-[#1e293b] rounded-xl p-6 border border-blue-500/20">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center">
                  <ShoppingCart className="w-5 h-5 text-white" />
                </div>
                <h3 className="text-lg font-semibold text-white">Para Compradores</h3>
              </div>
              <ol className="space-y-3 text-sm">
                <li className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center text-xs font-bold flex-shrink-0">1</span>
                  <span className="text-gray-300">Escolha o produto digital que deseja comprar</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center text-xs font-bold flex-shrink-0">2</span>
                  <span className="text-gray-300">Faca o pagamento via PIX ou Cartao (processado na hora)</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center text-xs font-bold flex-shrink-0">3</span>
                  <span className="text-gray-300">Receba automaticamente os dados de acesso na tela e por e-mail</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-green-500/20 text-green-400 flex items-center justify-center text-xs font-bold flex-shrink-0">
                    <Zap className="w-3 h-3" />
                  </span>
                  <span className="text-gray-300">Entrega instantanea - sem espera!</span>
                </li>
              </ol>
            </div>

            <div className="bg-[#1e293b] rounded-xl p-6 border border-purple-500/20">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-purple-600 flex items-center justify-center">
                  <User className="w-5 h-5 text-white" />
                </div>
                <h3 className="text-lg font-semibold text-white">Para Vendedores</h3>
              </div>
              <ol className="space-y-3 text-sm">
                <li className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-purple-500/20 text-purple-400 flex items-center justify-center text-xs font-bold flex-shrink-0">1</span>
                  <span className="text-gray-300">Crie sua conta gratuitamente e monte sua loja</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-purple-500/20 text-purple-400 flex items-center justify-center text-xs font-bold flex-shrink-0">2</span>
                  <span className="text-gray-300">Cadastre seus produtos digitais com estoque automatico</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-purple-500/20 text-purple-400 flex items-center justify-center text-xs font-bold flex-shrink-0">3</span>
                  <span className="text-gray-300">Vendas sao processadas automaticamente 24h por dia</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-green-500/20 text-green-400 flex items-center justify-center text-xs font-bold flex-shrink-0">
                    <Coins className="w-3 h-3" />
                  </span>
                  <span className="text-gray-300">Receba o valor das vendas diretamente na sua carteira</span>
                </li>
              </ol>
            </div>
          </div>
        </div>
      </section>

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

      <section className="px-4 py-12">
        <div className="max-w-2xl mx-auto text-center">
          {isLoggedIn ? (
            <>
              <h2 className="text-2xl font-bold text-white mb-4">
                Gerencie sua loja
              </h2>
              <p className="text-gray-400 mb-6">
                Acesse seu painel para gerenciar produtos e pedidos
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link href="/vendor/dashboard">
                  <Button size="lg" className="bg-blue-600 px-8" data-testid="button-cta-dashboard">
                    Ir para o Painel
                  </Button>
                </Link>
                <Link href="/vendor/my-purchases">
                  <Button size="lg" variant="outline" className="border-gray-700 text-white px-8" data-testid="button-cta-purchases">
                    Ver Minhas Compras
                  </Button>
                </Link>
              </div>
            </>
          ) : (
            <>
              <h2 className="text-2xl font-bold text-white mb-4">
                Quer vender seus produtos?
              </h2>
              <p className="text-gray-400 mb-6">
                Crie sua conta e comece a vender hoje mesmo
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link href="/register">
                  <Button size="lg" className="bg-blue-600 px-8" data-testid="button-cta-register">
                    Criar Conta Gratis
                  </Button>
                </Link>
                <Link href="/login">
                  <Button size="lg" variant="outline" className="border-gray-700 text-white px-8" data-testid="button-cta-login">
                    Ja tenho conta
                  </Button>
                </Link>
              </div>
            </>
          )}
        </div>
      </section>

      <footer className="border-t border-white/5 py-8 px-4">
        <div className="max-w-7xl mx-auto text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <img src={nexStoreLogo} alt="ELITEVAULT" className="w-6 h-6 rounded" />
            <span className="font-bold text-white">ELITEVAULT</span>
          </div>
          <p className="text-sm text-gray-500">
            2024 ELITEVAULT. Todos os direitos reservados.
          </p>
        </div>
      </footer>
    </div>
  );
}

function ProductCardMini({ product, stats }: { product: ProductWithSeller; stats?: { averageRating: number; totalReviews: number } }) {
  const stockLines = product.stock?.split("\n").filter((line) => line.trim()) || [];
  const hasStock = stockLines.length > 0;
  const sellerName = product.seller?.storeName || product.seller?.name || "Vendedor";
  const sellerInitial = sellerName.charAt(0).toUpperCase();
  const [, setLocation] = useLocation();
  const [imgError, setImgError] = useState(false);

  const handleSellerClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (product.seller?.slug) {
      setLocation(`/loja/${product.seller.slug}`);
    }
  };

  return (
    <Link href={`/product/${product.id}`}>
      <div 
        className="bg-[#1e293b] rounded-lg overflow-hidden cursor-pointer group"
        data-testid={`card-product-${product.id}`}
      >
        <div className="aspect-video relative overflow-hidden bg-gray-900">
          {product.imageUrl && !imgError ? (
            <img 
              src={product.imageUrl} 
              alt={product.name}
              className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300"
              onError={() => setImgError(true)}
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-blue-900/50 to-slate-800 flex items-center justify-center">
              <Package className="w-8 h-8 text-gray-600" />
            </div>
          )}
          {!hasStock && (
            <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
              <span className="text-white text-[10px] font-medium bg-red-500 px-1.5 py-0.5 rounded">Esgotado</span>
            </div>
          )}
        </div>

        <div className="p-2">
          <h3 className="text-xs font-medium text-white line-clamp-2 min-h-[2rem] mb-1" data-testid={`text-product-name-${product.id}`}>
            {product.name}
          </h3>
          
          <div className="flex items-center justify-between gap-1 mb-1">
            <span className="text-sm font-bold text-blue-500" data-testid={`text-price-${product.id}`}>
              R$ {Number(product.currentPrice).toFixed(2)}
            </span>
            {stats && stats.totalReviews > 0 && (
              <div className="flex items-center gap-0.5" data-testid={`rating-${product.id}`}>
                <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
                <span className="text-[10px] text-gray-400">{stats.averageRating}</span>
              </div>
            )}
          </div>

          <div 
            className="flex items-center gap-1.5 cursor-pointer hover:opacity-80 transition-opacity"
            data-testid={`seller-${product.id}`}
            onClick={handleSellerClick}
          >
            <Avatar className="w-4 h-4">
              {product.seller?.logoUrl ? (
                <AvatarImage src={product.seller.logoUrl} alt={sellerName} />
              ) : null}
              <AvatarFallback className="text-[8px] bg-blue-600 text-white">
                {sellerInitial}
              </AvatarFallback>
            </Avatar>
            <p className="text-[10px] text-gray-400 truncate hover:text-blue-400 transition-colors">
              {sellerName}
            </p>
          </div>
        </div>
      </div>
    </Link>
  );
}
