export type RegressionMetrics = {
  mae: number;
  rmse: number;
  mape: number | null;
  wape: number | null;
  evaluatedRows: number;
};

export type ClassificationMetrics = {
  accuracy: number;
  precision: number;
  recall: number;
  f1: number;
  auc: number | null;
  prAuc: number | null;
  brierScore: number;
  expectedCalibrationError: number;
  threshold: number;
  evaluatedRows: number;
  positiveRows: number;
  negativeRows: number;
};

export type ProbabilityCalibration = {
  method: "platt";
  slope: number;
  intercept: number;
  fittedRows: number;
};

export type ChronologicalEvaluationSplit<T> = {
  trainRows: T[];
  validationRows: T[];
  embargoRows: T[];
  validationStart: Date | null;
};

export type ModelPromotionDecision = {
  passed: boolean;
  primaryMetric: string;
  candidateScore: number | null;
  baselineScore: number | null;
  improvementRatio: number | null;
  minimumImprovementRatio: number;
  reasons: string[];
};

export type ModelEvaluation = {
  split: {
    rowsConsidered: number;
    trainRows: number;
    validationRows: number;
    embargoRows: number;
    validationStart: string | null;
  };
  candidateMetrics: RegressionMetrics | ClassificationMetrics;
  baselineMetrics: RegressionMetrics | ClassificationMetrics;
  promotion: ModelPromotionDecision;
  calibration?: ProbabilityCalibration;
};

export function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function round(value: number, decimals = 4) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

export function sigmoid(value: number) {
  if (value >= 0) {
    const z = Math.exp(-value);
    return 1 / (1 + z);
  }

  const z = Math.exp(value);
  return z / (1 + z);
}

export function dot(first: readonly number[], second: readonly number[]) {
  let total = 0;
  for (let index = 0; index < first.length; index += 1) {
    total += (first[index] ?? 0) * (second[index] ?? 0);
  }
  return total;
}

export function sparseDot(weights: readonly number[] | Float64Array, row: ReadonlyArray<readonly [number, number]>) {
  let total = 0;
  for (const [index, value] of row) total += (weights[index] ?? 0) * value;
  return total;
}

export function trainValidationSplit<T>(rows: T[], validationRatio = 0.2) {
  if (rows.length < 2) {
    return { trainRows: rows, validationRows: rows };
  }

  const validationCount = Math.max(1, Math.floor(rows.length * validationRatio));
  const splitIndex = Math.max(1, rows.length - validationCount);

  return {
    trainRows: rows.slice(0, splitIndex),
    validationRows: rows.slice(splitIndex)
  };
}

export function chronologicalEvaluationSplit<
  T extends { observedAt: Date; labelAvailableAt?: Date }
>(
  rows: T[],
  {
    validationRatio = 0.2,
    minimumValidationRows = 1
  }: {
    validationRatio?: number;
    minimumValidationRows?: number;
  } = {}
): ChronologicalEvaluationSplit<T> {
  const sorted = rows
    .slice()
    .sort((first, second) => first.observedAt.getTime() - second.observedAt.getTime());

  if (sorted.length < 2) {
    return {
      trainRows: sorted,
      validationRows: sorted,
      embargoRows: [],
      validationStart: sorted[0]?.observedAt ?? null
    };
  }

  const requestedValidationRows = Math.min(
    sorted.length - 1,
    Math.max(minimumValidationRows, Math.floor(sorted.length * clamp(validationRatio, 0.05, 0.5)))
  );
  const provisionalIndex = Math.max(1, sorted.length - requestedValidationRows);
  const validationStart = sorted[provisionalIndex]?.observedAt ?? sorted[sorted.length - 1]!.observedAt;
  const validationRows = sorted.filter((row) => row.observedAt.getTime() >= validationStart.getTime());
  const beforeValidation = sorted.filter((row) => row.observedAt.getTime() < validationStart.getTime());
  const trainRows = beforeValidation.filter(
    (row) => (row.labelAvailableAt ?? row.observedAt).getTime() <= validationStart.getTime()
  );
  const trainSet = new Set(trainRows);
  const embargoRows = beforeValidation.filter((row) => !trainSet.has(row));

  return { trainRows, validationRows, embargoRows, validationStart };
}

