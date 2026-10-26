import { ApiError, apiUrl } from "../../lib/api";

const fileNameFrom = (response: Response, sku: string) =>
  /filename="([^"]+)"/.exec(response.headers.get("Content-Disposition") ?? "")?.[1] ??
  `movements-${sku}.csv`;

// Fetches the CSV (rather than navigating to it) so a 404 or 400 can be shown
// as a message instead of downloading an error body as a file.
export async function downloadMovementsCsv(sku: string) {
  const response = await fetch(
    apiUrl(`/api/items/${encodeURIComponent(sku)}/movements.csv`),
  );

  if (!response.ok) {
    const body = await response.json().catch(() => null);

    throw new ApiError(body?.error ?? "Could not export the CSV", response.status);
  }

  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement("a");

  link.href = url;
  link.download = fileNameFrom(response, sku);
  link.click();
  URL.revokeObjectURL(url);
}
