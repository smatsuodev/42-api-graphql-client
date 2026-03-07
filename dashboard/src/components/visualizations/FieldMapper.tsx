import type { FieldMapping, VisualizationType } from "../../types/dashboard.ts";

interface Props {
  visualization: VisualizationType;
  mapping: FieldMapping;
  availableFields: string[];
  onChange: (mapping: FieldMapping) => void;
}

export function FieldMapper({
  visualization,
  mapping,
  availableFields,
  onChange,
}: Props) {
  if (visualization === "table" || visualization === "metric") return null;

  const isPie = visualization === "pie";

  return (
    <div className="space-y-2">
      <h4 className="text-sm font-medium">Field Mapping</h4>
      {isPie ? (
        <>
          <label className="block text-xs">
            Name Key
            <select
              className="block w-full mt-1 border rounded p-1 text-sm"
              value={mapping.nameKey ?? ""}
              onChange={(e) => onChange({ ...mapping, nameKey: e.target.value })}
            >
              <option value="">Auto</option>
              {availableFields.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs">
            Value Key
            <select
              className="block w-full mt-1 border rounded p-1 text-sm"
              value={mapping.valueKey ?? ""}
              onChange={(e) =>
                onChange({ ...mapping, valueKey: e.target.value })
              }
            >
              <option value="">Auto</option>
              {availableFields.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </label>
        </>
      ) : (
        <>
          <label className="block text-xs">
            X Axis
            <select
              className="block w-full mt-1 border rounded p-1 text-sm"
              value={mapping.xAxis ?? ""}
              onChange={(e) => onChange({ ...mapping, xAxis: e.target.value })}
            >
              <option value="">Auto</option>
              {availableFields.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs">
            Y Axis
            <select
              className="block w-full mt-1 border rounded p-1 text-sm"
              value={mapping.yAxis ?? ""}
              onChange={(e) => onChange({ ...mapping, yAxis: e.target.value })}
            >
              <option value="">Auto</option>
              {availableFields.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </label>
        </>
      )}
    </div>
  );
}
