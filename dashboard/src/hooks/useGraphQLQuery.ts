import { useQuery } from "@tanstack/react-query";
import { graphqlClient } from "../lib/graphql-client.ts";
import { buildQuery } from "../lib/query-builder.ts";
import { flattenRows, type FlatRow } from "../lib/field-flattener.ts";
import type { PanelConfig, EndpointName } from "../types/dashboard.ts";

export function useGraphQLQuery(panelId: string, config: PanelConfig) {
  return useQuery<FlatRow[]>({
    queryKey: ["panel", panelId, config],
    queryFn: async () => {
      if (config.fields.length === 0) return [];
      const { query, variables } = buildQuery(config);
      const data = await graphqlClient.request<
        Record<EndpointName, Record<string, unknown>[]>
      >(query, variables);
      const rows = data[config.endpoint] ?? [];
      return flattenRows(rows);
    },
    enabled: config.fields.length > 0,
    staleTime: 60_000,
  });
}
