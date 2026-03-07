import { endpoints } from "../../lib/schema-metadata.ts";
import type { EndpointName } from "../../types/dashboard.ts";

interface Props {
  value: EndpointName;
  onChange: (endpoint: EndpointName) => void;
}

export function QuerySelector({ value, onChange }: Props) {
  return (
    <label className="block text-sm">
      <span className="font-medium">Endpoint</span>
      <select
        className="block w-full mt-1 border rounded p-2"
        value={value}
        onChange={(e) => onChange(e.target.value as EndpointName)}
      >
        {Object.entries(endpoints).map(([key, meta]) => (
          <option key={key} value={key}>
            {meta.label}
          </option>
        ))}
      </select>
    </label>
  );
}
