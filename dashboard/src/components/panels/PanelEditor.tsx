import { useState } from "react";
import type { Panel, VisualizationType } from "../../types/dashboard.ts";
import { endpoints } from "../../lib/schema-metadata.ts";
import { QuerySelector } from "../query-builder/QuerySelector.tsx";
import { FieldSelector } from "../query-builder/FieldSelector.tsx";
import { FilterBuilder } from "../query-builder/FilterBuilder.tsx";
import { FieldMapper } from "../visualizations/FieldMapper.tsx";

interface Props {
  panel: Panel;
  onSave: (panel: Panel) => void;
  onCancel: () => void;
}

const VIZ_OPTIONS: { value: VisualizationType; label: string }[] = [
  { value: "table", label: "Table" },
  { value: "bar", label: "Bar Chart" },
  { value: "line", label: "Line Chart" },
  { value: "pie", label: "Pie Chart" },
  { value: "metric", label: "Metric" },
];

export function PanelEditor({ panel, onSave, onCancel }: Props) {
  const [draft, setDraft] = useState<Panel>(structuredClone(panel));
  const meta = endpoints[draft.config.endpoint];

  return (
    <div className="space-y-4">
      <label className="block text-sm">
        <span className="font-medium">Title</span>
        <input
          className="block w-full mt-1 border rounded p-2"
          value={draft.title}
          onChange={(e) => setDraft({ ...draft, title: e.target.value })}
        />
      </label>

      <QuerySelector
        value={draft.config.endpoint}
        onChange={(endpoint) =>
          setDraft({
            ...draft,
            config: {
              ...draft.config,
              endpoint,
              fields: [],
              filters: [],
              ranges: [],
              sort: [],
            },
          })
        }
      />

      <FieldSelector
        fields={meta.fields}
        selected={draft.config.fields}
        onChange={(fields) =>
          setDraft({ ...draft, config: { ...draft.config, fields } })
        }
      />

      <FilterBuilder
        meta={meta}
        filters={draft.config.filters}
        ranges={draft.config.ranges}
        sort={draft.config.sort}
        pagination={draft.config.pagination}
        onFiltersChange={(filters) =>
          setDraft({ ...draft, config: { ...draft.config, filters } })
        }
        onRangesChange={(ranges) =>
          setDraft({ ...draft, config: { ...draft.config, ranges } })
        }
        onSortChange={(sort) =>
          setDraft({ ...draft, config: { ...draft.config, sort } })
        }
        onPaginationChange={(pagination) =>
          setDraft({ ...draft, config: { ...draft.config, pagination } })
        }
      />

      <label className="block text-sm">
        <span className="font-medium">Visualization</span>
        <select
          className="block w-full mt-1 border rounded p-2"
          value={draft.visualization}
          onChange={(e) =>
            setDraft({
              ...draft,
              visualization: e.target.value as VisualizationType,
            })
          }
        >
          {VIZ_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>

      <FieldMapper
        visualization={draft.visualization}
        mapping={draft.fieldMapping}
        availableFields={draft.config.fields}
        onChange={(fieldMapping) => setDraft({ ...draft, fieldMapping })}
      />

      <div className="flex gap-2 pt-2">
        <button
          type="button"
          onClick={() => onSave(draft)}
          className="flex-1 bg-indigo-600 text-white rounded py-2 text-sm hover:bg-indigo-700"
        >
          Apply
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 border rounded py-2 text-sm hover:bg-gray-50"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
