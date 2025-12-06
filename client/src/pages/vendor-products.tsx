import { useState } from "react";
import { Plus, Trash2, Edit2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

export function VendorProducts() {
  const { toast } = useToast();
  const [products, setProducts] = useState<any[]>([]);
  const [isAddingProduct, setIsAddingProduct] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    price: "",
    description: "",
    imageUrl: "",
    stock: "",
  });

  const handleAddProduct = () => {
    if (!formData.name || !formData.price) {
      toast({
        title: "Campos obrigatórios",
        description: "Nome e preço são necessários",
        variant: "destructive",
      });
      return;
    }

    const newProduct = {
      id: Date.now(),
      ...formData,
    };

    setProducts([...products, newProduct]);
    setFormData({ name: "", price: "", description: "", imageUrl: "", stock: "" });
    setIsAddingProduct(false);
    toast({
      title: "Sucesso!",
      description: "Produto adicionado",
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-white">Meus Produtos</h1>
        <Button
          onClick={() => setIsAddingProduct(!isAddingProduct)}
          className="flex items-center gap-2"
          style={{
            background: "linear-gradient(135deg, #3b82f6 0%, #8b5cf6 50%, #ec4899 100%)",
            color: "#FFFFFF",
            border: "1px solid rgba(255, 255, 255, 0.2)",
          }}
          data-testid="button-add-product-modal"
        >
          <Plus className="w-4 h-4" />
          Adicionar Produto
        </Button>
      </div>

      {/* Add Product Form */}
      {isAddingProduct && (
        <Card
          style={{
            background: "rgba(30, 30, 30, 0.4)",
            backdropFilter: "blur(12px)",
            border: "1px solid rgba(255, 255, 255, 0.1)",
          }}
        >
          <CardHeader>
            <CardTitle className="text-white">Novo Produto</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-white">Nome do Produto</Label>
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
                <Label className="text-white">Preço (R$)</Label>
                <Input
                  type="number"
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
              <Label className="text-white">Descrição</Label>
              <Input
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Descrição do produto"
                style={{
                  background: "rgba(30, 30, 40, 0.4)",
                  backdropFilter: "blur(10px)",
                  borderColor: "rgba(255,255,255,0.1)",
                  color: "#FFFFFF",
                }}
                data-testid="input-product-description"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-white">URL da Imagem</Label>
              <Input
                value={formData.imageUrl}
                onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
                placeholder="https://..."
                style={{
                  background: "rgba(30, 30, 40, 0.4)",
                  backdropFilter: "blur(10px)",
                  borderColor: "rgba(255,255,255,0.1)",
                  color: "#FFFFFF",
                }}
                data-testid="input-product-image"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-white">Estoque (IDs separados por quebra de linha)</Label>
              <textarea
                value={formData.stock}
                onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
                placeholder="ID1\nID2\nID3"
                className="w-full p-3 rounded-lg text-white resize-none"
                rows={4}
                style={{
                  background: "rgba(30, 30, 40, 0.4)",
                  backdropFilter: "blur(10px)",
                  borderColor: "rgba(255,255,255,0.1)",
                  border: "1px solid rgba(255,255,255,0.1)",
                }}
                data-testid="textarea-product-stock"
              />
            </div>

            <div className="flex gap-2">
              <Button
                onClick={handleAddProduct}
                style={{
                  background: "linear-gradient(135deg, #3b82f6 0%, #8b5cf6 50%, #ec4899 100%)",
                  color: "#FFFFFF",
                }}
                data-testid="button-save-product"
              >
                Salvar Produto
              </Button>
              <Button
                onClick={() => setIsAddingProduct(false)}
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {products.map((product) => (
            <Card
              key={product.id}
              style={{
                background: "rgba(30, 30, 30, 0.4)",
                backdropFilter: "blur(12px)",
                border: "1px solid rgba(255, 255, 255, 0.1)",
              }}
              data-testid={`card-product-${product.id}`}
            >
              <CardHeader className="pb-3">
                <CardTitle className="text-white text-lg">{product.name}</CardTitle>
                <p className="text-green-400 font-bold">R$ {product.price}</p>
              </CardHeader>
              <CardContent>
                <p className="text-gray-400 text-sm mb-4">{product.description || "Sem descrição"}</p>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1"
                    data-testid={`button-edit-product-${product.id}`}
                  >
                    <Edit2 className="w-3 h-3 mr-1" />
                    Editar
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 text-red-400"
                    onClick={() => setProducts(products.filter((p) => p.id !== product.id))}
                    data-testid={`button-delete-product-${product.id}`}
                  >
                    <Trash2 className="w-3 h-3 mr-1" />
                    Deletar
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
