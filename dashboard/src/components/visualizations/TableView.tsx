import type { FlatRow } from "../../lib/field-flattener.ts";

export function TableView({ data }: { data: FlatRow[] }) {
  if (data.length === 0) return <p className="text-gray-500 p-4">No data</p>;
  const columns = Object.keys(data[0]!);

  return (
    <div className="overflow-auto h-full">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="bg-gray-100 sticky top-0">
            {columns.map((col) => (
              <th key={col} className="text-left p-2 border-b font-medium">
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr key={i} className="hover:bg-gray-50">
              {columns.map((col) => (
                <td key={col} className="p-2 border-b truncate max-w-[200px]">
                  {String(row[col] ?? "")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
