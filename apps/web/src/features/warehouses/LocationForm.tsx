import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";

const locationFormSchema = z.object({
  code: z.string().trim().min(1, "Location code is required").max(50),
  name: z.string().trim().min(1, "Location name is required").max(200),
});

export type LocationFormValues = z.infer<typeof locationFormSchema>;

type LocationFormProps = {
  onSubmit: (values: LocationFormValues) => void | Promise<void>;
  onCancel: () => void;
  isSubmitting?: boolean;
};

export function LocationForm({
  onSubmit,
  onCancel,
  isSubmitting = false,
}: LocationFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LocationFormValues>({
    resolver: zodResolver(locationFormSchema),
    defaultValues: {
      code: "",
      name: "",
    },
  });

  return (
    <form className="form" onSubmit={handleSubmit(onSubmit)}>
      <div className="form-field">
        <label htmlFor="location-code">Location code</label>
        <Input
          id="location-code"
          placeholder="e.g. A-01-01"
          {...register("code")}
        />
        {errors.code && (
          <span className="form-error">{errors.code.message}</span>
        )}
      </div>

      <div className="form-field">
        <label htmlFor="location-name">Location name</label>
        <Input
          id="location-name"
          placeholder="e.g. Aisle A, Rack 01, Shelf 01"
          {...register("name")}
        />
        {errors.name && (
          <span className="form-error">{errors.name.message}</span>
        )}
      </div>

      <div className="form-actions">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>

        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Saving..." : "Add location"}
        </Button>
      </div>
    </form>
  );
}
