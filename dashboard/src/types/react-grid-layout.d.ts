declare module "react-grid-layout" {
  import type { ComponentType, ReactNode } from "react";

  export interface Layout {
    i: string;
    x: number;
    y: number;
    w: number;
    h: number;
    minW?: number;
    maxW?: number;
    minH?: number;
    maxH?: number;
    static?: boolean;
  }

  export interface ResponsiveProps {
    layouts?: Record<string, Layout[]>;
    breakpoints?: Record<string, number>;
    cols?: Record<string, number>;
    rowHeight?: number;
    width?: number;
    draggableHandle?: string;
    onLayoutChange?: (layout: Layout[], allLayouts: Record<string, Layout[]>) => void;
    onBreakpointChange?: (breakpoint: string, cols: number) => void;
    compactType?: "vertical" | "horizontal" | null;
    children?: ReactNode;
  }

  export const Responsive: ComponentType<ResponsiveProps>;
  export function WidthProvider<P extends object>(
    component: ComponentType<P>,
  ): ComponentType<Omit<P, "width">>;

  export default ComponentType<{
    layout?: Layout[];
    cols?: number;
    rowHeight?: number;
    width?: number;
    children?: ReactNode;
    onLayoutChange?: (layout: Layout[]) => void;
  }>;
}
