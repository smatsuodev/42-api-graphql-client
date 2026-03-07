import type { EndpointName } from "../types/dashboard.ts";

export type FieldType = "Int" | "String" | "Boolean" | "JSON";

export interface FieldDef {
  name: string;
  type: FieldType;
  required: boolean;
  children?: FieldDef[];
}

export interface EndpointMeta {
  queryName: EndpointName;
  label: string;
  fields: FieldDef[];
  filterFields: { name: string; type: string }[];
  rangeFields: string[];
  sortEnum: string[];
}

const projectSessionsFields: FieldDef[] = [
  { name: "id", type: "Int", required: true },
  { name: "solo", type: "Boolean", required: true },
  { name: "beginAt", type: "String", required: false },
  { name: "endAt", type: "String", required: false },
  { name: "estimateTime", type: "String", required: false },
  { name: "difficulty", type: "Int", required: false },
  { name: "description", type: "String", required: true },
  { name: "durationDays", type: "Int", required: false },
  { name: "terminatingAfter", type: "Int", required: false },
  { name: "projectId", type: "Int", required: true },
  { name: "campusId", type: "Int", required: false },
  { name: "cursusId", type: "Int", required: false },
  { name: "createdAt", type: "String", required: true },
  { name: "updatedAt", type: "String", required: true },
  { name: "maxPeople", type: "Int", required: false },
  { name: "isSubscriptable", type: "Boolean", required: true },
  { name: "teamBehaviour", type: "String", required: true },
  { name: "commit", type: "String", required: false },
  {
    name: "project",
    type: "String",
    required: true,
    children: [
      { name: "id", type: "Int", required: true },
      { name: "name", type: "String", required: true },
      { name: "slug", type: "String", required: true },
      { name: "difficulty", type: "Int", required: false },
      { name: "exam", type: "Boolean", required: true },
    ],
  },
  {
    name: "campus",
    type: "String",
    required: false,
    children: [
      { name: "id", type: "Int", required: true },
      { name: "name", type: "String", required: true },
      { name: "country", type: "String", required: true },
      { name: "city", type: "String", required: true },
      { name: "active", type: "Boolean", required: true },
      { name: "usersCount", type: "Int", required: true },
    ],
  },
  {
    name: "cursus",
    type: "String",
    required: false,
    children: [
      { name: "id", type: "Int", required: true },
      { name: "name", type: "String", required: true },
      { name: "slug", type: "String", required: true },
      { name: "kind", type: "String", required: true },
    ],
  },
];

const cursusFields: FieldDef[] = [
  { name: "id", type: "Int", required: true },
  { name: "createdAt", type: "String", required: true },
  { name: "name", type: "String", required: true },
  { name: "slug", type: "String", required: true },
  { name: "kind", type: "String", required: true },
];

const campusFields: FieldDef[] = [
  { name: "id", type: "Int", required: true },
  { name: "name", type: "String", required: true },
  { name: "timeZone", type: "String", required: true },
  { name: "usersCount", type: "Int", required: true },
  { name: "country", type: "String", required: true },
  { name: "address", type: "String", required: true },
  { name: "zip", type: "String", required: true },
  { name: "city", type: "String", required: true },
  { name: "website", type: "String", required: true },
  { name: "active", type: "Boolean", required: true },
  { name: "public", type: "Boolean", required: true },
  { name: "emailExtension", type: "String", required: false },
  {
    name: "language",
    type: "String",
    required: true,
    children: [
      { name: "id", type: "Int", required: true },
      { name: "name", type: "String", required: true },
      { name: "identifier", type: "String", required: true },
    ],
  },
  {
    name: "endpoint",
    type: "String",
    required: false,
    children: [
      { name: "id", type: "Int", required: true },
      { name: "url", type: "String", required: true },
      { name: "description", type: "String", required: true },
    ],
  },
];

export const endpoints: Record<EndpointName, EndpointMeta> = {
  projectSessions: {
    queryName: "projectSessions",
    label: "Project Sessions",
    fields: projectSessionsFields,
    filterFields: [
      { name: "id", type: "[Int]" },
      { name: "projectId", type: "[Int]" },
      { name: "campusId", type: "[Int]" },
      { name: "cursusId", type: "[Int]" },
      { name: "estimateTime", type: "[String]" },
      { name: "createdAt", type: "[String]" },
      { name: "updatedAt", type: "[String]" },
      { name: "beginAt", type: "[String]" },
      { name: "endAt", type: "[String]" },
      { name: "maxPeople", type: "[Int]" },
      { name: "durationDays", type: "[Int]" },
      { name: "terminatingAfter", type: "[Int]" },
      { name: "solo", type: "Boolean" },
      { name: "isSubscriptable", type: "Boolean" },
      { name: "teamBehaviour", type: "[String]" },
      { name: "difficulty", type: "[Int]" },
    ],
    rangeFields: [
      "id", "projectId", "campusId", "cursusId", "estimateTime",
      "createdAt", "updatedAt", "beginAt", "endAt", "maxPeople",
      "durationDays", "terminatingAfter", "difficulty",
    ],
    sortEnum: [
      "id", "projectId", "campusId", "cursusId", "estimateTime",
      "createdAt", "updatedAt", "beginAt", "endAt", "maxPeople",
      "durationDays", "terminatingAfter", "solo", "isSubscriptable",
      "teamBehaviour", "difficulty",
      "descId", "descProjectId", "descCampusId", "descCursusId",
      "descEstimateTime", "descCreatedAt", "descUpdatedAt",
      "descBeginAt", "descEndAt", "descMaxPeople", "descDurationDays",
      "descTerminatingAfter", "descSolo", "descIsSubscriptable",
      "descTeamBehaviour", "descDifficulty",
    ],
  },
  cursus: {
    queryName: "cursus",
    label: "Cursus",
    fields: cursusFields,
    filterFields: [
      { name: "id", type: "[Int]" },
      { name: "name", type: "[String]" },
      { name: "createdAt", type: "[String]" },
      { name: "updatedAt", type: "[String]" },
      { name: "slug", type: "[String]" },
      { name: "kind", type: "[String]" },
    ],
    rangeFields: ["id", "name", "createdAt", "updatedAt", "slug", "kind"],
    sortEnum: [
      "id", "name", "createdAt", "updatedAt", "slug", "kind",
      "descId", "descName", "descCreatedAt", "descUpdatedAt",
      "descSlug", "descKind",
    ],
  },
  campus: {
    queryName: "campus",
    label: "Campus",
    fields: campusFields,
    filterFields: [
      { name: "id", type: "[Int]" },
      { name: "name", type: "[String]" },
      { name: "createdAt", type: "[String]" },
      { name: "updatedAt", type: "[String]" },
      { name: "timeZone", type: "[String]" },
      { name: "city", type: "[String]" },
      { name: "country", type: "[String]" },
      { name: "active", type: "Boolean" },
    ],
    rangeFields: ["id", "name", "createdAt", "updatedAt", "timeZone"],
    sortEnum: [
      "id", "name", "createdAt", "updatedAt", "timeZone", "city",
      "country", "active",
      "descId", "descName", "descCreatedAt", "descUpdatedAt",
      "descTimeZone", "descCity", "descCountry", "descActive",
    ],
  },
};

export function flatFieldPaths(
  fields: FieldDef[],
  prefix = "",
): string[] {
  const result: string[] = [];
  for (const f of fields) {
    const path = prefix ? `${prefix}.${f.name}` : f.name;
    if (f.children) {
      result.push(...flatFieldPaths(f.children, path));
    } else {
      result.push(path);
    }
  }
  return result;
}
