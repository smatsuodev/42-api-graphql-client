import { useState, useCallback } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { DashboardProvider, useDashboard } from "./hooks/useDashboard.ts";
import { DashboardHeader } from "./components/layout/DashboardHeader.tsx";
import { DashboardGrid } from "./components/layout/DashboardGrid.tsx";
import { Sidebar } from "./components/layout/Sidebar.tsx";
import { PanelEditor } from "./components/panels/PanelEditor.tsx";

const queryClient = new QueryClient();

function DashboardApp() {
  const { dashboard, dispatch } = useDashboard();
  const [editingPanelId, setEditingPanelId] = useState<string | null>(null);

  const editingPanel = editingPanelId
    ? dashboard.panels.find((p) => p.id === editingPanelId)
    : null;

  const handleEditPanel = useCallback((panelId: string) => {
    setEditingPanelId(panelId);
  }, []);

  return (
    <div className="min-h-screen bg-gray-100">
      <DashboardHeader onEditPanel={handleEditPanel} />
      <main className="p-4">
        <DashboardGrid onEditPanel={handleEditPanel} />
      </main>
      <Sidebar
        open={editingPanel != null}
        onClose={() => setEditingPanelId(null)}
        title="Edit Panel"
      >
        {editingPanel && (
          <PanelEditor
            key={editingPanel.id}
            panel={editingPanel}
            onSave={(updated) => {
              dispatch({ type: "UPDATE_PANEL", panel: updated });
              setEditingPanelId(null);
            }}
            onCancel={() => setEditingPanelId(null)}
          />
        )}
      </Sidebar>
    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <DashboardProvider>
        <DashboardApp />
      </DashboardProvider>
    </QueryClientProvider>
  );
}
