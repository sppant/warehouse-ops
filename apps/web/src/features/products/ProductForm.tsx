import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";

const productFormSchema = z.object({
  sku: z.string().trim().min(1, "SKU is required").max(100),
  name: z.string().trim().min(1, "Product name is required").max(200),
  description: z.string().trim().max(2000).optional(),
  unitCost: z
    .number({ error: "Unit cost is required" })
    .nonnegative("Unit cost cannot be negative"),
  unitWeightGrams: z
    .number({ error: "Weight must be a number" })
    .int("Weight must be a whole number")
    .positive("Weight must be greater than 0")
    .optional(),
});

export type ProductFormValues = z.infer<typeof productFormSchema>;

type ProductFormProps = {
  initialValues?: Partial<ProductFormValues>;
  submitLabel?: string;
  onSubmit: (values: ProductFormValues) => void | Promise<void>;
  onCancel: () => void;
  isSubmitting?: boolean;
};

export function ProductForm({
  initialValues,
  submitLabel = "Create product",
  onSubmit,
  onCancel,
  isSubmitting = false,
}: ProductFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ProductFormValues>({
    resolver: zodResolver(productFormSchema),
    defaultValues: {
      sku: initialValues?.sku ?? "",
      name: initialValues?.name ?? "",
      description: initialValues?.description ?? "",
      unitCost: initialValues?.unitCost ?? 0,
      unitWeightGrams: initialValues?.unitWeightGrams,
    },
  });

  return (
    <form className="form" onSubmit={handleSubmit(onSubmit)}>
      <div className="form-field">
        <label htmlFor="sku">SKU</label>
        <Input
          id="sku"
          placeholder="e.g. WH-1001"
          {...register("sku")}
        />
        {errors.sku && (
          <span className="form-error">{errors.sku.message}</span>
        )}
      </div>

      <div className="form-field">
        <label htmlFor="name">Product name</label>
        <Input
          id="name"
          placeholder="e.g. Wireless Scanner"
          {...register("name")}
        />
        {errors.name && (
          <span className="form-error">{errors.name.message}</span>
        )}
      </div>

      <div className="form-field">
        <label htmlFor="description">Description</label>
        <textarea
          id="description"
          placeholder="Optional product description"
          {...register("description")}
        />
        {errors.description && (
          <span className="form-error">{errors.description.message}</span>
        )}
      </div>

      <div className="form-field">
        <label htmlFor="unitCost">Unit cost (€)</label>
        <Input
          id="unitCost"
          type="number"
          step="0.01"
          min="0"
          {...register("unitCost", { valueAsNumber: true })}
        />
        {errors.unitCost && (
          <span className="form-error">{errors.unitCost.message}</span>
        )}
      </div>

      <div className="form-field">
        <label htmlFor="unitWeightGrams">Weight (grams)</label>
        <Input
          id="unitWeightGrams"
          type="number"
          min="1"
          placeholder="Optional"
          {...register("unitWeightGrams", { valueAsNumber: true })}
        />
        {errors.unitWeightGrams && (
          <span className="form-error">
            {errors.unitWeightGrams.message}
          </span>
        )}
      </div>

      <div className="form-actions">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>

        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Saving..." : submitLabel}
        </Button>
      </div>
    </form>
  );
}
