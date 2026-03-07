import { useDashboard, createEmptyDashboard } from "../../hooks/useDashboard.ts";
import { saveDashboard, listDashboards } from "../../lib/dashboard-storage.ts";
import type { Panel } from "../../types/dashboard.ts";

interface Props {
  onEditPanel: (panelId: string) => void;
}

export function DashboardHeader({ onEditPanel }: Props) {
  const { dashboard, dispatch } = useDashboard();

  function handleAddPanel() {
    const newPanel: Panel = {
      id: crypto.randomUUID(),
      title: "New Panel",
      config: {
        endpoint: "projectSessions",
        fields: [],
        filters: [],
        ranges: [],
        sort: [],
        pagination: {},
      },
      visualization: "table",
      fieldMapping: {},
    };
    dispatch({ type: "ADD_PANEL", panel: newPanel });
    onEditPanel(newPanel.id);
  }

  function handleSave() {
    saveDashboard(dashboard);
  }

  function handleLoad() {
    const all = listDashboards();
    if (all.length === 0) {
      alert("No saved dashboards found.");
      return;
    }
    const names = all.map((d, i) => `${i + 1}. ${d.title}`).join("\n");
    const choice = prompt(`Choose a dashboard:\n${names}`);
    if (!choice) return;
    const idx = Number(choice) - 1;
    const selected = all[idx];
    if (selected) {
      dispatch({ type: "SET_DASHBOARD", dashboard: selected });
    }
  }

  function handleNew() {
    dispatch({ type: "SET_DASHBOARD", dashboard: createEmptyDashboard() });
  }

  return (
    <header className="flex items-center justify-between px-4 py-3 bg-white border-b shadow-sm">
      <div className="flex items-center gap-3">
        <h1 className="text-lg font-bold text-indigo-700">42 Visualizer</h1>
        <input
          className="border rounded px-2 py-1 text-sm"
          value={dashboard.title}
          onChange={(e) => dispatch({ type: "SET_TITLE", title: e.target.value })}
        />
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleAddPanel}
          className="bg-indigo-600 text-white px-3 py-1.5 rounded text-sm hover:bg-indigo-700"
        >
          Add Panel
        </button>
        <button
          type="button"
          onClick={handleSave}
          className="border px-3 py-1.5 rounded text-sm hover:bg-gray-50"
        >
          Save
        </button>
        <button
          type="button"
          onClick={handleLoad}
          className="border px-3 py-1.5 rounded text-sm hover:bg-gray-50"
        >
          Load
        </button>
        <button
          type="button"
          onClick={handleNew}
          className="border px-3 py-1.5 rounded text-sm hover:bg-gray-50"
        >
          New
        </button>
      </div>
    </header>
  );
}
