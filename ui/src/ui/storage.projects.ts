/**
 * Projects storage - manages projects and their associated chat sessions
 * using localStorage for simplicity
 */

export type ProjectEntry = {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  sessionKeys?: string[];
};

const PROJECTS_STORAGE_KEY = "openclaw.projects.v1";
const COLLAPSED_PROJECTS_KEY = "openclaw.projects.collapsed.v1";

export function loadProjects(): ProjectEntry[] {
  try {
    const stored = localStorage.getItem(PROJECTS_STORAGE_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveProjects(projects: ProjectEntry[]): void {
  try {
    localStorage.setItem(PROJECTS_STORAGE_KEY, JSON.stringify(projects));
  } catch {
    // Ignore localStorage errors
  }
}

export function createProject(name: string): ProjectEntry {
  const id = `proj_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const now = Date.now();
  return {
    id,
    name: name.trim() || "Unnamed Project",
    createdAt: now,
    updatedAt: now,
    sessionKeys: [],
  };
}

export function updateProject(project: ProjectEntry, updates: Partial<ProjectEntry>): ProjectEntry {
  return {
    ...project,
    ...updates,
    updatedAt: Date.now(),
  };
}

export function deleteProject(projects: ProjectEntry[], projectId: string): ProjectEntry[] {
  return projects.filter((p) => p.id !== projectId);
}

export function addSessionToProject(
  projects: ProjectEntry[],
  projectId: string,
  sessionKey: string,
): ProjectEntry[] {
  return projects.map((p) => {
    if (p.id === projectId) {
      const sessionKeys = p.sessionKeys ?? [];
      if (!sessionKeys.includes(sessionKey)) {
        sessionKeys.push(sessionKey);
      }
      return updateProject(p, { sessionKeys });
    }
    return p;
  });
}

export function removeSessionFromProject(
  projects: ProjectEntry[],
  projectId: string,
  sessionKey: string,
): ProjectEntry[] {
  return projects.map((p) => {
    if (p.id === projectId) {
      const sessionKeys = (p.sessionKeys ?? []).filter((k) => k !== sessionKey);
      return updateProject(p, { sessionKeys });
    }
    return p;
  });
}

export function loadCollapsedProjects(): Set<string> {
  try {
    const stored = localStorage.getItem(COLLAPSED_PROJECTS_KEY);
    if (!stored) return new Set();
    const parsed = JSON.parse(stored);
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set();
  }
}

export function saveCollapsedProjects(collapsed: Set<string>): void {
  try {
    localStorage.setItem(COLLAPSED_PROJECTS_KEY, JSON.stringify(Array.from(collapsed)));
  } catch {
    // Ignore localStorage errors
  }
}

export function toggleProjectCollapsed(collapsed: Set<string>, projectId: string): Set<string> {
  const next = new Set(collapsed);
  if (next.has(projectId)) {
    next.delete(projectId);
  } else {
    next.add(projectId);
  }
  return next;
}