export function boundedChronologicalRows<T>(rows: T[], maximumRows: number) {
  const limit = Math.max(1, Math.floor(maximumRows));
  if (rows.length <= limit) return rows.slice();
  if (limit === 1) return [rows[rows.length - 1]!];

  const selected: T[] = [];
  for (let index = 0; index < limit; index += 1) {
    const sourceIndex = Math.round((index * (rows.length - 1)) / (limit - 1));
    selected.push(rows[sourceIndex]!);
  }
  return selected;
}

export function calculateRegressionMetrics(predicted: number[], actual: number[]): RegressionMetrics {
  const rows = Math.min(predicted.length, actual.length);
  if (!rows) return { mae: 0, rmse: 0, mape: null, wape: null, evaluatedRows: 0 };

  let absoluteError = 0;
  let squaredError = 0;
  let absolutePercentageError = 0;
  let percentageRows = 0;
  let absoluteActual = 0;

  for (let index = 0; index < rows; index += 1) {
    const error = (predicted[index] ?? 0) - (actual[index] ?? 0);
    const absError = Math.abs(error);
    absoluteError += absError;
    squaredError += error * error;

    const actualValue = actual[index] ?? 0;
    absoluteActual += Math.abs(actualValue);
    if (Math.abs(actualValue) > 0.000001) {
      absolutePercentageError += absError / Math.abs(actualValue);
      percentageRows += 1;
    }
  }

  return {
    mae: round(absoluteError / rows),
    rmse: round(Math.sqrt(squaredError / rows)),
    mape: percentageRows ? round((absolutePercentageError / percentageRows) * 100) : null,
    wape: absoluteActual > 0.000001 ? round((absoluteError / absoluteActual) * 100) : null,
    evaluatedRows: rows
  };
}

export function calculateClassificationMetrics(probabilities: number[], labels: number[], threshold = 0.5): ClassificationMetrics {
  const rows = Math.min(probabilities.length, labels.length);
  if (!rows) {
    return {
      accuracy: 0,
      precision: 0,
      recall: 0,
      f1: 0,
      auc: null,
      prAuc: null,
      brierScore: 0,
      expectedCalibrationError: 0,
      threshold,
      evaluatedRows: 0,
      positiveRows: 0,
      negativeRows: 0
    };
  }

  let truePositive = 0;
  let trueNegative = 0;
  let falsePositive = 0;
  let falseNegative = 0;
  let positives = 0;
  let brierTotal = 0;

  for (let index = 0; index < rows; index += 1) {
    const label = labels[index] ? 1 : 0;
    const probability = clamp(probabilities[index] ?? 0, 0, 1);
    const predicted = probability >= threshold ? 1 : 0;
    brierTotal += (probability - label) ** 2;
    if (label === 1) positives += 1;
    if (predicted === 1 && label === 1) truePositive += 1;
    else if (predicted === 0 && label === 0) trueNegative += 1;
    else if (predicted === 1 && label === 0) falsePositive += 1;
    else falseNegative += 1;
  }

  const precision = truePositive + falsePositive ? truePositive / (truePositive + falsePositive) : 0;
  const recall = truePositive + falseNegative ? truePositive / (truePositive + falseNegative) : 0;
  const f1 = precision + recall ? (2 * precision * recall) / (precision + recall) : 0;

  return {
    accuracy: round((truePositive + trueNegative) / rows),
    precision: round(precision),
    recall: round(recall),
    f1: round(f1),
    auc: calculateAuc(probabilities.slice(0, rows), labels.slice(0, rows)),
    prAuc: calculateAveragePrecision(probabilities.slice(0, rows), labels.slice(0, rows)),
    brierScore: round(brierTotal / rows, 6),
    expectedCalibrationError: calculateExpectedCalibrationError(probabilities.slice(0, rows), labels.slice(0, rows)),
    threshold,
    evaluatedRows: rows,
    positiveRows: positives,
    negativeRows: rows - positives
  };
}

