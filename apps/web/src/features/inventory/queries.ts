import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import { getLocations, getWarehouses } from "../warehouses/api";
import {
  getInventoryOverview,
  getInventorySummary,
  inventoryKeys,
  setCycleCountFlag,
  type OverviewParams,
  type OverviewResponse,
} from "./overview";

// How long fetched data counts as fresh. While fresh, remounting the page or
// revisiting a filter combination is served from cache with no request. After
// it, cached data is still shown instantly and refetched in the background.
export const OVERVIEW_STALE_TIME_MS = 30_000;
export const SUMMARY_STALE_TIME_MS = 60_000;
const LOCATIONS_STALE_TIME_MS = 5 * 60_000;

export function useInventoryOverview(params: OverviewParams) {
  return useQuery({
    queryKey: inventoryKeys.overview(params),
    queryFn: ({ signal }) => getInventoryOverview(params, signal),
    staleTime: OVERVIEW_STALE_TIME_MS,
    // Keep showing the previous page/filter result while the next one loads,
    // so the table never blanks out between requests.
    placeholderData: keepPreviousData,
  });
}

export function useInventorySummary() {
  return useQuery({
    queryKey: inventoryKeys.summary,
    queryFn: ({ signal }) => getInventorySummary(signal),
    staleTime: SUMMARY_STALE_TIME_MS,
  });
}

// There is no "all locations" endpoint, so gather them per warehouse.
export function useAllLocations() {
  return useQuery({
    queryKey: ["locations", "all"],
    queryFn: async () => {
      const warehouses = (await getWarehouses()).data;
      const perWarehouse = await Promise.all(
        warehouses.map(async (warehouse) => ({
          warehouse,
          locations: (await getLocations(warehouse.id)).data,
        })),
      );

      return perWarehouse.flatMap(({ warehouse, locations }) =>
        locations.map((location) => ({
          id: location.id,
          label:
            warehouses.length > 1
              ? `${warehouse.code} · ${location.code}`
              : location.code,
        })),
      );
    },
    staleTime: LOCATIONS_STALE_TIME_MS,
  });
}

type FlagVariables = { id: string; flagged: boolean };

// Rewrites one row's flag in every cached overview page that contains it.
function patchFlag(
  queryClient: QueryClient,
  id: string,
  cycleCountFlaggedAt: string | null,
) {
  queryClient.setQueriesData<OverviewResponse>(
    { queryKey: inventoryKeys.overviewAll },
    (cached) =>
      cached && {
        ...cached,
        data: cached.data.map((item) =>
          item.id === id ? { ...item, cycleCountFlaggedAt } : item,
        ),
      },
  );
}

function readFlag(queryClient: QueryClient, id: string) {
  for (const [, cached] of queryClient.getQueriesData<OverviewResponse>({
    queryKey: inventoryKeys.overviewAll,
  })) {
    const item = cached?.data.find((row) => row.id === id);
    if (item) return item.cycleCountFlaggedAt;
  }

  return null;
}

const FLAG_MUTATION_KEY = ["inventory", "cycle-count-flag"] as const;

// Optimistic update: the table shows the new flag the instant the button is
// clicked, and is put back if the server rejects it.
export function useCycleCountFlag() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: FLAG_MUTATION_KEY,
    mutationFn: ({ id, flagged }: FlagVariables) =>
      setCycleCountFlag(id, flagged),

    onMutate: async ({ id, flagged }) => {
      // An in-flight refetch could land after our edit and overwrite it with
      // the old server state, so cancel those first.
      await queryClient.cancelQueries({ queryKey: inventoryKeys.overviewAll });

      const previous = readFlag(queryClient, id);
      patchFlag(queryClient, id, flagged ? new Date().toISOString() : null);

      return { previous };
    },

    // Roll back only this row, not a snapshot of the whole cache: with two
    // flags in flight, restoring a snapshot would also undo the other one.
    onError: (_error, { id }, context) => {
      patchFlag(queryClient, id, context?.previous ?? null);
    },

    // Whether it worked or not, replace our guess with what the server has.
    // Only the last in-flight flag refetches, so an earlier response cannot
    // briefly revert a later optimistic edit.
    onSettled: () => {
      if (queryClient.isMutating({ mutationKey: FLAG_MUTATION_KEY }) === 1) {
        return queryClient.invalidateQueries({
          queryKey: inventoryKeys.overviewAll,
        });
      }
    },
  });
}
