import type { Layout } from "react-grid-layout";

export type VisualizationType =
  | "table"
  | "bar"
  | "line"
  | "pie"
  | "metric";

export type EndpointName = "projectSessions" | "cursus" | "campus";

export interface FilterEntry {
  field: string;
  value: string;
}

export interface RangeEntry {
  field: string;
  value: string;
}

export interface PaginationConfig {
  pageNumber?: number;
  pageSize?: number;
}

export interface FieldMapping {
  xAxis?: string;
  yAxis?: string;
  nameKey?: string;
  valueKey?: string;
}

export interface PanelConfig {
  endpoint: EndpointName;
  fields: string[];
  filters: FilterEntry[];
  ranges: RangeEntry[];
  sort: string[];
  pagination: PaginationConfig;
}

export interface Panel {
  id: string;
  title: string;
  config: PanelConfig;
  visualization: VisualizationType;
  fieldMapping: FieldMapping;
}

export interface Dashboard {
  id: string;
  title: string;
  panels: Panel[];
  layouts: Layout[];
}
