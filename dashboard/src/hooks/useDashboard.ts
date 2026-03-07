import {
  createContext,
  useContext,
  useReducer,
  type Dispatch,
  type ReactNode,
} from "react";
import { createElement } from "react";
import type { Dashboard, Panel } from "../types/dashboard.ts";
import type { Layout } from "react-grid-layout";

type Action =
  | { type: "ADD_PANEL"; panel: Panel }
  | { type: "UPDATE_PANEL"; panel: Panel }
  | { type: "REMOVE_PANEL"; panelId: string }
  | { type: "UPDATE_LAYOUTS"; layouts: Layout[] }
  | { type: "SET_DASHBOARD"; dashboard: Dashboard }
  | { type: "SET_TITLE"; title: string };

function reducer(state: Dashboard, action: Action): Dashboard {
  switch (action.type) {
    case "ADD_PANEL":
      return {
        ...state,
        panels: [...state.panels, action.panel],
        layouts: [
          ...state.layouts,
          { i: action.panel.id, x: 0, y: Infinity, w: 6, h: 4 },
        ],
      };
    case "UPDATE_PANEL":
      return {
        ...state,
        panels: state.panels.map((p) =>
          p.id === action.panel.id ? action.panel : p,
        ),
      };
    case "REMOVE_PANEL":
      return {
        ...state,
        panels: state.panels.filter((p) => p.id !== action.panelId),
        layouts: state.layouts.filter((l) => l.i !== action.panelId),
      };
    case "UPDATE_LAYOUTS":
      return { ...state, layouts: action.layouts };
    case "SET_DASHBOARD":
      return action.dashboard;
    case "SET_TITLE":
      return { ...state, title: action.title };
  }
}

export function createEmptyDashboard(): Dashboard {
  return {
    id: crypto.randomUUID(),
    title: "New Dashboard",
    panels: [],
    layouts: [],
  };
}

interface DashboardContextValue {
  dashboard: Dashboard;
  dispatch: Dispatch<Action>;
}

const DashboardContext = createContext<DashboardContextValue | null>(null);

export function DashboardProvider({
  children,
  initial,
}: {
  children: ReactNode;
  initial?: Dashboard;
}) {
  const [dashboard, dispatch] = useReducer(
    reducer,
    initial ?? createEmptyDashboard(),
  );

  return createElement(
    DashboardContext.Provider,
    { value: { dashboard, dispatch } },
    children,
  );
}

export function useDashboard() {
  const ctx = useContext(DashboardContext);
  if (!ctx) throw new Error("useDashboard must be used within DashboardProvider");
  return ctx;
}
