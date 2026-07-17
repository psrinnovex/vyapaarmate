import registry from "@/config/intelligence-benchmarks.json";

export const productionTrainingOrigins = ["LIVE", "HISTORICAL_IMPORT", "MANUAL"] as const;
export const excludedTrainingOrigins = ["EXTERNAL_BENCHMARK", "DEMO", "SEED", "TEST"] as const;

export type IntelligenceBenchmarkDataset = (typeof registry)[number];

export const intelligenceBenchmarkDatasets = registry as IntelligenceBenchmarkDataset[];

export function isProductionTrainingOrigin(value: string) {
  return productionTrainingOrigins.includes(value as (typeof productionTrainingOrigins)[number]);
}

export function benchmarkCanAffectProduction(dataset: IntelligenceBenchmarkDataset) {
  return dataset.productionTrainingEligible === true;
}
