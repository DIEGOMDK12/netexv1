import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Product } from "@shared/schema";

export default function AdminProducts() {
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    imageUrl: "",
    originalPrice: "",
    currentPrice: "",
    stock: "",
    category: "Outros",
    instructions: "",
    warranty: "",
    active: true,
  });

  const { data: products, isLoading } = useQuery<Product[]>({
    queryKey: ["/api/admin/products"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const response = await apiRequest("POST", "/api/admin/products", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      setIsDialogOpen(false);
      resetForm();
      toast({ title: "Produto criado com sucesso!" });
    },
    onError: () => {
      toast({ title: "Erro ao criar produto", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/admin/products/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      toast({ title: "Produto excluído com sucesso!" });
    },
    onError: () => {
      toast({ title: "Erro ao excluir produto", variant: "destructive" });
    },
  });

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      imageUrl: "",
      originalPrice: "",
      currentPrice: "",
      stock: "",
      category: "Outros",
      instructions: "",
      warranty: "",
      active: true,
    });
    setEditingId(null);
  };

  const getStockCount = (stock: string | null) => {
    if (!stock) return 0;
    return stock.split("\n").filter((line) => line.trim()).length;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate(formData);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-8 h-8 animate-spin text-teal-500" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Produtos</h2>
          <p className="text-gray-400 text-sm mt-1">{products?.length || 0} produtos cadastrados</p>
        </div>
        <Button
          onClick={() => {
            resetForm();
            setIsDialogOpen(true);
          }}
          className="bg-teal-600 hover:bg-teal-700 text-white"
          data-testid="button-add-product"
        >
          <Plus className="w-4 h-4 mr-2" />
          Novo Produto
        </Button>
      </div>

      {/* Products Table */}
      <div
        className="rounded-lg border overflow-hidden"
        style={{ backgroundColor: "#1E1E1E", borderColor: "rgba(255,255,255,0.1)" }}
      >
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr
                style={{ backgroundColor: "#242424", borderColor: "rgba(255,255,255,0.1)" }}
                className="border-b"
              >
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">Nome</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">Preço</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">Estoque</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">Ações</th>
              </tr>
            </thead>
            <tbody>
              {products?.map((product) => (
                <tr
                  key={product.id}
                  style={{ borderColor: "rgba(255,255,255,0.1)" }}
                  className="border-b hover:bg-zinc-800/50 transition-colors"
                  data-testid={`product-row-${product.id}`}
                >
                  <td className="px-6 py-3">
                    <div>
                      <p className="text-white font-medium">{product.name}</p>
                      <p className="text-xs text-gray-500">{product.category}</p>
                    </div>
                  </td>
                  <td className="px-6 py-3">
                    <p className="text-white">R$ {Number(product.currentPrice).toFixed(2)}</p>
                  </td>
                  <td className="px-6 py-3">
                    <span
                      className={`text-sm font-medium ${
                        getStockCount(product.stock) <= 5 ? "text-red-400" : "text-green-400"
                      }`}
                    >
                      {getStockCount(product.stock)} un
                    </span>
                  </td>
                  <td className="px-6 py-3">
                    <span
                      className={`text-xs px-2 py-1 rounded ${
                        product.active ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"
                      }`}
                    >
                      {product.active ? "Ativo" : "Inativo"}
                    </span>
                  </td>
                  <td className="px-6 py-3 flex gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setEditingId(product.id);
                        setFormData({
                          name: product.name,
                          description: product.description || "",
                          imageUrl: product.imageUrl || "",
                          originalPrice: product.originalPrice,
                          currentPrice: product.currentPrice,
                          stock: product.stock || "",
                          category: product.category || "Outros",
                          instructions: product.instructions || "",
                          warranty: product.warranty || "",
                          active: product.active,
                        });
                        setIsDialogOpen(true);
                      }}
                      className="text-teal-400 hover:text-teal-300 hover:bg-teal-500/10"
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => deleteMutation.mutate(product.id)}
                      className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {!products || products.length === 0 && (
          <div className="p-12 text-center">
            <p className="text-gray-400">Nenhum produto cadastrado. Clique em "Novo Produto" para começar.</p>
          </div>
        )}
      </div>

      {/* Add/Edit Product Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent
          style={{ backgroundColor: "#1E1E1E", borderColor: "rgba(255,255,255,0.1)" }}
          className="max-w-2xl"
        >
          <DialogHeader>
            <DialogTitle className="text-white">{editingId ? "Editar" : "Novo"} Produto</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-white">Nome</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  style={{ backgroundColor: "#242424", borderColor: "rgba(255,255,255,0.1)", color: "#fff" }}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-white">Categoria</Label>
                <Input
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  style={{ backgroundColor: "#242424", borderColor: "rgba(255,255,255,0.1)", color: "#fff" }}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-white">Descrição</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                style={{ backgroundColor: "#242424", borderColor: "rgba(255,255,255,0.1)", color: "#fff" }}
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label className="text-white">Preço Original</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.originalPrice}
                  onChange={(e) => setFormData({ ...formData, originalPrice: e.target.value })}
                  style={{ backgroundColor: "#242424", borderColor: "rgba(255,255,255,0.1)", color: "#fff" }}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-white">Preço Atual</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.currentPrice}
                  onChange={(e) => setFormData({ ...formData, currentPrice: e.target.value })}
                  style={{ backgroundColor: "#242424", borderColor: "rgba(255,255,255,0.1)", color: "#fff" }}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-white">URL da Imagem</Label>
                <Input
                  value={formData.imageUrl}
                  onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
                  style={{ backgroundColor: "#242424", borderColor: "rgba(255,255,255,0.1)", color: "#fff" }}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-white">Estoque (1 linha = 1 unidade)</Label>
              <Textarea
                value={formData.stock}
                onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
                placeholder="Chave 1&#10;Chave 2&#10;Chave 3"
                style={{ backgroundColor: "#242424", borderColor: "rgba(255,255,255,0.1)", color: "#fff" }}
              />
            </div>

            <div className="flex items-center gap-2">
              <Switch
                checked={formData.active}
                onCheckedChange={(checked) => setFormData({ ...formData, active: checked })}
              />
              <Label className="text-white">Ativo</Label>
            </div>

            <div className="flex gap-2 pt-4">
              <Button
                type="submit"
                disabled={createMutation.isPending}
                className="flex-1 bg-teal-600 hover:bg-teal-700 text-white"
              >
                {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Salvar"}
              </Button>
              <Button
                type="button"
                onClick={() => {
                  setIsDialogOpen(false);
                  resetForm();
                }}
                variant="outline"
                className="flex-1"
              >
                Cancelar
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
