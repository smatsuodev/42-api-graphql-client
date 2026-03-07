import type { EndpointMeta } from "../../lib/schema-metadata.ts";
import type {
  FilterEntry,
  RangeEntry,
  PaginationConfig,
} from "../../types/dashboard.ts";

interface Props {
  meta: EndpointMeta;
  filters: FilterEntry[];
  ranges: RangeEntry[];
  sort: string[];
  pagination: PaginationConfig;
  onFiltersChange: (filters: FilterEntry[]) => void;
  onRangesChange: (ranges: RangeEntry[]) => void;
  onSortChange: (sort: string[]) => void;
  onPaginationChange: (pagination: PaginationConfig) => void;
}

export function FilterBuilder({
  meta,
  filters,
  ranges,
  sort,
  pagination,
  onFiltersChange,
  onRangesChange,
  onSortChange,
  onPaginationChange,
}: Props) {
  function addFilter() {
    const field = meta.filterFields[0]?.name ?? "";
    onFiltersChange([...filters, { field, value: "" }]);
  }

  function updateFilter(i: number, patch: Partial<FilterEntry>) {
    onFiltersChange(filters.map((f, idx) => (idx === i ? { ...f, ...patch } : f)));
  }

  function removeFilter(i: number) {
    onFiltersChange(filters.filter((_, idx) => idx !== i));
  }

  function addRange() {
    const field = meta.rangeFields[0] ?? "";
    onRangesChange([...ranges, { field, value: "" }]);
  }

  function updateRange(i: number, patch: Partial<RangeEntry>) {
    onRangesChange(ranges.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }

  function removeRange(i: number) {
    onRangesChange(ranges.filter((_, idx) => idx !== i));
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div>
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Filters</span>
          <button
            type="button"
            onClick={addFilter}
            className="text-xs text-indigo-600 hover:underline"
          >
            + Add
          </button>
        </div>
        {filters.map((f, i) => (
          <div key={i} className="flex gap-1 mt-1">
            <select
              className="border rounded p-1 text-sm flex-1"
              value={f.field}
              onChange={(e) => updateFilter(i, { field: e.target.value })}
            >
              {meta.filterFields.map((ff) => (
                <option key={ff.name} value={ff.name}>
                  {ff.name}
                </option>
              ))}
            </select>
            <input
              className="border rounded p-1 text-sm flex-1"
              value={f.value}
              onChange={(e) => updateFilter(i, { value: e.target.value })}
              placeholder="value"
            />
            <button
              type="button"
              onClick={() => removeFilter(i)}
              className="text-red-500 text-sm px-1"
            >
              x
            </button>
          </div>
        ))}
      </div>

      {/* Ranges */}
      <div>
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Ranges</span>
          <button
            type="button"
            onClick={addRange}
            className="text-xs text-indigo-600 hover:underline"
          >
            + Add
          </button>
        </div>
        {ranges.map((r, i) => (
          <div key={i} className="flex gap-1 mt-1">
            <select
              className="border rounded p-1 text-sm flex-1"
              value={r.field}
              onChange={(e) => updateRange(i, { field: e.target.value })}
            >
              {meta.rangeFields.map((rf) => (
                <option key={rf} value={rf}>
                  {rf}
                </option>
              ))}
            </select>
            <input
              className="border rounded p-1 text-sm flex-1"
              value={r.value}
              onChange={(e) => updateRange(i, { value: e.target.value })}
              placeholder="min,max"
            />
            <button
              type="button"
              onClick={() => removeRange(i)}
              className="text-red-500 text-sm px-1"
            >
              x
            </button>
          </div>
        ))}
      </div>

      {/* Sort */}
      <label className="block text-sm">
        <span className="font-medium">Sort</span>
        <select
          className="block w-full mt-1 border rounded p-1 text-sm"
          value={sort[0] ?? ""}
          onChange={(e) => onSortChange(e.target.value ? [e.target.value] : [])}
        >
          <option value="">None</option>
          {meta.sortEnum.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </label>

      {/* Pagination */}
      <div className="flex gap-2">
        <label className="block text-sm flex-1">
          <span className="font-medium">Page</span>
          <input
            type="number"
            className="block w-full mt-1 border rounded p-1 text-sm"
            value={pagination.pageNumber ?? ""}
            onChange={(e) =>
              onPaginationChange({
                ...pagination,
                pageNumber: e.target.value ? Number(e.target.value) : undefined,
              })
            }
            placeholder="1"
            min={1}
          />
        </label>
        <label className="block text-sm flex-1">
          <span className="font-medium">Page Size</span>
          <input
            type="number"
            className="block w-full mt-1 border rounded p-1 text-sm"
            value={pagination.pageSize ?? ""}
            onChange={(e) =>
              onPaginationChange({
                ...pagination,
                pageSize: e.target.value ? Number(e.target.value) : undefined,
              })
            }
            placeholder="30"
            min={1}
            max={100}
          />
        </label>
      </div>
    </div>
  );
}
