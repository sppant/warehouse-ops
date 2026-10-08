import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Badge } from "../components/ui/Badge";
import { Card } from "../components/ui/Card";
import { Input } from "../components/ui/Input";
import { PageHeader } from "../components/ui/PageHeader";
import { getProducts } from "../features/products/api";

export function ProductsPage() {
  const [search, setSearch] = useState("");

  const productsQuery = useQuery({
    queryKey: ["products", search],
    queryFn: () => getProducts(search),
  });

  return (
    <div>
      <PageHeader
        eyebrow="Catalog"
        title="Products"
        description="Manage products and stock-keeping units."
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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
