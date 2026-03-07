import { useGraphQLQuery } from "../../hooks/useGraphQLQuery.ts";
import { useDashboard } from "../../hooks/useDashboard.ts";
import type { Panel } from "../../types/dashboard.ts";
import { TableView } from "../visualizations/TableView.tsx";
import { BarChartView } from "../visualizations/BarChartView.tsx";
import { LineChartView } from "../visualizations/LineChartView.tsx";
import { PieChartView } from "../visualizations/PieChartView.tsx";
import { MetricDisplay } from "../visualizations/MetricDisplay.tsx";

interface Props {
  panel: Panel;
  onEdit: () => void;
}

export function PanelContainer({ panel, onEdit }: Props) {
  const { dispatch } = useDashboard();
  const { data, isLoading, error } = useGraphQLQuery(panel.id, panel.config);

  const rows = data ?? [];

  function renderVisualization() {
    if (panel.config.fields.length === 0) {
      return (
        <p className="text-gray-400 text-sm p-4">
          Configure this panel to start querying data.
        </p>
      );
    }
    if (isLoading) {
      return <p className="text-gray-400 text-sm p-4">Loading...</p>;
    }
    if (error) {
      return (
        <p className="text-red-500 text-sm p-4">
          Error: {error instanceof Error ? error.message : "Unknown error"}
        </p>
      );
    }

    switch (panel.visualization) {
      case "table":
        return <TableView data={rows} />;
      case "bar":
        return <BarChartView data={rows} mapping={panel.fieldMapping} />;
      case "line":
        return <LineChartView data={rows} mapping={panel.fieldMapping} />;
      case "pie":
        return <PieChartView data={rows} mapping={panel.fieldMapping} />;
      case "metric":
        return <MetricDisplay data={rows} mapping={panel.fieldMapping} />;
    }
  }

  return (
    <div className="flex flex-col h-full bg-white rounded-lg border shadow-sm">
      <div className="flex items-center justify-between px-3 py-2 border-b bg-gray-50 rounded-t-lg cursor-move drag-handle">
        <h3 className="text-sm font-semibold truncate">{panel.title}</h3>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={onEdit}
            className="text-xs text-indigo-600 hover:text-indigo-800 px-1"
          >
            Edit
          </button>
          <button
            type="button"
            onClick={() => dispatch({ type: "REMOVE_PANEL", panelId: panel.id })}
            className="text-xs text-red-500 hover:text-red-700 px-1"
          >
            Remove
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-hidden p-1">{renderVisualization()}</div>
    </div>
  );
}
