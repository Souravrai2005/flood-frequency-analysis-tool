export function formatValue(value) {
  if (value == null || value === "") {
    return "—";
  }
  if (typeof value === "boolean") {
    return value ? "True" : "False";
  }
  if (typeof value === "number") {
    if (Number.isNaN(value)) {
      return "—";
    }
    return String(value);
  }
  if (Array.isArray(value)) {
    if (!value.length) {
      return "—";
    }
    const simple = value.every(
      (item) => item == null || typeof item !== "object",
    );
    if (simple) {
      return value.map((item) => formatValue(item)).join(", ");
    }
    return JSON.stringify(value);
  }
  if (typeof value === "object") {
    return Object.entries(value)
      .map(([key, nested]) => `${key}: ${formatValue(nested)}`)
      .join("; ");
  }
  return String(value);
}

export function asRecordArray(value) {
  if (Array.isArray(value)) {
    return value.filter((row) => row && typeof row === "object" && !Array.isArray(row));
  }
  return [];
}

export function objectRows(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return [];
  }
  return Object.entries(value).map(([item, nested]) => ({
    item,
    value: nested,
  }));
}

export function columnsFromRows(rows, preferred = []) {
  const keys = [];
  const seen = new Set();
  for (const key of preferred) {
    if (rows.some((row) => Object.prototype.hasOwnProperty.call(row, key))) {
      keys.push(key);
      seen.add(key);
    }
  }
  for (const row of rows) {
    for (const key of Object.keys(row)) {
      if (!seen.has(key)) {
        keys.push(key);
        seen.add(key);
      }
    }
  }
  return keys.map((key) => ({ key, label: key }));
}

export function lookupRow(rows, key, expected) {
  return rows.find((row) => String(row?.[key]) === String(expected)) || null;
}

export function pickFigures(figures, pattern) {
  if (!Array.isArray(figures) || !pattern) {
    return [];
  }
  return figures.filter((figure) => pattern.test(String(figure?.name || "")));
}

export function remainingFigures(figures, used) {
  const usedSet = new Set(used);
  return (figures || []).filter((figure) => !usedSet.has(figure));
}
