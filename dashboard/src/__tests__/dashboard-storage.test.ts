import { describe, it, expect, beforeEach } from "vitest";
import {
  listDashboards,
  getDashboard,
  saveDashboard,
  deleteDashboard,
} from "../lib/dashboard-storage.ts";
import type { Dashboard } from "../types/dashboard.ts";

const makeDashboard = (id: string, title: string): Dashboard => ({
  id,
  title,
  panels: [],
  layouts: [],
});

describe("dashboard-storage", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("returns empty array when no dashboards saved", () => {
    expect(listDashboards()).toEqual([]);
  });

  it("saves and retrieves a dashboard", () => {
    const d = makeDashboard("1", "Test");
    saveDashboard(d);
    expect(getDashboard("1")).toEqual(d);
  });

  it("lists all saved dashboards", () => {
    saveDashboard(makeDashboard("1", "First"));
    saveDashboard(makeDashboard("2", "Second"));
    expect(listDashboards()).toHaveLength(2);
  });

  it("updates an existing dashboard", () => {
    saveDashboard(makeDashboard("1", "Original"));
    saveDashboard(makeDashboard("1", "Updated"));
    const all = listDashboards();
    expect(all).toHaveLength(1);
    expect(all[0]!.title).toBe("Updated");
  });

  it("deletes a dashboard", () => {
    saveDashboard(makeDashboard("1", "Test"));
    deleteDashboard("1");
    expect(listDashboards()).toEqual([]);
  });

  it("returns undefined for missing dashboard", () => {
    expect(getDashboard("nonexistent")).toBeUndefined();
  });
});
