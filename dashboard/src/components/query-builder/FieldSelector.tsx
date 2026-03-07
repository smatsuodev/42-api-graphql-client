import { type FieldDef, flatFieldPaths } from "../../lib/schema-metadata.ts";

interface Props {
  fields: FieldDef[];
  selected: string[];
  onChange: (fields: string[]) => void;
}

export function FieldSelector({ fields, selected, onChange }: Props) {
  const allPaths = flatFieldPaths(fields);

  function toggle(path: string) {
    if (selected.includes(path)) {
      onChange(selected.filter((f) => f !== path));
    } else {
      onChange([...selected, path]);
    }
  }

  function selectAll() {
    onChange(allPaths);
  }

  function selectNone() {
    onChange([]);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm font-medium">Fields</span>
        <div className="space-x-2 text-xs">
          <button
            type="button"
            onClick={selectAll}
            className="text-indigo-600 hover:underline"
          >
            All
          </button>
          <button
            type="button"
            onClick={selectNone}
            className="text-indigo-600 hover:underline"
          >
            None
          </button>
        </div>
      </div>
      <div className="max-h-48 overflow-y-auto border rounded p-2 space-y-1">
        {renderFields(fields, "", selected, toggle)}
      </div>
    </div>
  );
}

function renderFields(
  fields: FieldDef[],
  prefix: string,
  selected: string[],
  toggle: (path: string) => void,
) {
  return fields.map((f) => {
    const path = prefix ? `${prefix}.${f.name}` : f.name;
    if (f.children) {
      return (
        <div key={path} className="ml-2">
          <span className="text-xs text-gray-500 font-medium">{f.name}</span>
          {renderFields(f.children, path, selected, toggle)}
        </div>
      );
    }
    return (
      <label key={path} className="flex items-center gap-1 text-sm cursor-pointer">
        <input
          type="checkbox"
          checked={selected.includes(path)}
          onChange={() => toggle(path)}
          className="rounded"
        />
        <span className={prefix ? "ml-2" : ""}>{f.name}</span>
      </label>
    );
  });
}
