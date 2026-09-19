export type Project = {
  id: number;
  name: string;
  description: string;
  status: "active";
  repository_count: number;
  created_at: string;
  updated_at: string;
};

type CreatedProject = Omit<Project, "repository_count">;
type ProjectResponse = { project: CreatedProject };
type ProjectListResponse = { projects: Project[] };
type APIErrorResponse = { error?: { code?: string; message?: string } };

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "/api").replace(/\/$/, "");

export class APIError extends Error {
  status: number;
  code?: string;

  constructor(status: number, message: string, code?: string) {
    super(message);
    this.name = "APIError";
    this.status = status;
    this.code = code;
  }
}

async function request<T>(path: string, token: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });

  if (!response.ok) {
    let payload: APIErrorResponse = {};
    try {
      payload = (await response.json()) as APIErrorResponse;
    } catch {
      // Keep the HTTP status as the useful fallback when the server did not return JSON.
    }
    throw new APIError(
      response.status,
      payload.error?.message || `请求失败（${response.status}）`,
      payload.error?.code,
    );
  }

  return (await response.json()) as T;
}

export function listProjects(token: string): Promise<ProjectListResponse> {
  return request<ProjectListResponse>("/projects", token);
}

export function createProject(
  token: string,
  input: { name: string; description: string },
): Promise<ProjectResponse> {
  return request<ProjectResponse>("/projects", token, {
    method: "POST",
    body: JSON.stringify(input),
  });
}
