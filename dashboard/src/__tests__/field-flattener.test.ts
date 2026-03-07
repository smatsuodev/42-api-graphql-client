import { describe, it, expect } from "vitest";
import { flattenRows } from "../lib/field-flattener.ts";

describe("flattenRows", () => {
  it("returns flat rows unchanged", () => {
    const rows = [
      { id: 1, name: "test" },
      { id: 2, name: "other" },
    ];
    expect(flattenRows(rows)).toEqual(rows);
  });

  it("flattens nested objects with dot notation", () => {
    const rows = [
      {
        id: 1,
        project: { name: "libft", slug: "libft" },
      },
    ];
    expect(flattenRows(rows)).toEqual([
      {
        id: 1,
        "project.name": "libft",
        "project.slug": "libft",
      },
    ]);
  });

  it("flattens deeply nested objects", () => {
    const rows = [
      {
        id: 1,
        campus: {
          language: { name: "English" },
        },
      },
    ];
    expect(flattenRows(rows)).toEqual([
      {
        id: 1,
        "campus.language.name": "English",
      },
    ]);
  });

  it("preserves arrays as-is", () => {
    const rows = [{ id: 1, objectives: ["a", "b"] }];
    expect(flattenRows(rows)).toEqual([
      { id: 1, objectives: ["a", "b"] },
    ]);
  });

  it("handles null values", () => {
    const rows = [{ id: 1, endAt: null }];
    expect(flattenRows(rows)).toEqual([{ id: 1, endAt: null }]);
  });

  it("handles empty rows", () => {
    expect(flattenRows([])).toEqual([]);
  });
});