export function calculateAveragePrecision(probabilities: number[], labels: number[]) {
  const pairs = probabilities
    .map((score, index) => ({ score: clamp(score, 0, 1), label: labels[index] ? 1 : 0 }))
    .sort((first, second) => second.score - first.score);
  const positiveCount = pairs.filter((pair) => pair.label === 1).length;
  if (!positiveCount) return null;

  let truePositive = 0;
  let falsePositive = 0;
  let previousRecall = 0;
  let averagePrecision = 0;
  let cursor = 0;

  while (cursor < pairs.length) {
    let end = cursor + 1;
    while (end < pairs.length && pairs[end]?.score === pairs[cursor]?.score) end += 1;
    for (let index = cursor; index < end; index += 1) {
      if (pairs[index]?.label) truePositive += 1;
      else falsePositive += 1;
    }
    const recall = truePositive / positiveCount;
    const precision = truePositive / Math.max(1, truePositive + falsePositive);
    averagePrecision += (recall - previousRecall) * precision;
    previousRecall = recall;
    cursor = end;
  }

  return round(averagePrecision);
}

export function calculateExpectedCalibrationError(probabilities: number[], labels: number[], bins = 10) {
  const rows = Math.min(probabilities.length, labels.length);
  if (!rows) return 0;

  let error = 0;
  for (let bin = 0; bin < bins; bin += 1) {
    const lower = bin / bins;
    const upper = (bin + 1) / bins;
    const indexes = probabilities
      .slice(0, rows)
      .map((probability, index) => ({ probability: clamp(probability, 0, 1), index }))
      .filter(({ probability }) => probability >= lower && (bin === bins - 1 ? probability <= upper : probability < upper));
    if (!indexes.length) continue;
    const confidence = indexes.reduce((sum, item) => sum + item.probability, 0) / indexes.length;
    const observed = indexes.reduce((sum, item) => sum + (labels[item.index] ? 1 : 0), 0) / indexes.length;
    error += (indexes.length / rows) * Math.abs(confidence - observed);
  }
  return round(error, 6);
}

function probabilityLogit(probability: number) {
  const safe = clamp(probability, 0.000001, 0.999999);
  return Math.log(safe / (1 - safe));
}

export function fitPlattCalibration(probabilities: number[], labels: number[]): ProbabilityCalibration {
  const rows = Math.min(probabilities.length, labels.length);
  if (rows < 10 || !labels.slice(0, rows).some(Boolean) || labels.slice(0, rows).every(Boolean)) {
    return { method: "platt", slope: 1, intercept: 0, fittedRows: rows };
  }

  let slope = 1;
  let intercept = 0;
  const learningRate = 0.05;
  for (let iteration = 0; iteration < 180; iteration += 1) {
    let slopeGradient = 0;
    let interceptGradient = 0;
    for (let index = 0; index < rows; index += 1) {
      const logit = clamp(probabilityLogit(probabilities[index] ?? 0.5), -12, 12);
      const calibrated = sigmoid(slope * logit + intercept);
      const error = calibrated - (labels[index] ? 1 : 0);
      slopeGradient += error * logit;
      interceptGradient += error;
    }
    slope -= learningRate * (slopeGradient / rows + 0.001 * (slope - 1));
    intercept -= learningRate * (interceptGradient / rows);
  }

  return {
    method: "platt",
    slope: round(clamp(slope, 0.05, 8), 8),
    intercept: round(clamp(intercept, -8, 8), 8),
    fittedRows: rows
  };
}

export function applyProbabilityCalibration(probability: number, calibration?: ProbabilityCalibration) {
  if (!calibration) return clamp(probability, 0, 1);
  return sigmoid(calibration.slope * probabilityLogit(probability) + calibration.intercept);
}

export function selectClassificationThreshold(probabilities: number[], labels: number[]) {
  let bestThreshold = 0.5;
  let bestF1 = -1;
  for (let step = 10; step <= 90; step += 5) {
    const threshold = step / 100;
    const f1 = calculateClassificationMetrics(probabilities, labels, threshold).f1;
    if (f1 > bestF1 || (f1 === bestF1 && Math.abs(threshold - 0.5) < Math.abs(bestThreshold - 0.5))) {
      bestThreshold = threshold;
      bestF1 = f1;
    }
  }
  return bestThreshold;
}

