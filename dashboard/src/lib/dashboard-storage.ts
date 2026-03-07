import type { Dashboard } from "../types/dashboard.ts";

const STORAGE_KEY = "42viz-dashboards";

function readAll(): Dashboard[] {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  return JSON.parse(raw) as Dashboard[];
}

function writeAll(dashboards: Dashboard[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(dashboards));
}

export function listDashboards(): Dashboard[] {
  return readAll();
}

export function getDashboard(id: string): Dashboard | undefined {
  return readAll().find((d) => d.id === id);
}

export function saveDashboard(dashboard: Dashboard): void {
  const all = readAll();
  const index = all.findIndex((d) => d.id === dashboard.id);
  if (index >= 0) {
    all[index] = dashboard;
  } else {
    all.push(dashboard);
  }
  writeAll(all);
}

export function deleteDashboard(id: string): void {
  writeAll(readAll().filter((d) => d.id !== id));
}
