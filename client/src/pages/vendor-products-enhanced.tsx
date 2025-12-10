import { useState, useMemo, useRef } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Plus, Trash2, Edit2, Loader2, Upload, Image, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Product, Category, ProductVariant } from "@shared/schema";

interface VariantFormData {
  id?: number;
  name: string;
  price: string;
  stock: string;
}

function getAuthHeaders(): HeadersInit {
  const vendorToken = localStorage.getItem("vendor_token");
  if (vendorToken) {
    return { Authorization: `Bearer ${vendorToken}` };
  }
  const adminToken = localStorage.getItem("admin_token");
  if (adminToken) {
    return { Authorization: `Bearer ${adminToken}` };
  }
  return {};
}

function ProductCardWithVariants({ 
  product, 
  onEdit, 
  onDelete, 
  isDeleting 
}: { 
  product: Product; 
  onEdit: (product: Product) => void; 
  onDelete: (id: number) => void; 
  isDeleting: boolean;
}) {
  const isDynamicMode = product.dynamicMode === true;
  
  const { data: variants = [] } = useQuery<ProductVariant[]>({
    queryKey: ["/api/products", product.id, "variants"],
    queryFn: async () => {
      const response = await fetch(`/api/products/${product.id}/variants`, {
        headers: getAuthHeaders(),
      });
      if (!response.ok) return [];
      return response.json();
    },
    enabled: isDynamicMode,
  });

  const activeVariants = variants.filter((v) => v.active !== false);
  
  const getStockInfo = () => {
    if (isDynamicMode) {
      let totalStock = 0;
      activeVariants.forEach((v) => {
        const lines = v.stock?.split("\n").filter((line) => line.trim()) || [];
        totalStock += lines.length;
      });
      return { stockCount: totalStock, variantCount: activeVariants.length };
    }
    const stockLines = product.stock?.split('\n').filter(line => line.trim()) || [];
    return { stockCount: stockLines.length, variantCount: 0 };
  };

  const { stockCount, variantCount } = getStockInfo();

  const getPriceRange = () => {
    if (isDynamicMode && activeVariants.length > 0) {
      const prices = activeVariants.map(v => parseFloat(v.price as any));
      const minPrice = Math.min(...prices);
      const maxPrice = Math.max(...prices);
      if (minPrice === maxPrice) {
        return `R$ ${minPrice.toFixed(2)}`;
      }
      return `R$ ${minPrice.toFixed(2)} - R$ ${maxPrice.toFixed(2)}`;
    }
    return `R$ ${parseFloat(product.currentPrice as any).toFixed(2)}`;
  };

  return (
    <Card
      className="overflow-hidden"
      style={{
        background: "rgba(30, 30, 30, 0.4)",
        backdropFilter: "blur(12px)",
        border: "1px solid rgba(255, 255, 255, 0.1)",
      }}
      data-testid={`card-product-${product.id}`}
    >
      {product.imageUrl && (
        <div className="aspect-square overflow-hidden relative">
          <img 
            src={product.imageUrl} 
            alt={product.name}
            className="w-full h-full object-contain bg-gray-900"
          />
          {isDynamicMode && (
            <div className="absolute top-2 right-2 bg-purple-600 text-white text-xs px-2 py-1 rounded">
              Variantes
            </div>
          )}
        </div>
      )}
      
      <div className="p-3">
        <h3 className="text-white text-sm font-semibold line-clamp-1 mb-1">{product.name}</h3>
        
        <div className="flex items-baseline gap-2 mb-2 flex-wrap">
          <span className="text-green-400 font-bold text-sm">
            {getPriceRange()}
          </span>
          {!isDynamicMode && (
            <span className="text-gray-500 text-xs line-through">
              R$ {parseFloat(product.originalPrice as any).toFixed(2)}
            </span>
          )}
        </div>
        
        <div className="mb-3 flex flex-wrap gap-1">
          {isDynamicMode ? (
            <>
              <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-400">
                {variantCount} variante{variantCount !== 1 ? 's' : ''}
              </span>
              <span className={`text-xs px-2 py-0.5 rounded-full ${stockCount > 0 ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                {stockCount > 0 ? `${stockCount} em estoque` : 'Sem estoque'}
              </span>
            </>
          ) : (
            <span className={`text-xs px-2 py-0.5 rounded-full ${stockCount > 0 ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
              {stockCount > 0 ? `${stockCount} em estoque` : 'Sem estoque'}
            </span>
          )}
        </div>
        
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            className="flex-1 text-xs h-8"
            onClick={() => onEdit(product)}
            data-testid={`button-edit-product-${product.id}`}
          >
            <Edit2 className="w-3 h-3 mr-1" />
            Editar
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="flex-1 text-xs h-8 text-red-400 border-red-400/30 hover:bg-red-400/10"
            onClick={() => onDelete(product.id)}
            disabled={isDeleting}
            data-testid={`button-delete-product-${product.id}`}
          >
            <Trash2 className="w-3 h-3 mr-1" />
            Deletar
          </Button>
        </div>
      </div>
    </Card>
  );
}

export function VendorProductsEnhanced({ vendorId }: { vendorId: number }) {
  const { toast } = useToast();
  const [isAddingProduct, setIsAddingProduct] = useState(false);
  const [editingProductId, setEditingProductId] = useState<number | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<number | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [dynamicMode, setDynamicMode] = useState(false);
  const [variants, setVariants] = useState<VariantFormData[]>([]);
  const [formData, setFormData] = useState({
    name: "",
    price: "",
    originalPrice: "",
    description: "",
    imageUrl: "",
    stock: "",
    category: "",
    subcategory: "",
    deliveryContent: "",
  });

  const { data: products = [], isLoading, refetch } = useQuery<Product[]>({
    queryKey: ["/api/vendor/products", vendorId],
    queryFn: async () => {
      console.log("[VendorProducts] Fetching products for vendor:", vendorId);
      // Adiciona timestamp para forçar bypass do cache do browser
      const timestamp = Date.now();
      const response = await fetch(`/api/vendor/products?vendorId=${vendorId}&_t=${timestamp}`, {
        headers: {
          ...getAuthHeaders(),
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
        credentials: "include",
        cache: 'no-store',
      });
      if (!response.ok) {
        console.error("[VendorProducts] Error fetching products:", response.status);
        throw new Error("Failed to fetch products");
      }
      const data = await response.json();
      console.log("[VendorProducts] Got products:", data.length, data);
      return data;
    },
    staleTime: 0,
    refetchOnMount: 'always',
    gcTime: 0,
  });

  const { data: allCategories = [] } = useQuery<Category[]>({
    queryKey: ["/api/categories/with-subcategories"],
    queryFn: async () => {
      const response = await fetch("/api/categories/with-subcategories");
      if (!response.ok) throw new Error("Failed to fetch categories");
      return response.json();
    },
  });

  const selectedCategory = useMemo(() => {
    return allCategories.find((cat) => cat.id === selectedCategoryId);
  }, [selectedCategoryId, allCategories]);

  const availableSubcategories = useMemo(() => {
    return selectedCategory?.subcategories || [];
  }, [selectedCategory]);

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const result = await apiRequest("POST", "/api/vendor/products", data);
      const productData = await result.json();
      
      // If dynamic mode, create variants
      if (data.dynamicMode && data.variants && data.variants.length > 0 && productData.id) {
        for (const variant of data.variants) {
          await apiRequest("POST", `/api/products/${productData.id}/variants`, {
            name: variant.name,
            price: variant.price,
            stock: variant.stock,
          });
        }
      }
      return productData;
    },
    onSuccess: async (productData: any) => {
      console.log("[createMutation] Produto criado, invalidando cache e refetching...");
      
      // Invalidar cache para forçar atualização da lista
      await queryClient.invalidateQueries({ queryKey: ["/api/vendor/products", vendorId] });
      await queryClient.invalidateQueries({ queryKey: ["/api/vendor/products"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/marketplace/products"] });
      // Invalidar cache de variantes do produto criado
      if (productData?.id) {
        await queryClient.invalidateQueries({ queryKey: ["/api/products", productData.id, "variants"] });
      }
      
      // Forçar refetch imediato
      await refetch();
      
      // Limpar formulário
      setIsAddingProduct(false);
      setSelectedCategoryId(null);
      setDynamicMode(false);
      setVariants([]);
      setFormData({ name: "", price: "", originalPrice: "", description: "", imageUrl: "", stock: "", category: "", subcategory: "", deliveryContent: "" });
      
      toast({
        title: "✓ Sucesso!",
        description: "Produto adicionado com sucesso!",
      });
    },
    onError: (error: any) => {
      console.error("[createMutation] Erro ao criar produto:", error);
      toast({
        title: "Erro",
        description: error?.message || "Não foi possível adicionar o produto",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (productId: number) => {
      return apiRequest("DELETE", `/api/vendor/products/${productId}`, null);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vendor/products", vendorId] });
      toast({
        title: "✓ Produto removido com sucesso",
      });
      setShowDeleteConfirm(null);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      const result = await apiRequest("PATCH", `/api/vendor/products/${editingProductId}`, data);
      
      // If dynamic mode, update variants
      if (editingProductId && data.dynamicMode !== undefined) {
        // Delete existing variants first if switching to non-dynamic mode
        // Or update them if still in dynamic mode
        if (data.dynamicMode && data.variants && data.variants.length > 0) {
          // For each variant, create or update
          for (const variant of data.variants) {
            if (variant.id) {
              // Update existing variant
              await apiRequest("PUT", `/api/products/${editingProductId}/variants/${variant.id}`, {
                name: variant.name,
                price: variant.price,
                stock: variant.stock,
              });
            } else {
              // Create new variant
              await apiRequest("POST", `/api/products/${editingProductId}/variants`, {
                name: variant.name,
                price: variant.price,
                stock: variant.stock,
              });
            }
          }
        }
      }
      return result;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/vendor/products", vendorId] });
      await queryClient.invalidateQueries({ queryKey: ["/api/marketplace/products"] });
      // Invalidar cache de variantes do produto editado
      if (editingProductId) {
        await queryClient.invalidateQueries({ queryKey: ["/api/products", editingProductId, "variants"] });
      }
      setEditingProductId(null);
      setSelectedCategoryId(null);
      setDynamicMode(false);
      setVariants([]);
      setFormData({ name: "", price: "", originalPrice: "", description: "", imageUrl: "", stock: "", category: "", subcategory: "", deliveryContent: "" });
      toast({
        title: "✓ Produto atualizado com sucesso",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error?.message || "Não foi possível atualizar o produto",
        variant: "destructive",
      });
    },
  });

  const handleAddProduct = () => {
    // Validate based on mode - for dynamic mode, name and at least 1 variant are required
    if (dynamicMode) {
      if (!formData.name) {
        toast({
          title: "Campo obrigatório",
          description: "Nome do produto é necessário",
          variant: "destructive",
        });
        return;
      }
      // Validate at least 1 variant exists with name and price
      const validVariants = variants.filter(v => v.name && v.name.trim() && v.price && v.price.trim());
      if (validVariants.length === 0) {
        toast({
          title: "Variante obrigatória",
          description: "Produtos dinâmicos precisam de pelo menos 1 variante com nome e preço",
          variant: "destructive",
        });
        return;
      }
      // Validate all variants with name have price
      for (const v of variants) {
        if (v.name && v.name.trim() && (!v.price || !v.price.trim())) {
          toast({
            title: "Preencha o preço do item",
            description: "Cada variante precisa de nome e preço",
            variant: "destructive",
          });
          return;
        }
      }
    } else {
      if (!formData.name || !formData.price || !formData.originalPrice) {
        toast({
          title: "Campos obrigatórios",
          description: "Nome, preço e preço original são necessários",
          variant: "destructive",
        });
        return;
      }
      if (!formData.stock) {
        toast({
          title: "Estoque obrigatório",
          description: "Lista de estoque é necessária",
          variant: "destructive",
        });
        return;
      }
    }

    createMutation.mutate({
      name: formData.name,
      description: formData.description,
      imageUrl: formData.imageUrl || "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400",
      currentPrice: formData.price,
      originalPrice: formData.originalPrice,
      stock: dynamicMode ? "" : formData.stock,
      deliveryContent: formData.deliveryContent,
      category: formData.category || "Outros",
      subcategory: formData.subcategory || null,
      resellerId: vendorId,
      dynamicMode: dynamicMode,
      variants: dynamicMode ? variants : [],
    });
  };

  const handleEditProduct = async (product: Product) => {
    setEditingProductId(product.id);
    // Find the category ID by name to set selectedCategoryId
    const matchingCat = allCategories.find((c) => c.name === product.category);
    setSelectedCategoryId(matchingCat?.id || null);
    setDynamicMode(product.dynamicMode || false);
    setFormData({
      name: product.name,
      price: product.currentPrice.toString(),
      originalPrice: product.originalPrice.toString(),
      description: product.description || "",
      imageUrl: product.imageUrl || "",
      stock: product.stock || "",
      category: product.category || "",
      subcategory: product.subcategory || "",
      deliveryContent: product.deliveryContent || "",
    });
    
    // Load variants if dynamic mode
    if (product.dynamicMode) {
      try {
        const response = await fetch(`/api/products/${product.id}/variants`, {
          headers: getAuthHeaders(),
        });
        if (response.ok) {
          const variantsData: ProductVariant[] = await response.json();
          setVariants(variantsData.map(v => ({
            id: v.id,
            name: v.name,
            price: v.price.toString(),
            stock: v.stock || "",
          })));
        }
      } catch (error) {
        console.error("Error loading variants:", error);
      }
    } else {
      setVariants([]);
    }
  };

  const handleSaveEdit = () => {
    // Validate based on mode - for dynamic mode, name and at least 1 variant are required
    if (dynamicMode) {
      if (!formData.name) {
        toast({
          title: "Campo obrigatório",
          description: "Nome do produto é necessário",
          variant: "destructive",
        });
        return;
      }
      // Validate at least 1 variant exists with name and price
      const validVariants = variants.filter(v => v.name && v.name.trim() && v.price && v.price.trim());
      if (validVariants.length === 0) {
        toast({
          title: "Variante obrigatória",
          description: "Produtos dinâmicos precisam de pelo menos 1 variante com nome e preço",
          variant: "destructive",
        });
        return;
      }
      // Validate all variants with name have price
      for (const v of variants) {
        if (v.name && v.name.trim() && (!v.price || !v.price.trim())) {
          toast({
            title: "Preencha o preço do item",
            description: "Cada variante precisa de nome e preço",
            variant: "destructive",
          });
          return;
        }
      }
    } else {
      if (!formData.name || !formData.price || !formData.originalPrice) {
        toast({
          title: "Campos obrigatórios",
          description: "Nome, preço e preço original são necessários",
          variant: "destructive",
        });
        return;
      }
      if (!formData.stock) {
        toast({
          title: "Estoque obrigatório",
          description: "Lista de estoque é necessária",
          variant: "destructive",
        });
        return;
      }
    }

    updateMutation.mutate({
      name: formData.name,
      description: formData.description,
      imageUrl: formData.imageUrl,
      currentPrice: formData.price,
      originalPrice: formData.originalPrice,
      stock: dynamicMode ? "" : formData.stock,
      deliveryContent: formData.deliveryContent,
      category: formData.category || "Outros",
      subcategory: formData.subcategory || null,
      dynamicMode: dynamicMode,
      variants: dynamicMode ? variants : [],
    });
  };

  // Variant management functions
  const addVariant = () => {
    setVariants([...variants, { name: "", price: "", stock: "" }]);
  };

  const updateVariant = (index: number, field: keyof VariantFormData, value: string) => {
    const newVariants = [...variants];
    newVariants[index] = { ...newVariants[index], [field]: value };
    setVariants(newVariants);
  };

  const removeVariant = async (index: number) => {
    const variant = variants[index];
    // If variant has ID, delete from server
    if (variant.id && editingProductId) {
      try {
        await apiRequest("DELETE", `/api/products/${editingProductId}/variants/${variant.id}`, null);
      } catch (error) {
        console.error("Error deleting variant:", error);
      }
    }
    setVariants(variants.filter((_, i) => i !== index));
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const uploadFormData = new FormData();
    uploadFormData.append("image", file);

    const vendorToken = localStorage.getItem("vendor_token");
    const adminToken = localStorage.getItem("admin_token");
    const token = adminToken || vendorToken;

    try {
      const response = await fetch("/api/upload", {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: uploadFormData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Erro ao fazer upload");
      }

      const data = await response.json();
      setFormData({ ...formData, imageUrl: data.imageUrl });
      toast({
        title: "Imagem enviada com sucesso",
      });
    } catch (error: any) {
      toast({
        title: "Erro ao enviar imagem",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-col sm:flex-row gap-4">
        <h1 className="text-3xl font-bold text-white">Meus Produtos</h1>
        <Button
          onClick={() => setIsAddingProduct(!isAddingProduct)}
          className="w-full sm:w-auto flex items-center gap-2"
          style={{
            background: "linear-gradient(135deg, #3b82f6 0%, #8b5cf6 50%, #ec4899 100%)",
            color: "#FFFFFF",
            border: "1px solid rgba(255, 255, 255, 0.2)",
          }}
          data-testid="button-add-product-modal"
        >
          <Plus className="w-4 h-4" />
          Novo Produto
        </Button>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteConfirm !== null} onOpenChange={() => setShowDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogTitle>Deletar Produto?</AlertDialogTitle>
          <AlertDialogDescription>
            Tem certeza que deseja deletar este produto? Esta ação não pode ser desfeita.
          </AlertDialogDescription>
          <div className="flex gap-2 justify-end">
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (showDeleteConfirm) {
                  deleteMutation.mutate(showDeleteConfirm);
                }
              }}
              className="bg-red-600 hover:bg-red-700"
            >
              Deletar
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      {/* Add/Edit Product Form */}
      {(isAddingProduct || editingProductId) && (
        <Card
          style={{
            background: "rgba(30, 30, 30, 0.4)",
            backdropFilter: "blur(12px)",
            border: "1px solid rgba(255, 255, 255, 0.1)",
          }}
        >
          <CardHeader>
            <CardTitle className="text-white">{editingProductId ? "Editar Produto" : "Novo Produto"}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Dynamic Mode Toggle - First */}
            <div className="flex items-center justify-between p-4 rounded-lg" style={{ background: "linear-gradient(135deg, rgba(139, 92, 246, 0.2), rgba(59, 130, 246, 0.2))", border: "1px solid rgba(139, 92, 246, 0.3)" }}>
              <div className="space-y-1">
                <Label className="text-white font-semibold">Modo Dinâmico (Revenda)</Label>
                <p className="text-xs text-gray-300">Ative para vender múltiplos itens com preços individuais nas variantes</p>
              </div>
              <Switch
                checked={dynamicMode}
                onCheckedChange={(checked) => {
                  setDynamicMode(checked);
                }}
                data-testid="switch-dynamic-mode"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-white">Nome do Produto *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Ex: Netflix Premium"
                style={{
                  background: "rgba(30, 30, 40, 0.4)",
                  backdropFilter: "blur(10px)",
                  borderColor: "rgba(255,255,255,0.1)",
                  color: "#FFFFFF",
                }}
                data-testid="input-product-name"
              />
            </div>

            {!dynamicMode && (
              <div className="space-y-2">
                <Label className="text-white">Preço Final (R$) *</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                  placeholder="99.90"
                  style={{
                    background: "rgba(30, 30, 40, 0.4)",
                    backdropFilter: "blur(10px)",
                    borderColor: "rgba(255,255,255,0.1)",
                    color: "#FFFFFF",
                  }}
                  data-testid="input-product-price"
                />
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-white">Categoria *</Label>
                <Select
                  value={selectedCategoryId ? String(selectedCategoryId) : ""}
                  onValueChange={(value) => {
                    const catId = parseInt(value);
                    setSelectedCategoryId(catId);
                    const cat = allCategories.find((c) => c.id === catId);
                    setFormData({ ...formData, category: cat?.name || "", subcategory: "" });
                  }}
                >
                  <SelectTrigger
                    className="w-full"
                    style={{
                      background: "rgba(30, 30, 40, 0.4)",
                      backdropFilter: "blur(10px)",
                      borderColor: "rgba(255,255,255,0.1)",
                      color: "#FFFFFF",
                    }}
                    data-testid="select-product-category"
                  >
                    <SelectValue placeholder="Selecione a categoria" />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-900 border-gray-700">
                    {allCategories.map((cat) => (
                      <SelectItem key={cat.id} value={String(cat.id)} className="text-white">
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-white">Subcategoria *</Label>
                <Select
                  value={formData.subcategory}
                  onValueChange={(value) => setFormData({ ...formData, subcategory: value })}
                  disabled={!selectedCategoryId || availableSubcategories.length === 0}
                >
                  <SelectTrigger
                    className="w-full"
                    style={{
                      background: "rgba(30, 30, 40, 0.4)",
                      backdropFilter: "blur(10px)",
                      borderColor: "rgba(255,255,255,0.1)",
                      color: "#FFFFFF",
                    }}
                    data-testid="select-product-subcategory"
                  >
                    <SelectValue placeholder={selectedCategoryId ? "Selecione a subcategoria" : "Escolha uma categoria primeiro"} />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-900 border-gray-700">
                    {availableSubcategories.map((sub) => (
                      <SelectItem key={sub} value={sub} className="text-white">
                        {sub}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {!dynamicMode && (
              <div className="space-y-2">
                <Label className="text-white">Preço Original (R$) *</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.originalPrice}
                  onChange={(e) => setFormData({ ...formData, originalPrice: e.target.value })}
                  placeholder="199.90"
                  style={{
                    background: "rgba(30, 30, 40, 0.4)",
                    backdropFilter: "blur(10px)",
                    borderColor: "rgba(255,255,255,0.1)",
                    color: "#FFFFFF",
                  }}
                  data-testid="input-product-original-price"
                />
              </div>
            )}

            <div className="space-y-2">
              <Label className="text-white">Descrição</Label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Descrição do produto"
                className="w-full p-3 rounded-lg text-white resize-none"
                rows={3}
                style={{
                  background: "rgba(30, 30, 40, 0.4)",
                  backdropFilter: "blur(10px)",
                  borderColor: "rgba(255,255,255,0.1)",
                  border: "1px solid rgba(255,255,255,0.1)",
                }}
                data-testid="textarea-product-description"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-white">Imagem do Produto</Label>
              <div className="flex flex-col gap-3">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleImageUpload}
                  accept="image/jpeg,image/png,image/gif,image/webp"
                  className="hidden"
                  data-testid="input-product-image-file"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="w-full flex items-center justify-center gap-2"
                  style={{
                    background: "rgba(30, 30, 40, 0.4)",
                    backdropFilter: "blur(10px)",
                    borderColor: "rgba(255,255,255,0.2)",
                    color: "#FFFFFF",
                  }}
                  data-testid="button-upload-image"
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Enviando...
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4" />
                      Carregar Imagem do Celular
                    </>
                  )}
                </Button>
                {formData.imageUrl && (
                  <div className="flex items-center gap-2 p-2 rounded-lg" style={{ background: "rgba(30, 30, 40, 0.4)" }}>
                    <img
                      src={formData.imageUrl}
                      alt="Preview"
                      className="w-12 h-12 object-contain bg-gray-900 rounded"
                    />
                    <span className="text-green-400 text-sm flex-1 truncate">Imagem carregada</span>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => setFormData({ ...formData, imageUrl: "" })}
                      className="text-red-400"
                      data-testid="button-remove-image"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                )}
              </div>
            </div>

            {/* Conditional: Dynamic Mode Variants OR Normal Stock */}
            {dynamicMode ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-white font-semibold">Itens/Variantes</Label>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={addVariant}
                    className="flex items-center gap-1"
                    data-testid="button-add-variant"
                  >
                    <Plus className="w-3 h-3" />
                    Adicionar Item
                  </Button>
                </div>
                
                {variants.map((variant, index) => (
                  <div
                    key={index}
                    className="p-4 rounded-lg space-y-3"
                    style={{ background: "rgba(20, 20, 30, 0.6)", border: "1px solid rgba(255,255,255,0.1)" }}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-400">Item #{index + 1}</span>
                      {variants.length > 1 && (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => removeVariant(index)}
                          className="text-red-400 h-6 px-2"
                          data-testid={`button-remove-variant-${index}`}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      )}
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs text-gray-400">Nome do Item *</Label>
                        <Input
                          value={variant.name}
                          onChange={(e) => updateVariant(index, "name", e.target.value)}
                          placeholder="Ex: 30 dias"
                          style={{
                            background: "rgba(30, 30, 40, 0.4)",
                            borderColor: "rgba(255,255,255,0.1)",
                            color: "#FFFFFF",
                          }}
                          data-testid={`input-variant-name-${index}`}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-gray-400">Preço (R$) *</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={variant.price}
                          onChange={(e) => updateVariant(index, "price", e.target.value)}
                          placeholder="19.90"
                          style={{
                            background: "rgba(30, 30, 40, 0.4)",
                            borderColor: "rgba(255,255,255,0.1)",
                            color: "#FFFFFF",
                          }}
                          data-testid={`input-variant-price-${index}`}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-gray-400">Estoque</Label>
                        <Input
                          value={variant.stock}
                          onChange={(e) => updateVariant(index, "stock", e.target.value)}
                          placeholder="Quantidade ou código"
                          style={{
                            background: "rgba(30, 30, 40, 0.4)",
                            borderColor: "rgba(255,255,255,0.1)",
                            color: "#FFFFFF",
                          }}
                          data-testid={`input-variant-stock-${index}`}
                        />
                      </div>
                    </div>
                  </div>
                ))}
                
                <p className="text-xs text-gray-400">
                  Cada item aparecerá como opção no dropdown "Escolha um item" para o cliente
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <Label className="text-white">Lista de Estoque (Cole um item por linha) *</Label>
                <textarea
                  value={formData.stock}
                  onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
                  placeholder="user1@gmail.com
password123
https://link-acesso.com
Chave123456"
                  className="w-full p-3 rounded-lg text-white resize-none font-mono text-sm"
                  rows={6}
                  style={{
                    background: "rgba(30, 30, 40, 0.4)",
                    backdropFilter: "blur(10px)",
                    borderColor: "rgba(255,255,255,0.1)",
                    border: "1px solid rgba(255,255,255,0.1)",
                  }}
                  data-testid="textarea-product-stock"
                />
                <div className="text-xs text-gray-400 space-y-1">
                  <p>Quantidade de estoque: <span className="text-green-400 font-bold">{formData.stock.trim() ? formData.stock.split('\n').filter(line => line.trim()).length : 0} unidade(s)</span></p>
                  <p>Cada linha será entregue a um cliente diferente (Sistema FIFO)</p>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label className="text-white">Conteúdo de Entrega (Link/Dados) *</Label>
              <textarea
                value={formData.deliveryContent}
                onChange={(e) => setFormData({ ...formData, deliveryContent: e.target.value })}
                placeholder="Ex: https://link-de-download.com/arquivo.zip\nSenha: 123456\nOu dados de acesso..."
                className="w-full p-3 rounded-lg text-white resize-none"
                rows={3}
                style={{
                  background: "rgba(30, 30, 40, 0.4)",
                  backdropFilter: "blur(10px)",
                  borderColor: "rgba(255,255,255,0.1)",
                  border: "1px solid rgba(255,255,255,0.1)",
                }}
                data-testid="textarea-delivery-content"
              />
              <p className="text-xs text-gray-400">Este conteúdo será oculto na loja, entregue apenas após pagamento confirmado</p>
            </div>

            <div className="flex gap-2 flex-col sm:flex-row">
              <Button
                onClick={editingProductId ? handleSaveEdit : handleAddProduct}
                disabled={editingProductId ? updateMutation.isPending : createMutation.isPending}
                style={{
                  background: "linear-gradient(135deg, #3b82f6 0%, #8b5cf6 50%, #ec4899 100%)",
                  color: "#FFFFFF",
                }}
                data-testid="button-save-product"
              >
                {editingProductId 
                  ? (updateMutation.isPending ? "Atualizando..." : "Atualizar Produto")
                  : (createMutation.isPending ? "Salvando..." : "Salvar Produto")}
              </Button>
              <Button
                onClick={() => {
                  setIsAddingProduct(false);
                  setEditingProductId(null);
                  setFormData({ name: "", price: "", originalPrice: "", description: "", imageUrl: "", stock: "", category: "", subcategory: "", deliveryContent: "" });
                }}
                variant="outline"
                data-testid="button-cancel-product"
              >
                Cancelar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Products Grid */}
      {products.length === 0 ? (
        <Card
          style={{
            background: "rgba(30, 30, 30, 0.4)",
            backdropFilter: "blur(12px)",
            border: "1px solid rgba(255, 255, 255, 0.1)",
          }}
        >
          <CardContent className="text-center py-12">
            <p className="text-gray-400 mb-4">Nenhum produto cadastrado ainda</p>
            <Button
              onClick={() => setIsAddingProduct(true)}
              variant="outline"
              data-testid="button-add-first-product"
            >
              Adicionar Primeiro Produto
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {products.map((product) => (
            <ProductCardWithVariants 
              key={product.id} 
              product={product} 
              onEdit={handleEditProduct}
              onDelete={(id) => setShowDeleteConfirm(id)}
              isDeleting={deleteMutation.isPending}
            />
          ))}
        </div>
      )}
    </div>
  );
}