export function regressionPromotionDecision(
  candidate: RegressionMetrics,
  baseline: RegressionMetrics,
  minimumImprovementRatio = 0.1
): ModelPromotionDecision {
  const candidateScore = candidate.wape ?? candidate.mae;
  const baselineScore = baseline.wape ?? baseline.mae;
  const improvementRatio = baselineScore > 0.000001
    ? (baselineScore - candidateScore) / baselineScore
    : candidateScore <= baselineScore
      ? 0
      : -1;
  const reasons: string[] = [];
  if (candidate.evaluatedRows < 30) reasons.push("At least 30 future validation rows are required.");
  if (improvementRatio < minimumImprovementRatio) {
    reasons.push(`Candidate must improve WAPE/MAE by at least ${Math.round(minimumImprovementRatio * 100)}% over the seasonal baseline.`);
  }

  return {
    passed: reasons.length === 0,
    primaryMetric: candidate.wape !== null && baseline.wape !== null ? "wape" : "mae",
    candidateScore,
    baselineScore,
    improvementRatio: round(improvementRatio, 6),
    minimumImprovementRatio,
    reasons
  };
}

export function classificationPromotionDecision(
  candidate: ClassificationMetrics,
  baseline: ClassificationMetrics,
  minimumImprovementRatio = 0.02
): ModelPromotionDecision {
  const candidateScore = candidate.prAuc;
  const baselineScore = baseline.prAuc;
  const discriminationLift = candidateScore !== null && baselineScore !== null ? candidateScore - baselineScore : null;
  const brierImprovement = baseline.brierScore > 0.000001
    ? (baseline.brierScore - candidate.brierScore) / baseline.brierScore
    : 0;
  const reasons: string[] = [];
  if (candidate.evaluatedRows < 50) reasons.push("At least 50 future validation rows are required.");
  if (candidate.positiveRows < 5 || candidate.negativeRows < 5) reasons.push("Validation needs at least 5 positive and 5 negative outcomes.");
  if (discriminationLift === null || discriminationLift < minimumImprovementRatio) {
    reasons.push(`Candidate PR-AUC must exceed the prevalence baseline by at least ${minimumImprovementRatio.toFixed(2)}.`);
  }
  if (brierImprovement < minimumImprovementRatio) {
    reasons.push(`Candidate Brier score must improve by at least ${Math.round(minimumImprovementRatio * 100)}%.`);
  }
  if (candidate.expectedCalibrationError > 0.2) reasons.push("Expected calibration error must be 0.20 or lower.");

  return {
    passed: reasons.length === 0,
    primaryMetric: "pr_auc_and_brier",
    candidateScore,
    baselineScore,
    improvementRatio: discriminationLift === null ? null : round(Math.min(discriminationLift, brierImprovement), 6),
    minimumImprovementRatio,
    reasons
  };
}

export function calculateAuc(probabilities: number[], labels: number[]) {
  const pairs = probabilities
    .map((score, index) => ({ score, label: labels[index] ? 1 : 0 }))
    .sort((first, second) => first.score - second.score);

  const positiveCount = pairs.filter((pair) => pair.label === 1).length;
  const negativeCount = pairs.length - positiveCount;
  if (!positiveCount || !negativeCount) return null;

  let rankSum = 0;
  let cursor = 0;

  while (cursor < pairs.length) {
    let end = cursor + 1;
    while (end < pairs.length && pairs[end]?.score === pairs[cursor]?.score) end += 1;
    const averageRank = (cursor + 1 + end) / 2;
    for (let index = cursor; index < end; index += 1) {
      if (pairs[index]?.label === 1) rankSum += averageRank;
    }
    cursor = end;
  }

  const auc = (rankSum - (positiveCount * (positiveCount + 1)) / 2) / (positiveCount * negativeCount);
  return round(auc);
}
