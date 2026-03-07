import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { FlatRow } from "../../lib/field-flattener.ts";
import type { FieldMapping } from "../../types/dashboard.ts";

export function LineChartView({
  data,
  mapping,
}: {
  data: FlatRow[];
  mapping: FieldMapping;
}) {
  const xKey = mapping.xAxis ?? Object.keys(data[0] ?? {})[0] ?? "name";
  const yKey = mapping.yAxis ?? Object.keys(data[0] ?? {})[1] ?? "value";

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey={xKey} tick={{ fontSize: 12 }} />
        <YAxis tick={{ fontSize: 12 }} />
        <Tooltip />
        <Line type="monotone" dataKey={yKey} stroke="#6366f1" strokeWidth={2} />
      </LineChart>
    </ResponsiveContainer>
  );
}
