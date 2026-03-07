import type { FlatRow } from "../../lib/field-flattener.ts";
import type { FieldMapping } from "../../types/dashboard.ts";

export function MetricDisplay({
  data,
  mapping,
}: {
  data: FlatRow[];
  mapping: FieldMapping;
}) {
  const valueKey = mapping.valueKey;
  let display: string;

  if (valueKey && data.length > 0) {
    const values = data
      .map((r) => Number(r[valueKey]))
      .filter((n) => !Number.isNaN(n));
    const sum = values.reduce((a, b) => a + b, 0);
    const avg = values.length > 0 ? sum / values.length : 0;
    display = `Count: ${data.length} | Sum: ${sum} | Avg: ${avg.toFixed(1)}`;
  } else {
    display = `Count: ${data.length}`;
  }

  return (
    <div className="flex items-center justify-center h-full">
      <div className="text-center">
        <p className="text-3xl font-bold text-indigo-600">{data.length}</p>
        <p className="text-sm text-gray-500 mt-1">{display}</p>
      </div>
    </div>
  );
}
