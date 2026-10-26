import { useQuery } from "@tanstack/react-query";
import { allFlagsOff, getFeatureFlags } from "./api";

const FLAGS_STALE_TIME_MS = 5 * 60_000;

// Flags are read once per session and cached. While loading, and if the
// request fails, every flag reads as off, so a flagged feature never shows
// up by accident.
export function useFeatureFlags() {
  const query = useQuery({
    queryKey: ["config", "flags"],
    queryFn: ({ signal }) => getFeatureFlags(signal),
    staleTime: FLAGS_STALE_TIME_MS,
    retry: false,
  });

  return query.data ?? allFlagsOff;
}
