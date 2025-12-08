import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Loader2, Percent, Tag, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import type { Coupon } from "@shared/schema";

interface CouponFormData {
  code: string;
  discountType: string;
  discountValue: string;
  discountPercent: number;
  minOrderValue: string;
  maxUses: string;
  active: boolean;
}

const initialFormData: CouponFormData = {
  code: "",
  discountType: "percent",
  discountValue: "0",
  discountPercent: 10,
  minOrderValue: "",
  maxUses: "",
  active: true,
};

export function VendorCoupons() {
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<Coupon | null>(null);
  const [formData, setFormData] = useState<CouponFormData>(initialFormData);
  const vendorToken = localStorage.getItem("vendor_token");

  const { data: coupons = [], isLoading } = useQuery<Coupon[]>({
    queryKey: ["/api/vendor/coupons"],
    queryFn: async () => {
      const response = await fetch("/api/vendor/coupons", {
        headers: { Authorization: `Bearer ${vendorToken}` },
      });
      if (!response.ok) throw new Error("Erro ao carregar cupons");
      return response.json();
    },
    enabled: !!vendorToken,
  });

  const createMutation = useMutation({
    mutationFn: async (data: CouponFormData) => {
      const response = await fetch("/api/vendor/coupons", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${vendorToken}`,
        },
        body: JSON.stringify({
          ...data,
          discountPercent: data.discountType === "percent" ? Number(data.discountValue) : 0,
          discountValue: data.discountValue,
          minOrderValue: data.minOrderValue || null,
          maxUses: data.maxUses ? Number(data.maxUses) : null,
        }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Erro ao criar cupom");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vendor/coupons"] });
      toast({ title: "Cupom criado com sucesso!" });
      setIsDialogOpen(false);
      setFormData(initialFormData);
    },
    onError: (error: Error) => {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: CouponFormData }) => {
      const response = await fetch(`/api/vendor/coupons/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${vendorToken}`,
        },
        body: JSON.stringify({
          ...data,
          discountPercent: data.discountType === "percent" ? Number(data.discountValue) : 0,
          discountValue: data.discountValue,
          minOrderValue: data.minOrderValue || null,
          maxUses: data.maxUses ? Number(data.maxUses) : null,
        }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Erro ao atualizar cupom");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vendor/coupons"] });
      toast({ title: "Cupom atualizado com sucesso!" });
      setIsDialogOpen(false);
      setEditingCoupon(null);
      setFormData(initialFormData);
    },
    onError: (error: Error) => {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/vendor/coupons/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${vendorToken}` },
      });
      if (!response.ok) throw new Error("Erro ao deletar cupom");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vendor/coupons"] });
      toast({ title: "Cupom deletado com sucesso!" });
    },
    onError: (error: Error) => {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    },
  });

  const handleOpenDialog = (coupon?: Coupon) => {
    if (coupon) {
      setEditingCoupon(coupon);
      setFormData({
        code: coupon.code,
        discountType: coupon.discountType || "percent",
        discountValue: coupon.discountType === "percent" ? String(coupon.discountPercent || coupon.discountValue) : String(coupon.discountValue),
        discountPercent: coupon.discountPercent || 0,
        minOrderValue: coupon.minOrderValue || "",
        maxUses: coupon.maxUses ? String(coupon.maxUses) : "",
        active: coupon.active,
      });
    } else {
      setEditingCoupon(null);
      setFormData(initialFormData);
    }
    setIsDialogOpen(true);
  };

  const handleSubmit = () => {
    if (!formData.code.trim()) {
      toast({ title: "Erro", description: "O codigo do cupom e obrigatorio", variant: "destructive" });
      return;
    }
    if (editingCoupon) {
      updateMutation.mutate({ id: editingCoupon.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Meus Cupons</h1>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button 
              onClick={() => handleOpenDialog()} 
              className="bg-purple-600 hover:bg-purple-700"
              data-testid="button-add-coupon"
            >
              <Plus className="w-4 h-4 mr-2" />
              Novo Cupom
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-[#1a1a1a] border-gray-700">
            <DialogHeader>
              <DialogTitle className="text-white">
                {editingCoupon ? "Editar Cupom" : "Criar Novo Cupom"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label className="text-gray-300">Codigo do Cupom</Label>
                <Input
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                  placeholder="PROMO10"
                  className="bg-[#242424] border-gray-600 text-white"
                  data-testid="input-coupon-code"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-gray-300">Tipo de Desconto</Label>
                <Select
                  value={formData.discountType}
                  onValueChange={(value) => setFormData({ ...formData, discountType: value })}
                >
                  <SelectTrigger className="bg-[#242424] border-gray-600 text-white" data-testid="select-discount-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#242424] border-gray-600">
                    <SelectItem value="percent">Porcentagem (%)</SelectItem>
                    <SelectItem value="fixed">Valor Fixo (R$)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-gray-300">
                  {formData.discountType === "percent" ? "Desconto (%)" : "Valor do Desconto (R$)"}
                </Label>
                <Input
                  type="number"
                  value={formData.discountValue}
                  onChange={(e) => setFormData({ ...formData, discountValue: e.target.value })}
                  placeholder={formData.discountType === "percent" ? "10" : "5.00"}
                  className="bg-[#242424] border-gray-600 text-white"
                  data-testid="input-discount-value"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-gray-300">Valor Minimo do Pedido (opcional)</Label>
                <Input
                  type="number"
                  value={formData.minOrderValue}
                  onChange={(e) => setFormData({ ...formData, minOrderValue: e.target.value })}
                  placeholder="15.00"
                  className="bg-[#242424] border-gray-600 text-white"
                  data-testid="input-min-order"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-gray-300">Limite de Usos (opcional)</Label>
                <Input
                  type="number"
                  value={formData.maxUses}
                  onChange={(e) => setFormData({ ...formData, maxUses: e.target.value })}
                  placeholder="100"
                  className="bg-[#242424] border-gray-600 text-white"
                  data-testid="input-max-uses"
                />
              </div>

              <div className="flex items-center justify-between">
                <Label className="text-gray-300">Cupom Ativo</Label>
                <Switch
                  checked={formData.active}
                  onCheckedChange={(checked) => setFormData({ ...formData, active: checked })}
                  data-testid="switch-coupon-active"
                />
              </div>

              <Button
                onClick={handleSubmit}
                disabled={createMutation.isPending || updateMutation.isPending}
                className="w-full bg-purple-600 hover:bg-purple-700"
                data-testid="button-save-coupon"
              >
                {(createMutation.isPending || updateMutation.isPending) && (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                )}
                {editingCoupon ? "Salvar Alteracoes" : "Criar Cupom"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {coupons.length === 0 ? (
        <Card className="bg-[#1a1a1a] border-gray-700">
          <CardContent className="py-12 text-center">
            <Tag className="w-12 h-12 mx-auto text-gray-500 mb-4" />
            <p className="text-gray-400">Voce ainda nao tem cupons cadastrados</p>
            <p className="text-gray-500 text-sm mt-1">Crie cupons para atrair mais clientes</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {coupons.map((coupon) => (
            <Card 
              key={coupon.id} 
              className="bg-[#1a1a1a] border-gray-700"
              data-testid={`card-coupon-${coupon.id}`}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-lg bg-purple-500/20 flex items-center justify-center">
                      {coupon.discountType === "percent" ? (
                        <Percent className="w-6 h-6 text-purple-400" />
                      ) : (
                        <Tag className="w-6 h-6 text-purple-400" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white text-lg" data-testid={`text-coupon-code-${coupon.id}`}>
                          {coupon.code}
                        </span>
                        {coupon.active ? (
                          <span className="px-2 py-0.5 text-xs bg-green-500/20 text-green-400 rounded">
                            Ativo
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 text-xs bg-red-500/20 text-red-400 rounded">
                            Inativo
                          </span>
                        )}
                      </div>
                      <p className="text-gray-400 text-sm">
                        {coupon.discountType === "percent"
                          ? `${coupon.discountPercent || coupon.discountValue}% de desconto`
                          : `R$ ${parseFloat(coupon.discountValue || "0").toFixed(2)} de desconto`}
                        {coupon.minOrderValue && ` (min: R$ ${parseFloat(coupon.minOrderValue).toFixed(2)})`}
                      </p>
                      <p className="text-gray-500 text-xs">
                        Usado: {coupon.usedCount || 0}{coupon.maxUses ? `/${coupon.maxUses}` : ""} vezes
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handleOpenDialog(coupon)}
                      className="text-gray-400 hover:text-white"
                      data-testid={`button-edit-coupon-${coupon.id}`}
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => {
                        if (confirm("Tem certeza que deseja deletar este cupom?")) {
                          deleteMutation.mutate(coupon.id);
                        }
                      }}
                      className="text-red-400 hover:text-red-300"
                      data-testid={`button-delete-coupon-${coupon.id}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
