import { apiFetch } from "../../lib/api";

export type FeatureFlags = {
  movementsCsvExport: boolean;
};

// What the UI assumes until the server says otherwise, and when it cannot be
// reached: every flag is off.
export const allFlagsOff: FeatureFlags = { movementsCsvExport: false };

export async function getFeatureFlags(signal?: AbortSignal) {
  const response = await apiFetch<{ data: FeatureFlags }>("/api/config/flags", {
    signal,
  });

  return response.data;
}
