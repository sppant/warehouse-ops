import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Modal } from "../components/ui/Modal";
import { PageHeader } from "../components/ui/PageHeader";
import {
  createLocation,
  getLocations,
  getWarehouses,
  type Warehouse,
} from "../features/warehouses/api";
import {
  LocationForm,
  type LocationFormValues,
} from "../features/warehouses/LocationForm";

export function LocationsPage() {
  const [selectedWarehouseId, setSelectedWarehouseId] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const queryClient = useQueryClient();

  const warehousesQuery = useQuery({
    queryKey: ["warehouses"],
    queryFn: getWarehouses,
  });

  useEffect(() => {
    if (
      !selectedWarehouseId &&
      warehousesQuery.data?.data.length
    ) {
      setSelectedWarehouseId(warehousesQuery.data.data[0].id);
    }
  }, [selectedWarehouseId, warehousesQuery.data]);

  const locationsQuery = useQuery({
    queryKey: ["locations", selectedWarehouseId],
    queryFn: () => getLocations(selectedWarehouseId),
    enabled: Boolean(selectedWarehouseId),
  });

  const createMutation = useMutation({
    mutationFn: (values: LocationFormValues) =>
      createLocation(selectedWarehouseId, values),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["locations", selectedWarehouseId],
      });

      setIsCreateOpen(false);
    },
  });

  const selectedWarehouse = warehousesQuery.data?.data.find(
    (warehouse: Warehouse) => warehouse.id === selectedWarehouseId,
  );

  return (
    <div>
      <PageHeader
        eyebrow="Warehouse"
        title="Locations"
        description="Manage storage locations within each warehouse."
        actions={
          <Button
            onClick={() => setIsCreateOpen(true)}
            disabled={!selectedWarehouseId}
          >
            Add location
          </Button>
        }
      />

      <Card className="locations-card">
        <div className="locations-toolbar">
          <div className="location-selector">
            <label htmlFor="warehouse-select">Warehouse</label>
            <select
              id="warehouse-select"
              value={selectedWarehouseId}
              onChange={(event) =>
                setSelectedWarehouseId(event.target.value)
              }
              disabled={warehousesQuery.isLoading}
            >
              {warehousesQuery.data?.data.map((warehouse) => (
                <option key={warehouse.id} value={warehouse.id}>
                  {warehouse.code} · {warehouse.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {warehousesQuery.isLoading && (
          <div className="table-state">Loading warehouses...</div>
        )}

        {warehousesQuery.isError && (
          <div className="table-state error">
            Unable to load warehouses. Make sure the API is running.
          </div>
        )}

        {warehousesQuery.isSuccess &&
          warehousesQuery.data.data.length === 0 && (
            <div className="table-state">
              No warehouses have been created yet.
            </div>
          )}

        {selectedWarehouse && locationsQuery.isLoading && (
          <div className="table-state">Loading locations...</div>
        )}

        {locationsQuery.isError && (
          <div className="table-state error">
            Unable to load locations.
          </div>
        )}

        {locationsQuery.isSuccess &&
          locationsQuery.data.data.length === 0 && (
            <div className="table-state">
              No locations have been created in this warehouse.
            </div>
          )}

        {locationsQuery.isSuccess &&
          locationsQuery.data.data.length > 0 && (
            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Location</th>
                    <th>Status</th>
                  </tr>
                </thead>

                <tbody>
                  {locationsQuery.data.data.map((location) => (
                    <tr key={location.id}>
                      <td>
                        <strong>{location.code}</strong>
                      </td>
                      <td>{location.name}</td>
                      <td>
                        <Badge variant="success">Active</Badge>
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
        title="Add location"
        description={
          selectedWarehouse
            ? `Add a storage location to ${selectedWarehouse.name}.`
            : "Add a storage location."
        }
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
              : "Unable to create location."}
          </div>
        )}

        <LocationForm
          onSubmit={async (values) => {
            await createMutation.mutateAsync(values);
          }}
          onCancel={() => setIsCreateOpen(false)}
          isSubmitting={createMutation.isPending}
        />
      </Modal>
    </div>
  );
}
