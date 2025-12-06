import { useQuery, useMutation } from "@tanstack/react-query";
import { Loader2, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Product, Reseller } from "@shared/schema";

interface ProductWithVendor extends Product {
  vendorName?: string;
}

export default function AdminProductsModeration() {
  const { toast } = useToast();
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);

  const { data: products = [], isLoading: productsLoading } = useQuery<ProductWithVendor[]>({
    queryKey: ["/api/admin/products"],
  });

  const { data: resellers = [], isLoading: resellersLoading } = useQuery<Reseller[]>({
    queryKey: ["/api/admin/resellers"],
  });

  const deleteMutation = useMutation({
    mutationFn: async (productId: number) => {
      return apiRequest("DELETE", `/api/admin/products/${productId}`, null);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/products"] });
      toast({ title: "Produto deletado com sucesso" });
      setDeleteConfirm(null);
    },
    onError: () => {
      toast({ title: "Erro ao deletar produto", variant: "destructive" });
    },
  });

  const isLoading = productsLoading || resellersLoading;

  // Map vendor names to products
  const productsWithVendorNames = products.map((product) => {
    const vendor = resellers.find((r) => r.id === product.resellerId);
    return {
      ...product,
      vendorName: vendor?.storeName || "Vendedor Desconhecido",
    };
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-8 h-8 animate-spin text-teal-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteConfirm !== null} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogTitle>Deletar Produto?</AlertDialogTitle>
          <AlertDialogDescription>
            Tem certeza que deseja deletar este produto permanentemente? Ele será removido de todas as lojas.
          </AlertDialogDescription>
          <div className="flex gap-2 justify-end">
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteConfirm) {
                  deleteMutation.mutate(deleteConfirm);
                }
              }}
              className="bg-red-600 hover:bg-red-700"
            >
              Deletar
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      <div>
        <h1 className="text-3xl font-bold text-white">Moderação de Produtos</h1>
        <p className="text-gray-400 text-sm mt-1">Gerencie todos os produtos cadastrados no marketplace</p>
      </div>

      <Card
        style={{
          backgroundColor: "#1E1E1E",
          borderColor: "rgba(255,255,255,0.1)",
        }}
      >
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            Total de Produtos: {productsWithVendorNames.length}
          </CardTitle>
        </CardHeader>

        <CardContent>
          {productsWithVendorNames.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-400 mb-2">Nenhum produto encontrado</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr
                    className="border-b"
                    style={{ borderColor: "rgba(255,255,255,0.1)" }}
                  >
                    <th className="text-left py-4 text-gray-400 font-semibold">
                      Produto
                    </th>
                    <th className="text-left py-4 text-gray-400 font-semibold">
                      Vendedor/Loja
                    </th>
                    <th className="text-right py-4 text-gray-400 font-semibold">
                      Preço
                    </th>
                    <th className="text-center py-4 text-gray-400 font-semibold">
                      Status
                    </th>
                    <th className="text-center py-4 text-gray-400 font-semibold">
                      Ação
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {productsWithVendorNames.map((product) => (
                    <tr
                      key={product.id}
                      className="border-b hover:bg-zinc-800/50 transition-colors"
                      style={{ borderColor: "rgba(255,255,255,0.05)" }}
                      data-testid={`row-product-${product.id}`}
                    >
                      <td className="py-4 text-white font-medium max-w-xs truncate">
                        {product.name}
                      </td>
                      <td className="py-4 text-gray-300">
                        {product.vendorName}
                      </td>
                      <td className="py-4 text-right text-green-400 font-semibold">
                        R$ {parseFloat(product.currentPrice as any).toFixed(2)}
                      </td>
                      <td className="py-4 text-center">
                        <Badge
                          variant={product.active ? "default" : "secondary"}
                          className={
                            product.active
                              ? "bg-green-500/20 text-green-400 border border-green-500/30"
                              : "bg-red-500/20 text-red-400 border border-red-500/30"
                          }
                          data-testid={`badge-status-${product.id}`}
                        >
                          {product.active ? "Ativo" : "Inativo"}
                        </Badge>
                      </td>
                      <td className="py-4 text-center">
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-red-400"
                          onClick={() => setDeleteConfirm(product.id)}
                          disabled={deleteMutation.isPending}
                          data-testid={`button-delete-product-${product.id}`}
                        >
                          <Trash2 className="w-3 h-3 mr-1" />
                          Banir Produto
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
