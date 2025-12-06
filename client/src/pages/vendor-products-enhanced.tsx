import { useState, useMemo, useRef } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Plus, Trash2, Edit2, Loader2, Upload, Image } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Product } from "@shared/schema";

export function VendorProductsEnhanced({ vendorId }: { vendorId: number }) {
  const { toast } = useToast();
  const [isAddingProduct, setIsAddingProduct] = useState(false);
  const [editingProductId, setEditingProductId] = useState<number | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<number | null>(null);
  const [categoryInput, setCategoryInput] = useState("");
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [formData, setFormData] = useState({
    name: "",
    price: "",
    originalPrice: "",
    description: "",
    imageUrl: "",
    stock: "",
    category: "",
    deliveryContent: "",
  });

  const { data: products = [], isLoading } = useQuery<Product[]>({
    queryKey: ["/api/vendor/products", vendorId],
    queryFn: async () => {
      const response = await fetch(`/api/vendor/products?vendorId=${vendorId}`);
      if (!response.ok) throw new Error("Failed to fetch products");
      return response.json();
    },
  });

  const { data: allCategories = [] } = useQuery({
    queryKey: ["/api/categories"],
    queryFn: async () => {
      const response = await fetch("/api/categories");
      if (!response.ok) throw new Error("Failed to fetch categories");
      return response.json();
    },
  });

  const filteredCategories = useMemo(() => {
    const input = categoryInput.toLowerCase();
    return allCategories.filter((cat: any) => cat.name.toLowerCase().includes(input));
  }, [categoryInput, allCategories]);

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("POST", "/api/vendor/products", data);
    },
    onSuccess: () => {
      toast({
        title: "✓ Sucesso!",
        description: "Produto adicionado! Recarregando...",
      });
      setTimeout(() => {
        window.location.reload();
      }, 500);
    },
    onError: (error: any) => {
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
      return apiRequest("PATCH", `/api/vendor/products/${editingProductId}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vendor/products", vendorId] });
      setEditingProductId(null);
      setFormData({ name: "", price: "", originalPrice: "", description: "", imageUrl: "", stock: "", category: "", deliveryContent: "" });
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
    if (!formData.name || !formData.price || !formData.originalPrice || !formData.stock) {
      toast({
        title: "Campos obrigatórios",
        description: "Nome, preço, preço original e lista de estoque são necessários",
        variant: "destructive",
      });
      return;
    }

    createMutation.mutate({
      name: formData.name,
      description: formData.description,
      imageUrl: formData.imageUrl || "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400",
      currentPrice: formData.price,
      originalPrice: formData.originalPrice,
      stock: formData.stock,
      deliveryContent: formData.deliveryContent,
      category: formData.category || "Outros",
      resellerId: vendorId,
    });
  };

  const handleEditProduct = (product: Product) => {
    setEditingProductId(product.id);
    setFormData({
      name: product.name,
      price: product.currentPrice.toString(),
      originalPrice: product.originalPrice.toString(),
      description: product.description || "",
      imageUrl: product.imageUrl || "",
      stock: product.stock || "",
      category: product.category || "",
      deliveryContent: product.deliveryContent || "",
    });
  };

  const handleSaveEdit = () => {
    if (!formData.name || !formData.price || !formData.originalPrice || !formData.stock) {
      toast({
        title: "Campos obrigatórios",
        description: "Nome, preço, preço original e lista de estoque são necessários",
        variant: "destructive",
      });
      return;
    }

    updateMutation.mutate({
      name: formData.name,
      description: formData.description,
      imageUrl: formData.imageUrl,
      currentPrice: formData.price,
      originalPrice: formData.originalPrice,
      stock: formData.stock,
      deliveryContent: formData.deliveryContent,
      category: formData.category || "Outros",
    });
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
            </div>

            <div className="space-y-2">
              <Label className="text-white">Categoria do Produto *</Label>
              <div className="relative">
                <Input
                  value={categoryInput}
                  onChange={(e) => {
                    setCategoryInput(e.target.value);
                    setFormData({ ...formData, category: e.target.value });
                    setShowCategoryDropdown(true);
                  }}
                  onFocus={() => setShowCategoryDropdown(true)}
                  placeholder="Digite ou selecione uma categoria"
                  style={{
                    background: "rgba(30, 30, 40, 0.4)",
                    backdropFilter: "blur(10px)",
                    borderColor: "rgba(255,255,255,0.1)",
                    color: "#FFFFFF",
                  }}
                  data-testid="input-product-category"
                />
                {showCategoryDropdown && filteredCategories.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-gray-900 border border-gray-700 rounded-lg z-10 max-h-40 overflow-y-auto">
                    {filteredCategories.map((cat: any) => (
                      <button
                        key={cat.id}
                        onClick={() => {
                          setCategoryInput(cat.name);
                          setFormData({ ...formData, category: cat.name });
                          setShowCategoryDropdown(false);
                        }}
                        className="w-full text-left px-3 py-2 hover:bg-gray-800 text-white text-sm"
                        type="button"
                      >
                        {cat.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

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
                      className="w-12 h-12 object-cover rounded"
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

            <div className="space-y-2">
              <Label className="text-white">📦 Lista de Estoque (Cole um item por linha) *</Label>
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
                <p>• Quantidade de estoque: <span className="text-green-400 font-bold">{formData.stock.trim() ? formData.stock.split('\n').filter(line => line.trim()).length : 0} unidade(s)</span></p>
                <p>• Cada linha será entregue a um cliente diferente (Sistema FIFO)</p>
              </div>
            </div>

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
                  setFormData({ name: "", price: "", originalPrice: "", description: "", imageUrl: "", stock: "", category: "", deliveryContent: "" });
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
          {products.map((product) => {
            const stockLines = product.stock?.split('\n').filter(line => line.trim()) || [];
            const stockCount = stockLines.length;
            
            return (
              <Card
                key={product.id}
                className="overflow-hidden"
                style={{
                  background: "rgba(30, 30, 30, 0.4)",
                  backdropFilter: "blur(12px)",
                  border: "1px solid rgba(255, 255, 255, 0.1)",
                }}
                data-testid={`card-product-${product.id}`}
              >
                {/* Product Image */}
                {product.imageUrl && (
                  <div className="aspect-square overflow-hidden">
                    <img 
                      src={product.imageUrl} 
                      alt={product.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
                
                <div className="p-3">
                  {/* Name */}
                  <h3 className="text-white text-sm font-semibold line-clamp-1 mb-1">{product.name}</h3>
                  
                  {/* Prices */}
                  <div className="flex items-baseline gap-2 mb-2">
                    <span className="text-green-400 font-bold text-sm">
                      R$ {parseFloat(product.currentPrice as any).toFixed(2)}
                    </span>
                    <span className="text-gray-500 text-xs line-through">
                      R$ {parseFloat(product.originalPrice as any).toFixed(2)}
                    </span>
                  </div>
                  
                  {/* Stock Badge */}
                  <div className="mb-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${stockCount > 0 ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                      {stockCount > 0 ? `${stockCount} em estoque` : 'Sem estoque'}
                    </span>
                  </div>
                  
                  {/* Action Buttons */}
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 text-xs h-8"
                      onClick={() => handleEditProduct(product)}
                      data-testid={`button-edit-product-${product.id}`}
                    >
                      <Edit2 className="w-3 h-3 mr-1" />
                      Editar
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 text-xs h-8 text-red-400 border-red-400/30 hover:bg-red-400/10"
                      onClick={() => setShowDeleteConfirm(product.id)}
                      disabled={deleteMutation.isPending}
                      data-testid={`button-delete-product-${product.id}`}
                    >
                      <Trash2 className="w-3 h-3 mr-1" />
                      Deletar
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
