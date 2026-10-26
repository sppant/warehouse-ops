// Feature flags: a fixed list of names, all off unless FEATURE_FLAGS turns
// them on. FEATURE_FLAGS is a comma-separated list, e.g.
//   FEATURE_FLAGS=movementsCsvExport npm run dev:api
// Deployed environments do not set it, so every flag is off there.

export const featureFlagNames = ["movementsCsvExport"] as const;

export type FeatureFlagName = (typeof featureFlagNames)[number];
export type FeatureFlags = Record<FeatureFlagName, boolean>;

export const allFlagsOff = (): FeatureFlags => ({
  movementsCsvExport: false,
});

export const parseFeatureFlags = (raw: string | undefined): FeatureFlags => {
  const flags = allFlagsOff();

  for (const name of (raw ?? "").split(",").map((part) => part.trim())) {
    if (name === "") {
      continue;
    }

    if ((featureFlagNames as readonly string[]).includes(name)) {
      flags[name as FeatureFlagName] = true;
    } else {
      // A typo must not take the API down, and the flag stays off.
      console.warn(`Ignoring unknown feature flag "${name}" in FEATURE_FLAGS`);
    }
  }

  return flags;
};

export const readFeatureFlags = (env: NodeJS.ProcessEnv = process.env) =>
  parseFeatureFlags(env.FEATURE_FLAGS);
