import { apiFetch } from "../../lib/api";

export type Product = {
  id: string;
  sku: string;
  name: string;
  description: string | null;
  unitCost: string;
  unitWeightGrams: number | null;
  isActive: boolean;
  createdAt: string;
};

export type CreateProductInput = {
  sku: string;
  name: string;
  description?: string | null;
  unitCost: number;
  unitWeightGrams?: number | null;
};

export type UpdateProductInput = Partial<CreateProductInput> & {
  isActive?: boolean;
};

type ProductsResponse = {
  data: Product[];
};

type ProductResponse = {
  data: Product;
};

export function getProducts(search?: string) {
  const query = search ? `?search=${encodeURIComponent(search)}` : "";

  return apiFetch<ProductsResponse>(`/api/products${query}`);
}

export function createProduct(input: CreateProductInput) {
  return apiFetch<ProductResponse>("/api/products", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateProduct(id: string, input: UpdateProductInput) {
  return apiFetch<ProductResponse>(`/api/products/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}
