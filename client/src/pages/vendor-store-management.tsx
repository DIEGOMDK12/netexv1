import { useState, useMemo, useRef, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { 
  Plus, Trash2, Edit2, Loader2, Upload, ChevronDown, ChevronUp,
  GripVertical, FolderOpen, Eye, EyeOff, Package, X, Image, Star
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogFooter 
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Product, Category } from "@shared/schema";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface VendorStoreManagementProps {
  vendorId: number;
  verificationStatus?: string | null;
}

export function VendorStoreManagement({ vendorId, verificationStatus }: VendorStoreManagementProps) {
  const isVerified = verificationStatus === "approved";
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [expandedCategories, setExpandedCategories] = useState<Set<number>>(new Set());
  const [showProductModal, setShowProductModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [showDeleteProductConfirm, setShowDeleteProductConfirm] = useState<number | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const [productForm, setProductForm] = useState({
    name: "",
    slug: "",
    description: "",
    imageUrl: "",
    currentPrice: "",
    originalPrice: "",
    stock: "",
    categoryId: "",
    subcategory: "",
    active: true,
    limitPerUser: false,
    isPremium: false,
  });

  // Fetch vendor categories for organizing products
  const { data: categories = [], isLoading: loadingCategories } = useQuery<Category[]>({
    queryKey: ["/api/vendor/categories"],
    queryFn: async () => {
      const token = localStorage.getItem("vendor_token");
      const response = await fetch("/api/vendor/categories", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error("Failed to fetch categories");
      return response.json();
    },
  });

  // Fetch global marketplace categories for product dropdown
  const { data: marketplaceCategories = [] } = useQuery<Category[]>({
    queryKey: ["/api/categories"],
    queryFn: async () => {
      const response = await fetch("/api/categories");
      if (!response.ok) throw new Error("Failed to fetch marketplace categories");
      const data = await response.json();
      // Filter only active global categories (resellerId = null)
      return data.filter((cat: Category) => cat.active && !cat.resellerId);
    },
  });

  // Get subcategories for selected category
  const selectedCategory = useMemo(() => {
    return marketplaceCategories.find(cat => cat.id.toString() === productForm.categoryId);
  }, [marketplaceCategories, productForm.categoryId]);

  const { data: products = [], isLoading: loadingProducts } = useQuery<Product[]>({
    queryKey: ["/api/vendor/products", vendorId],
    queryFn: async () => {
      const response = await fetch(`/api/vendor/products?vendorId=${vendorId}`);
      if (!response.ok) throw new Error("Failed to fetch products");
      return response.json();
    },
  });

  const productsByCategory = useMemo(() => {
    const grouped: Record<number, Product[]> = {};
    const uncategorized: Product[] = [];
    
    products.forEach((product) => {
      // Se o vendedor tem categorias locais, agrupa por elas
      // Caso contrário, todos os produtos vão para "sem categoria"
      if (categories.length > 0 && product.categoryId) {
        // Verificar se existe uma categoria do vendedor com esse ID
        const hasVendorCategory = categories.some(cat => cat.id === product.categoryId);
        if (hasVendorCategory) {
          if (!grouped[product.categoryId]) {
            grouped[product.categoryId] = [];
          }
          grouped[product.categoryId].push(product);
        } else {
          // Produto tem categoryId do marketplace, mas vendedor não tem essa categoria local
          uncategorized.push(product);
        }
      } else {
        uncategorized.push(product);
      }
    });

    return { grouped, uncategorized };
  }, [products, categories]);

  const reorderCategoriesMutation = useMutation({
    mutationFn: async (orderedIds: number[]) => {
      const token = localStorage.getItem("vendor_token");
      const response = await fetch("/api/vendor/categories/reorder", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ orderedIds }),
      });
      if (!response.ok) throw new Error("Failed to reorder categories");
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Ordem das categorias atualizada" });
    },
    onError: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vendor/categories"] });
      toast({ title: "Erro ao reordenar categorias", variant: "destructive" });
    },
  });

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = categories.findIndex((cat) => cat.id === active.id);
      const newIndex = categories.findIndex((cat) => cat.id === over.id);

      const newOrder = arrayMove(categories, oldIndex, newIndex);
      const orderedIds = newOrder.map((cat) => cat.id);
      
      queryClient.setQueryData<Category[]>(["/api/vendor/categories"], newOrder);
      
      reorderCategoriesMutation.mutate(orderedIds);
    }
  };

  const createProductMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("POST", "/api/vendor/products", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vendor/products", vendorId] });
      setShowProductModal(false);
      resetProductForm();
      toast({ title: "Produto criado com sucesso" });
    },
    onError: (error: any) => {
      toast({ 
        title: "Erro ao criar produto", 
        description: error?.message,
        variant: "destructive" 
      });
    },
  });

  const updateProductMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      return apiRequest("PATCH", `/api/vendor/products/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vendor/products", vendorId] });
      setShowProductModal(false);
      setEditingProduct(null);
      resetProductForm();
      toast({ title: "Produto atualizado com sucesso" });
    },
    onError: (error: any) => {
      toast({ 
        title: "Erro ao atualizar produto",
        description: error?.message,
        variant: "destructive" 
      });
    },
  });

  const deleteProductMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("DELETE", `/api/vendor/products/${id}`, null);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vendor/products", vendorId] });
      setShowDeleteProductConfirm(null);
      toast({ title: "Produto removido com sucesso" });
    },
    onError: () => {
      toast({ title: "Erro ao remover produto", variant: "destructive" });
    },
  });

  const resetProductForm = () => {
    setProductForm({
      name: "",
      slug: "",
      description: "",
      imageUrl: "",
      currentPrice: "",
      originalPrice: "",
      stock: "",
      categoryId: "",
      subcategory: "",
      active: true,
      limitPerUser: false,
      isPremium: false,
    });
  };

  // Auto-expand "SEM CATEGORIA" section when there are uncategorized products
  useEffect(() => {
    if (productsByCategory.uncategorized.length > 0 && !expandedCategories.has(-1)) {
      setExpandedCategories((prev) => {
        const next = new Set(prev);
        next.add(-1);
        return next;
      });
    }
  }, [productsByCategory.uncategorized.length]);

  const toggleCategory = (categoryId: number) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      return next;
    });
  };

  const collapseAll = () => {
    setExpandedCategories(new Set());
  };

  const expandAll = () => {
    setExpandedCategories(new Set(categories.map((c) => c.id)));
  };

  const openEditProduct = (product: Product) => {
    setEditingProduct(product);
    setProductForm({
      name: product.name,
      slug: product.slug || "",
      description: product.description || "",
      imageUrl: product.imageUrl || "",
      currentPrice: product.currentPrice?.toString() || "",
      originalPrice: product.originalPrice?.toString() || "",
      stock: product.stock || "",
      categoryId: product.categoryId?.toString() || "",
      subcategory: (product as any).subcategory || "",
      active: product.active ?? true,
      limitPerUser: product.limitPerUser ?? false,
      isPremium: (product as any).isPremium ?? false,
    });
    setShowProductModal(true);
  };

  const openNewProduct = (categoryId?: number) => {
    if (!isVerified) {
      toast({
        title: "Verificação necessária",
        description: "Sua conta precisa ser verificada para adicionar produtos",
        variant: "destructive",
      });
      return;
    }
    setEditingProduct(null);
    resetProductForm();
    if (categoryId) {
      setProductForm((prev) => ({ ...prev, categoryId: categoryId.toString() }));
    }
    setShowProductModal(true);
  };

  const handleSaveProduct = () => {
    if (!productForm.name.trim() || !productForm.currentPrice || !productForm.originalPrice) {
      toast({ 
        title: "Campos obrigatórios", 
        description: "Nome, preço e preço original são obrigatórios",
        variant: "destructive" 
      });
      return;
    }

    const slug = productForm.slug || productForm.name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");

    const selectedCat = marketplaceCategories.find(c => c.id === parseInt(productForm.categoryId));
    
    const data = {
      name: productForm.name,
      slug,
      description: productForm.description,
      imageUrl: productForm.imageUrl || "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400",
      currentPrice: productForm.currentPrice,
      originalPrice: productForm.originalPrice,
      stock: productForm.stock,
      category: selectedCat?.name || "Outros",
      categoryId: productForm.categoryId ? parseInt(productForm.categoryId) : null,
      subcategory: productForm.subcategory || null,
      active: productForm.active,
      limitPerUser: productForm.limitPerUser,
      isPremium: productForm.isPremium,
      resellerId: vendorId,
    };

    if (editingProduct) {
      updateProductMutation.mutate({ id: editingProduct.id, data });
    } else {
      createProductMutation.mutate(data);
    }
  };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const formData = new FormData();
    formData.append("image", file);

    try {
      const token = localStorage.getItem("vendor_token");
      const response = await fetch("/api/upload", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      if (!response.ok) throw new Error("Upload failed");
      
      const { imageUrl } = await response.json();
      setProductForm((prev) => ({ ...prev, imageUrl }));
      toast({ title: "Imagem enviada com sucesso" });
    } catch {
      toast({ title: "Erro ao enviar imagem", variant: "destructive" });
    } finally {
      setIsUploading(false);
    }
  };

  const stockCount = useMemo(() => {
    return productForm.stock.split("\n").filter((line) => line.trim()).length;
  }, [productForm.stock]);

  if (loadingCategories || loadingProducts) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-20">
      {(categories.length > 0 || products.length > 0) && (
        <div className="flex flex-col sm:flex-row sm:justify-end gap-2 my-4">
          {!isVerified && (
            <p className="text-amber-400 text-sm mr-2 self-center">
              Sua conta precisa ser verificada para adicionar produtos
            </p>
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <span>
                <Button
                  size="sm"
                  onClick={() => openNewProduct()}
                  className="whitespace-nowrap w-full sm:w-auto"
                  style={{
                    background: isVerified 
                      ? "linear-gradient(135deg, #3b82f6 0%, #8b5cf6 50%, #ec4899 100%)"
                      : "#4b5563",
                  }}
                  disabled={!isVerified}
                  data-testid="button-new-product"
                >
                  <Plus className="w-4 h-4 mr-1 flex-shrink-0" />
                  <span>Novo Produto</span>
                </Button>
              </span>
            </TooltipTrigger>
            {!isVerified && (
              <TooltipContent>
                <p>Você precisa ser verificado para adicionar produtos</p>
              </TooltipContent>
            )}
          </Tooltip>
        </div>
      )}

      <div className="space-y-2">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={categories.map((c) => c.id)}
            strategy={verticalListSortingStrategy}
          >
            {categories.map((category) => {
              const isExpanded = expandedCategories.has(category.id);
              const categoryProducts = productsByCategory.grouped[category.id] || [];

              return (
                <SortableCategoryItem
                  key={category.id}
                  category={category}
                  isExpanded={isExpanded}
                  categoryProducts={categoryProducts}
                  onToggle={() => toggleCategory(category.id)}
                  onAddProduct={() => openNewProduct(category.id)}
                  onEditProduct={openEditProduct}
                  onDeleteProduct={(id) => setShowDeleteProductConfirm(id)}
                  isVerified={isVerified}
                />
              );
            })}
          </SortableContext>
        </DndContext>

        {productsByCategory.uncategorized.length > 0 && (
          <div className="rounded-lg overflow-hidden" data-testid="category-uncategorized">
            <div
              className="flex items-center gap-3 p-4 cursor-pointer transition-colors"
              style={{ backgroundColor: "#374151" }}
              onClick={() => toggleCategory(-1)}
              data-testid="button-toggle-uncategorized"
            >
              <Package className="w-5 h-5 text-gray-400 flex-shrink-0" />
              <span className="font-bold text-white uppercase flex-1">
                SEM CATEGORIA
              </span>
              <Badge variant="outline" className="text-gray-400 border-gray-600">
                {productsByCategory.uncategorized.length} produto{productsByCategory.uncategorized.length !== 1 ? "s" : ""}
              </Badge>
              {expandedCategories.has(-1) ? (
                <ChevronUp className="w-5 h-5 text-gray-400" />
              ) : (
                <ChevronDown className="w-5 h-5 text-gray-400" />
              )}
            </div>

            <div
              className={`overflow-hidden transition-all duration-300 ease-in-out ${
                expandedCategories.has(-1) ? "max-h-[2000px] opacity-100" : "max-h-0 opacity-0"
              }`}
              style={{ backgroundColor: "#1f2937" }}
            >
              <div className="p-4 space-y-3">
                {productsByCategory.uncategorized.map((product) => {
                  const categoryName = marketplaceCategories.find(c => c.id === product.categoryId)?.name;
                  return (
                    <ProductCard
                      key={product.id}
                      product={product}
                      onEdit={() => openEditProduct(product)}
                      onDelete={() => setShowDeleteProductConfirm(product.id)}
                      marketplaceCategoryName={categoryName}
                    />
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {categories.length === 0 && products.length === 0 && (
          <div className="text-center py-16 text-gray-500">
            <FolderOpen className="w-16 h-16 mx-auto mb-4 opacity-30" />
            <h3 className="text-lg font-medium text-gray-300 mb-2">
              Comece a organizar sua loja
            </h3>
            <p className="text-sm mb-6">
              {isVerified 
                ? "Adicione produtos para organizar sua vitrine"
                : "Sua conta precisa ser verificada para adicionar produtos"
              }
            </p>
            <div className="flex justify-center gap-3">
              <Tooltip>
                <TooltipTrigger asChild>
                  <span>
                    <Button
                      onClick={() => openNewProduct()}
                      style={{
                        background: isVerified 
                          ? "linear-gradient(135deg, #3b82f6 0%, #8b5cf6 50%, #ec4899 100%)"
                          : "#4b5563",
                      }}
                      disabled={!isVerified}
                      data-testid="button-first-product"
                    >
                      <Plus className="w-4 h-4 mr-1" />
                      Criar Produto
                    </Button>
                  </span>
                </TooltipTrigger>
                {!isVerified && (
                  <TooltipContent>
                    <p>Você precisa ser verificado para adicionar produtos</p>
                  </TooltipContent>
                )}
              </Tooltip>
            </div>
          </div>
        )}
      </div>

      <Dialog open={showProductModal} onOpenChange={setShowProductModal}>
        <DialogContent className="bg-gray-900 border-gray-700 text-white max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingProduct ? "Editar Produto" : "Novo Produto"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-gray-300">Nome do Produto *</Label>
                <Input
                  value={productForm.name}
                  onChange={(e) => setProductForm((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="Ex: Netflix Premium 30 dias"
                  className="bg-gray-800 border-gray-600 text-white"
                  data-testid="input-product-name"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-gray-300">Slug (URL amigável)</Label>
                <Input
                  value={productForm.slug}
                  onChange={(e) => setProductForm((prev) => ({ ...prev, slug: e.target.value }))}
                  placeholder="netflix-premium-30dias"
                  className="bg-gray-800 border-gray-600 text-white"
                  data-testid="input-product-slug"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-gray-300">Preço Atual (R$) *</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={productForm.currentPrice}
                  onChange={(e) => setProductForm((prev) => ({ ...prev, currentPrice: e.target.value }))}
                  placeholder="29.90"
                  className="bg-gray-800 border-gray-600 text-white"
                  data-testid="input-product-price"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-gray-300">Preço Original (R$) *</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={productForm.originalPrice}
                  onChange={(e) => setProductForm((prev) => ({ ...prev, originalPrice: e.target.value }))}
                  placeholder="49.90"
                  className="bg-gray-800 border-gray-600 text-white"
                  data-testid="input-product-original-price"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-gray-300">Categoria *</Label>
                <Select
                  value={productForm.categoryId}
                  onValueChange={(value) => setProductForm((prev) => ({ 
                    ...prev, 
                    categoryId: value,
                    subcategory: "" // Reset subcategory when category changes
                  }))}
                >
                  <SelectTrigger 
                    className="bg-gray-800 border-gray-600 text-white"
                    data-testid="select-product-category"
                  >
                    <SelectValue placeholder="Selecione uma categoria" />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-800 border-gray-600 max-h-60">
                    {marketplaceCategories.map((cat) => (
                      <SelectItem 
                        key={cat.id} 
                        value={cat.id.toString()}
                        className="text-white hover:bg-gray-700"
                      >
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-gray-300">Subcategoria</Label>
                <Select
                  value={productForm.subcategory}
                  onValueChange={(value) => setProductForm((prev) => ({ ...prev, subcategory: value }))}
                  disabled={!selectedCategory?.subcategories?.length}
                >
                  <SelectTrigger 
                    className="bg-gray-800 border-gray-600 text-white"
                    data-testid="select-product-subcategory"
                  >
                    <SelectValue placeholder={selectedCategory?.subcategories?.length ? "Selecione uma subcategoria" : "Selecione uma categoria primeiro"} />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-800 border-gray-600 max-h-60">
                    {(selectedCategory?.subcategories || []).map((subcat) => (
                      <SelectItem 
                        key={subcat} 
                        value={subcat}
                        className="text-white hover:bg-gray-700"
                      >
                        {subcat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-gray-300">Descrição</Label>
              <Textarea
                value={productForm.description}
                onChange={(e) => setProductForm((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="Descrição detalhada do produto..."
                className="bg-gray-800 border-gray-600 text-white resize-none"
                rows={3}
                data-testid="textarea-product-description"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-gray-300">Imagem de Capa</Label>
              <div className="flex gap-2">
                <Input
                  value={productForm.imageUrl}
                  onChange={(e) => setProductForm((prev) => ({ ...prev, imageUrl: e.target.value }))}
                  placeholder="URL da imagem ou faça upload"
                  className="bg-gray-800 border-gray-600 text-white flex-1"
                  data-testid="input-product-image"
                />
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleImageUpload}
                  accept="image/*"
                  className="hidden"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="border-gray-600"
                  data-testid="button-upload-image"
                >
                  {isUploading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Upload className="w-4 h-4" />
                  )}
                </Button>
              </div>
              {productForm.imageUrl && (
                <div className="mt-2 relative w-20 h-20 rounded-lg overflow-hidden border border-gray-600 bg-gray-900">
                  <img
                    src={productForm.imageUrl}
                    alt="Preview"
                    className="w-full h-full object-contain"
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    className="absolute top-0 right-0 w-6 h-6 bg-black/50 hover:bg-black/70"
                    onClick={() => setProductForm((prev) => ({ ...prev, imageUrl: "" }))}
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-gray-300">
                  Estoque de Keys / Licenças
                </Label>
                <div className="flex items-center gap-2">
                  <Badge 
                    variant={stockCount > 0 ? "default" : "destructive"}
                    className={stockCount > 0 ? "bg-green-600" : ""}
                  >
                    Estoque: {stockCount} {stockCount === 1 ? "item" : "itens"}
                  </Badge>
                  {productForm.stock && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-red-400 hover:text-red-300"
                      onClick={() => setProductForm((prev) => ({ ...prev, stock: "" }))}
                      data-testid="button-clear-stock"
                    >
                      Limpar
                    </Button>
                  )}
                </div>
              </div>
              <Textarea
                value={productForm.stock}
                onChange={(e) => setProductForm((prev) => ({ ...prev, stock: e.target.value }))}
                placeholder={"Cole suas keys/licenças aqui (uma por linha):\n\nemail1@gmail.com:senha123\nemail2@gmail.com:senha456\nABC123-DEF456-GHI789\n..."}
                className="bg-gray-800 border-gray-600 text-white font-mono text-sm resize-none"
                rows={8}
                data-testid="textarea-product-stock"
              />
              <p className="text-xs text-gray-500">
                Cada linha representa um item de estoque. Quando uma venda ocorre, 
                o primeiro item disponível é enviado ao cliente automaticamente.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 pt-2">
              <div className="flex items-center gap-3 flex-1">
                <Switch
                  id="active"
                  checked={productForm.active}
                  onCheckedChange={(checked) => 
                    setProductForm((prev) => ({ ...prev, active: checked }))
                  }
                  data-testid="switch-product-active"
                />
                <Label htmlFor="active" className="text-gray-300 cursor-pointer">
                  <div className="flex items-center gap-2">
                    {productForm.active ? (
                      <Eye className="w-4 h-4 text-green-400" />
                    ) : (
                      <EyeOff className="w-4 h-4 text-gray-500" />
                    )}
                    Visibilidade
                  </div>
                  <span className="text-xs text-gray-500 block">
                    {productForm.active ? "Produto visível na loja" : "Produto oculto"}
                  </span>
                </Label>
              </div>

              <div className="flex items-center gap-3 flex-1">
                <Switch
                  id="limitPerUser"
                  checked={productForm.limitPerUser}
                  onCheckedChange={(checked) => 
                    setProductForm((prev) => ({ ...prev, limitPerUser: checked }))
                  }
                  data-testid="switch-product-limit"
                />
                <Label htmlFor="limitPerUser" className="text-gray-300 cursor-pointer">
                  <div className="flex items-center gap-2">
                    Limite de 1 por usuário
                  </div>
                  <span className="text-xs text-gray-500 block">
                    {productForm.limitPerUser 
                      ? "Cada cliente pode comprar apenas 1" 
                      : "Sem limite de compras"}
                  </span>
                </Label>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <Switch
                id="isPremium"
                checked={productForm.isPremium}
                onCheckedChange={(checked) => 
                  setProductForm((prev) => ({ ...prev, isPremium: checked }))
                }
                data-testid="switch-product-premium"
              />
              <Label htmlFor="isPremium" className="text-gray-300 cursor-pointer">
                <div className="flex items-center gap-2">
                  <Star className="w-4 h-4 text-yellow-400" />
                  Anúncio Premium
                </div>
                <span className="text-xs text-gray-500 block">
                  {productForm.isPremium 
                    ? "Taxa de 10% sobre vendas + destaque nas buscas e divulgações" 
                    : "Taxa padrão sem destaque"}
                </span>
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowProductModal(false);
                setEditingProduct(null);
                resetProductForm();
              }}
              className="border-gray-600"
              data-testid="button-cancel-product"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSaveProduct}
              disabled={createProductMutation.isPending || updateProductMutation.isPending}
              style={{
                background: "linear-gradient(135deg, #3b82f6 0%, #8b5cf6 50%, #ec4899 100%)",
              }}
              data-testid="button-save-product"
            >
              {(createProductMutation.isPending || updateProductMutation.isPending) && (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              )}
              Salvar Produto
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog 
        open={showDeleteProductConfirm !== null} 
        onOpenChange={() => setShowDeleteProductConfirm(null)}
      >
        <AlertDialogContent className="bg-gray-900 border-gray-700 text-white">
          <AlertDialogTitle>Excluir Produto</AlertDialogTitle>
          <AlertDialogDescription className="text-gray-400">
            Tem certeza que deseja excluir este produto? Esta ação não pode ser desfeita.
          </AlertDialogDescription>
          <div className="flex justify-end gap-3 mt-4">
            <AlertDialogCancel className="bg-gray-800 border-gray-600 text-white hover:bg-gray-700">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => showDeleteProductConfirm && deleteProductMutation.mutate(showDeleteProductConfirm)}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleteProductMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Excluir
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

interface SortableCategoryItemProps {
  category: Category;
  isExpanded: boolean;
  categoryProducts: Product[];
  onToggle: () => void;
  onAddProduct: () => void;
  onEditProduct: (product: Product) => void;
  onDeleteProduct: (id: number) => void;
  isVerified: boolean;
}

function SortableCategoryItem({
  category,
  isExpanded,
  categoryProducts,
  onToggle,
  onAddProduct,
  onEditProduct,
  onDeleteProduct,
  isVerified,
}: SortableCategoryItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: category.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 1 : 0,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="rounded-lg overflow-hidden"
      data-testid={`category-accordion-${category.id}`}
    >
      <div
        className="flex items-center gap-2 px-4 py-3 cursor-pointer transition-colors"
        style={{ backgroundColor: "#1f2937" }}
        onClick={onToggle}
        data-testid={`button-toggle-category-${category.id}`}
      >
        <div
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing touch-none flex-shrink-0"
          onClick={(e) => e.stopPropagation()}
          data-testid={`drag-handle-category-${category.id}`}
        >
          <GripVertical className="w-5 h-5 text-gray-500 hover:text-gray-300" />
        </div>
        <FolderOpen className="w-5 h-5 text-blue-400 flex-shrink-0" />
        <span className="font-bold text-white uppercase flex-1 min-w-0 truncate">
          {category.name}
        </span>
        <div className="flex items-center gap-1 flex-shrink-0">
          <Badge variant="outline" className="text-gray-400 border-gray-600">
            {categoryProducts.length}
          </Badge>
          {isExpanded ? (
            <ChevronUp className="w-5 h-5 text-gray-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-gray-400" />
          )}
        </div>
      </div>

      <div
        className={`overflow-hidden transition-all duration-300 ease-in-out ${
          isExpanded ? "max-h-[2000px] opacity-100" : "max-h-0 opacity-0"
        }`}
        style={{ backgroundColor: "#111827" }}
      >
        <div className="p-4 space-y-3">
          {categoryProducts.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Package className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>{isVerified ? "Nenhum produto nesta categoria" : "Sua conta precisa ser verificada para adicionar produtos"}</p>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-3 border-gray-600 text-gray-300"
                      onClick={onAddProduct}
                      disabled={!isVerified}
                      data-testid={`button-add-product-to-category-${category.id}`}
                    >
                      <Plus className="w-4 h-4 mr-1" />
                      Adicionar Produto
                    </Button>
                  </span>
                </TooltipTrigger>
                {!isVerified && (
                  <TooltipContent>
                    <p>Você precisa ser verificado para adicionar produtos</p>
                  </TooltipContent>
                )}
              </Tooltip>
            </div>
          ) : (
            categoryProducts.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                onEdit={() => onEditProduct(product)}
                onDelete={() => onDeleteProduct(product.id)}
              />
            ))
          )}
          {categoryProducts.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              className="w-full border-dashed border-gray-600 text-gray-400 hover:text-white"
              onClick={onAddProduct}
              data-testid={`button-add-more-to-category-${category.id}`}
            >
              <Plus className="w-4 h-4 mr-1" />
              Adicionar produto a esta categoria
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function ProductCard({
  product,
  onEdit,
  onDelete,
  marketplaceCategoryName,
}: {
  product: Product;
  onEdit: () => void;
  onDelete: () => void;
  marketplaceCategoryName?: string;
}) {
  const stockCount = product.stock?.split("\n").filter((line) => line.trim()).length || 0;

  return (
    <div
      className="flex items-center gap-4 p-3 rounded-lg transition-colors hover:bg-gray-800/50"
      style={{ backgroundColor: "rgba(31, 41, 55, 0.5)" }}
      data-testid={`product-card-${product.id}`}
    >
      <div className="w-14 h-14 rounded-lg overflow-hidden flex-shrink-0 bg-gray-900">
        {product.imageUrl ? (
          <img
            src={product.imageUrl}
            alt={product.name}
            className="w-full h-full object-contain"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Image className="w-6 h-6 text-gray-500" />
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <h4 className="font-medium text-white truncate">{product.name}</h4>
          {marketplaceCategoryName && (
            <Badge variant="outline" className="text-blue-400 border-blue-600/50 text-xs bg-blue-600/10">
              {marketplaceCategoryName}
            </Badge>
          )}
          {!product.active && (
            <Badge variant="outline" className="text-gray-500 border-gray-600 text-xs">
              Oculto
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-3 mt-1">
          <span className="text-green-400 font-semibold">
            R$ {parseFloat(product.currentPrice).toFixed(2)}
          </span>
          {product.originalPrice !== product.currentPrice && (
            <span className="text-gray-500 line-through text-sm">
              R$ {parseFloat(product.originalPrice).toFixed(2)}
            </span>
          )}
        </div>
      </div>

      <Badge
        variant={stockCount > 0 ? "default" : "destructive"}
        className={`flex-shrink-0 ${stockCount > 0 ? "bg-green-600/20 text-green-400 border-green-600/30" : ""}`}
      >
        {stockCount} em estoque
      </Badge>

      <div className="flex items-center gap-1 flex-shrink-0">
        <Button
          size="icon"
          variant="ghost"
          className="text-gray-400 hover:text-white"
          onClick={onEdit}
          data-testid={`button-edit-product-${product.id}`}
        >
          <Edit2 className="w-4 h-4" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="text-gray-400 hover:text-red-400"
          onClick={onDelete}
          data-testid={`button-delete-product-${product.id}`}
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
