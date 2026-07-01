export type RegressionMetrics = {
  mae: number;
  rmse: number;
  mape: number | null;
  evaluatedRows: number;
};

export type ClassificationMetrics = {
  accuracy: number;
  precision: number;
  recall: number;
  f1: number;
  auc: number | null;
  threshold: number;
  evaluatedRows: number;
  positiveRows: number;
  negativeRows: number;
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

export function calculateRegressionMetrics(predicted: number[], actual: number[]): RegressionMetrics {
  const rows = Math.min(predicted.length, actual.length);
  if (!rows) return { mae: 0, rmse: 0, mape: null, evaluatedRows: 0 };

  let absoluteError = 0;
  let squaredError = 0;
  let absolutePercentageError = 0;
  let percentageRows = 0;

  for (let index = 0; index < rows; index += 1) {
    const error = (predicted[index] ?? 0) - (actual[index] ?? 0);
    const absError = Math.abs(error);
    absoluteError += absError;
    squaredError += error * error;

    const actualValue = actual[index] ?? 0;
    if (Math.abs(actualValue) > 0.000001) {
      absolutePercentageError += absError / Math.abs(actualValue);
      percentageRows += 1;
    }
  }

  return {
    mae: round(absoluteError / rows),
    rmse: round(Math.sqrt(squaredError / rows)),
    mape: percentageRows ? round((absolutePercentageError / percentageRows) * 100) : null,
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

  for (let index = 0; index < rows; index += 1) {
    const label = labels[index] ? 1 : 0;
    const predicted = (probabilities[index] ?? 0) >= threshold ? 1 : 0;
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
    threshold,
    evaluatedRows: rows,
    positiveRows: positives,
    negativeRows: rows - positives
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
