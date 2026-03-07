import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import type { FlatRow } from "../../lib/field-flattener.ts";
import type { FieldMapping } from "../../types/dashboard.ts";

const COLORS = ["#6366f1", "#06b6d4", "#f59e0b", "#ef4444", "#8b5cf6", "#10b981", "#f97316"];

export function PieChartView({
  data,
  mapping,
}: {
  data: FlatRow[];
  mapping: FieldMapping;
}) {
  const nameKey = mapping.nameKey ?? Object.keys(data[0] ?? {})[0] ?? "name";
  const valueKey = mapping.valueKey ?? Object.keys(data[0] ?? {})[1] ?? "value";

  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie
          data={data}
          dataKey={valueKey}
          nameKey={nameKey}
          cx="50%"
          cy="50%"
          outerRadius="70%"
          label={({ name, percent }: { name: string; percent: number }) =>
            `${name} ${(percent * 100).toFixed(0)}%`
          }
        >
          {data.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  );
}
