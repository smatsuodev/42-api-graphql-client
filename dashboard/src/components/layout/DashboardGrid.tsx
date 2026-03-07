import { useMemo, useCallback } from "react";
import { Responsive, WidthProvider } from "react-grid-layout";
import type { Layout } from "react-grid-layout";
import { useDashboard } from "../../hooks/useDashboard.ts";
import { PanelContainer } from "../panels/PanelContainer.tsx";

const ResponsiveGridLayout = WidthProvider(Responsive);

interface Props {
  onEditPanel: (panelId: string) => void;
}

export function DashboardGrid({ onEditPanel }: Props) {
  const { dashboard, dispatch } = useDashboard();

  const onLayoutChange = useCallback(
    (layout: Layout[]) => {
      dispatch({ type: "UPDATE_LAYOUTS", layouts: layout });
    },
    [dispatch],
  );

  const children = useMemo(
    () =>
      dashboard.panels.map((panel) => (
        <div key={panel.id}>
          <PanelContainer
            panel={panel}
            onEdit={() => onEditPanel(panel.id)}
          />
        </div>
      )),
    [dashboard.panels, onEditPanel],
  );

  if (dashboard.panels.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        <div className="text-center">
          <p className="text-lg">No panels yet</p>
          <p className="text-sm mt-1">Click "Add Panel" to get started</p>
        </div>
      </div>
    );
  }

  return (
    <ResponsiveGridLayout
      layouts={{ lg: dashboard.layouts }}
      breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
      cols={{ lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 }}
      rowHeight={60}
      draggableHandle=".drag-handle"
      onLayoutChange={onLayoutChange}
      compactType="vertical"
    >
      {children}
    </ResponsiveGridLayout>
  );
}
