import type { Project } from "./api";

export const DEMO_EMAIL = "demo@fluxcore.local";
export const DEMO_PASSWORD = "fluxcore-demo";
const DEMO_SESSION_KEY = "fluxcore.demo_session";
const DEMO_PROJECTS_KEY = "fluxcore.demo_projects";

const INITIAL_DEMO_PROJECTS: Project[] = [
  {
    id: 1,
    name: "FluxCore",
    description: "Git 原生研发状态记录系统",
    status: "active",
    repository_count: 2,
    created_at: "2026-09-08T09:30:00Z",
    updated_at: "2026-09-19T08:15:00Z",
  },
  {
    id: 2,
    name: "Atlas Notes",
    description: "把会议记录整理成可检索的本地知识库",
    status: "active",
    repository_count: 1,
    created_at: "2026-09-05T14:20:00Z",
    updated_at: "2026-09-17T11:42:00Z",
  },
  {
    id: 3,
    name: "Local Relay",
    description: "为离线开发环境提供轻量的事件转发层",
    status: "active",
    repository_count: 3,
    created_at: "2026-08-26T07:10:00Z",
    updated_at: "2026-09-16T16:05:00Z",
  },
  {
    id: 4,
    name: "Paper Trail",
    description: "研究资料与实验结论的版本化归档",
    status: "active",
    repository_count: 0,
    created_at: "2026-08-18T10:00:00Z",
    updated_at: "2026-09-12T13:28:00Z",
  },
];

function copyProjects(projects: Project[]): Project[] {
  return projects.map((project) => ({ ...project }));
}

function isProject(value: unknown): value is Project {
  if (typeof value !== "object" || value === null) return false;
  const project = value as Partial<Project>;
  return typeof project.id === "number" && Number.isSafeInteger(project.id) && project.id > 0
    && typeof project.name === "string" && project.name.trim().length > 0
    && typeof project.description === "string" && project.status === "active"
    && typeof project.repository_count === "number" && Number.isSafeInteger(project.repository_count)
    && project.repository_count >= 0
    && typeof project.created_at === "string" && typeof project.updated_at === "string";
}

export function isDemoSession(): boolean {
  return sessionStorage.getItem(DEMO_SESSION_KEY) === "true";
}

export function startDemoSession(): void {
  sessionStorage.setItem(DEMO_SESSION_KEY, "true");
  if (!sessionStorage.getItem(DEMO_PROJECTS_KEY)) {
    saveDemoProjects(INITIAL_DEMO_PROJECTS);
  }
}

export function clearDemoSession(): void {
  sessionStorage.removeItem(DEMO_SESSION_KEY);
}

export function readDemoProjects(): Project[] {
  const stored = sessionStorage.getItem(DEMO_PROJECTS_KEY);
  if (!stored) {
    saveDemoProjects(INITIAL_DEMO_PROJECTS);
    return copyProjects(INITIAL_DEMO_PROJECTS);
  }

  try {
    const projects: unknown = JSON.parse(stored);
    if (!Array.isArray(projects) || !projects.every(isProject)
      || new Set(projects.map((project) => project.id)).size !== projects.length) {
      throw new Error("Invalid demo project data");
    }
    return copyProjects(projects);
  } catch {
    saveDemoProjects(INITIAL_DEMO_PROJECTS);
    return copyProjects(INITIAL_DEMO_PROJECTS);
  }
}

function saveDemoProjects(projects: Project[]): void {
  sessionStorage.setItem(DEMO_PROJECTS_KEY, JSON.stringify(projects));
}

export function createDemoProject(input: { name: string; description: string }): Project {
  const projects = readDemoProjects();
  const nextId = projects.reduce((highest, project) => Math.max(highest, project.id), 0) + 1;
  const timestamp = new Date().toISOString();
  const project: Project = {
    id: nextId,
    name: input.name,
    description: input.description,
    status: "active",
    repository_count: 0,
    created_at: timestamp,
    updated_at: timestamp,
  };
  saveDemoProjects([...projects, project]);
  return project;
}
