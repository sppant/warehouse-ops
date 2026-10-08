import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Input } from "../components/ui/Input";
import { Modal } from "../components/ui/Modal";
import { PageHeader } from "../components/ui/PageHeader";
import { ProductForm } from "../features/products/ProductForm";
import {
  createProduct,
  getProducts,
  updateProduct,
  type Product,
} from "../features/products/api";

export function ProductsPage() {
  const [search, setSearch] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  const queryClient = useQueryClient();

  const productsQuery = useQuery({
    queryKey: ["products", search],
    queryFn: () => getProducts(search),
  });

  const createMutation = useMutation({
    mutationFn: createProduct,
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["products"],
      });

      setIsCreateOpen(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      values,
    }: {
      id: string;
      values: Parameters<typeof updateProduct>[1];
    }) => updateProduct(id, values),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["products"],
      });

      setEditingProduct(null);
    },
  });

  return (
    <div>
      <PageHeader
        eyebrow="Catalog"
        title="Products"
        description="Manage products and stock-keeping units."
        actions={
          <Button onClick={() => setIsCreateOpen(true)}>
            Add product
          </Button>
        }
      />

      <Card className="products-card">
        <div className="products-toolbar">
          <Input
            type="search"
            placeholder="Search SKU or product name..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>

        {productsQuery.isLoading && (
          <div className="table-state">Loading products...</div>
        )}

        {productsQuery.isError && (
          <div className="table-state error">
            Unable to load products. Make sure the API is running.
          </div>
        )}

        {productsQuery.isSuccess && productsQuery.data.data.length === 0 && (
          <div className="table-state">
            {search
              ? "No products match your search."
              : "No products have been created yet."}
          </div>
        )}

        {productsQuery.isSuccess && productsQuery.data.data.length > 0 && (
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>SKU</th>
                  <th>Product</th>
                  <th>Unit cost</th>
                  <th>Weight</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>

              <tbody>
                {productsQuery.data.data.map((product) => (
                  <tr key={product.id}>
                    <td>
                      <strong>{product.sku}</strong>
                    </td>

                    <td>
                      <div className="product-name">
                        <strong>{product.name}</strong>
                        {product.description && (
                          <span>{product.description}</span>
                        )}
                      </div>
                    </td>

                    <td>€{Number(product.unitCost).toFixed(2)}</td>

                    <td>
                      {product.unitWeightGrams
                        ? `${product.unitWeightGrams} g`
                        : "-"}
                    </td>

                    <td>
                      <Badge variant={product.isActive ? "success" : "neutral"}>
                        {product.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </td>

                    <td>
                      <Button
                        variant="ghost"
                        onClick={() => setEditingProduct(product)}
                      >
                        Edit
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal
        open={isCreateOpen}
        title="Create product"
        description="Add a new product to the warehouse catalog."
        onClose={() => {
          if (!createMutation.isPending) {
            setIsCreateOpen(false);
          }
        }}
      >
        {createMutation.isError && (
          <div className="form-error form-server-error">
            {createMutation.error instanceof Error
              ? createMutation.error.message
              : "Unable to create product."}
          </div>
        )}

        <ProductForm
          onSubmit={async (values) => {
            await createMutation.mutateAsync(values);
          }}
          onCancel={() => setIsCreateOpen(false)}
          isSubmitting={createMutation.isPending}
        />
      </Modal>

      <Modal
        open={editingProduct !== null}
        title="Edit product"
        description="Update the product catalog information."
        onClose={() => {
          if (!updateMutation.isPending) {
            setEditingProduct(null);
          }
        }}
      >
        {updateMutation.isError && (
          <div className="form-error form-server-error">
            {updateMutation.error instanceof Error
              ? updateMutation.error.message
              : "Unable to update product."}
          </div>
        )}

        {editingProduct && (
          <ProductForm
            initialValues={{
              sku: editingProduct.sku,
              name: editingProduct.name,
              description: editingProduct.description ?? "",
              unitCost: Number(editingProduct.unitCost),
              unitWeightGrams:
                editingProduct.unitWeightGrams ?? undefined,
            }}
            submitLabel="Save changes"
            onSubmit={async (values) => {
              await updateMutation.mutateAsync({
                id: editingProduct.id,
                values,
              });
            }}
            onCancel={() => setEditingProduct(null)}
            isSubmitting={updateMutation.isPending}
          />
        )}
      </Modal>
    </div>
  );
}
