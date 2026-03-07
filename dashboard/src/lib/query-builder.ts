import type { PanelConfig } from "../types/dashboard.ts";
import { endpoints, type FieldDef } from "./schema-metadata.ts";

function buildSelectionSet(fields: string[], allFields: FieldDef[]): string {
  const grouped = new Map<string, string[]>();
  const scalars: string[] = [];

  for (const field of fields) {
    const dotIndex = field.indexOf(".");
    if (dotIndex === -1) {
      scalars.push(field);
    } else {
      const parent = field.slice(0, dotIndex);
      const rest = field.slice(dotIndex + 1);
      const existing = grouped.get(parent) ?? [];
      existing.push(rest);
      grouped.set(parent, existing);
    }
  }

  const parts: string[] = [...scalars];

  for (const [parent, children] of grouped) {
    const parentDef = allFields.find((f) => f.name === parent);
    const childDefs = parentDef?.children ?? [];
    const innerSelection = buildSelectionSet(children, childDefs);
    parts.push(`${parent} { ${innerSelection} }`);
  }

  return parts.join(" ");
}

export interface BuiltQuery {
  query: string;
  variables: Record<string, unknown>;
}

export function buildQuery(config: PanelConfig): BuiltQuery {
  const meta = endpoints[config.endpoint];
  const selectionSet = buildSelectionSet(config.fields, meta.fields);

  const argDefs: string[] = [];
  const argUsages: string[] = [];
  const variables: Record<string, unknown> = {};

  if (config.sort.length > 0) {
    argDefs.push("$sort: [QueryInput${EP}SortItems]");
    argUsages.push("sort: $sort");
    variables["sort"] = config.sort;
  }

  for (const filter of config.filters) {
    const filterMeta = meta.filterFields.find((f) => f.name === filter.field);
    if (!filterMeta) continue;
    const varName = filter.field;
    argDefs.push(`$${varName}: ${filterMeta.type}`);
    argUsages.push(`${varName}: $${varName}`);
    variables[varName] = parseFilterValue(filter.value, filterMeta.type);
  }

  for (const range of config.ranges) {
    const varName = `range${range.field[0]!.toUpperCase()}${range.field.slice(1)}`;
    argDefs.push(`$${varName}: String`);
    argUsages.push(`${varName}: $${varName}`);
    variables[varName] = range.value;
  }

  if (config.pagination.pageNumber != null) {
    argDefs.push("$pageNumber: Int");
    argUsages.push("pageNumber: $pageNumber");
    variables["pageNumber"] = config.pagination.pageNumber;
  }
  if (config.pagination.pageSize != null) {
    argDefs.push("$pageSize: Int");
    argUsages.push("pageSize: $pageSize");
    variables["pageSize"] = config.pagination.pageSize;
  }

  const epMap: Record<string, string> = {
    projectSessions: "ProjectSessions",
    cursus: "Cursus",
    campus: "Campus",
  };
  const resolvedArgDefs = argDefs.map((d) =>
    d.replace("${EP}", epMap[config.endpoint]!),
  );

  const argDefsStr =
    resolvedArgDefs.length > 0 ? `(${resolvedArgDefs.join(", ")})` : "";
  const argUsagesStr =
    argUsages.length > 0 ? `(${argUsages.join(", ")})` : "";

  const query = `query PanelQuery${argDefsStr} { ${meta.queryName}${argUsagesStr} { ${selectionSet} } }`;

  return { query, variables };
}

function parseFilterValue(
  value: string,
  type: string,
): string | number | boolean | string[] | number[] {
  if (type === "Boolean") return value === "true";
  if (type === "[Int]") return value.split(",").map((v) => Number(v.trim()));
  if (type === "[String]") return value.split(",").map((v) => v.trim());
  return value;
}
