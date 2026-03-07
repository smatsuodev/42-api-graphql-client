import { describe, it, expect } from "vitest";
import { buildQuery } from "../lib/query-builder.ts";
import type { PanelConfig } from "../types/dashboard.ts";

describe("buildQuery", () => {
  it("builds a simple query with scalar fields", () => {
    const config: PanelConfig = {
      endpoint: "cursus",
      fields: ["id", "name", "kind"],
      filters: [],
      ranges: [],
      sort: [],
      pagination: {},
    };
    const result = buildQuery(config);
    expect(result.query).toBe(
      "query PanelQuery { cursus { id name kind } }",
    );
    expect(result.variables).toEqual({});
  });

  it("builds a query with nested fields", () => {
    const config: PanelConfig = {
      endpoint: "projectSessions",
      fields: ["id", "project.name", "project.slug"],
      filters: [],
      ranges: [],
      sort: [],
      pagination: {},
    };
    const result = buildQuery(config);
    expect(result.query).toBe(
      "query PanelQuery { projectSessions { id project { name slug } } }",
    );
  });

  it("builds a query with filters", () => {
    const config: PanelConfig = {
      endpoint: "campus",
      fields: ["id", "name"],
      filters: [{ field: "country", value: "Japan" }],
      ranges: [],
      sort: [],
      pagination: {},
    };
    const result = buildQuery(config);
    expect(result.query).toContain("$country: [String]");
    expect(result.query).toContain("country: $country");
    expect(result.variables["country"]).toEqual(["Japan"]);
  });

  it("builds a query with sort", () => {
    const config: PanelConfig = {
      endpoint: "cursus",
      fields: ["id", "name"],
      filters: [],
      ranges: [],
      sort: ["name"],
      pagination: {},
    };
    const result = buildQuery(config);
    expect(result.query).toContain("$sort: [QueryInputCursusSortItems]");
    expect(result.query).toContain("sort: $sort");
    expect(result.variables["sort"]).toEqual(["name"]);
  });

  it("builds a query with range", () => {
    const config: PanelConfig = {
      endpoint: "cursus",
      fields: ["id", "name"],
      filters: [],
      ranges: [{ field: "id", value: "1,10" }],
      sort: [],
      pagination: {},
    };
    const result = buildQuery(config);
    expect(result.query).toContain("$rangeId: String");
    expect(result.query).toContain("rangeId: $rangeId");
    expect(result.variables["rangeId"]).toBe("1,10");
  });

  it("builds a query with pagination", () => {
    const config: PanelConfig = {
      endpoint: "cursus",
      fields: ["id", "name"],
      filters: [],
      ranges: [],
      sort: [],
      pagination: { pageNumber: 2, pageSize: 10 },
    };
    const result = buildQuery(config);
    expect(result.query).toContain("$pageNumber: Int");
    expect(result.query).toContain("$pageSize: Int");
    expect(result.variables["pageNumber"]).toBe(2);
    expect(result.variables["pageSize"]).toBe(10);
  });

  it("parses boolean filter values", () => {
    const config: PanelConfig = {
      endpoint: "campus",
      fields: ["id", "name"],
      filters: [{ field: "active", value: "true" }],
      ranges: [],
      sort: [],
      pagination: {},
    };
    const result = buildQuery(config);
    expect(result.variables["active"]).toBe(true);
  });

  it("parses integer array filter values", () => {
    const config: PanelConfig = {
      endpoint: "projectSessions",
      fields: ["id"],
      filters: [{ field: "campusId", value: "1, 2, 3" }],
      ranges: [],
      sort: [],
      pagination: {},
    };
    const result = buildQuery(config);
    expect(result.variables["campusId"]).toEqual([1, 2, 3]);
  });
});
