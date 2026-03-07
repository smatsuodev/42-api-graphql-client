export type FlatRow = Record<string, unknown>;

export function flattenRows(rows: Record<string, unknown>[]): FlatRow[] {
  return rows.map((row) => flattenObject(row));
}

function flattenObject(
  obj: Record<string, unknown>,
  prefix = "",
): FlatRow {
  const result: FlatRow = {};
  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value != null && typeof value === "object" && !Array.isArray(value)) {
      Object.assign(result, flattenObject(value as Record<string, unknown>, path));
    } else {
      result[path] = value;
    }
  }
  return result;
}
