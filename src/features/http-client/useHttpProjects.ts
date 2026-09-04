import { ref, watch } from "vue";
import { loadVersionedJson, makeId, saveVersionedJson } from "@/utils/storage";
import type { HttpRequestConfig } from "./types";

export interface HttpProject {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  interfaces: HttpInterface[];
  environment: Array<{ id: string; key: string; value: string; enabled: boolean }>;
  environments: HttpEnvironment[];
  activeEnvironmentId: string;
  interfaceFolders: string[];
  sessionToken?: string;
}

export interface HttpEnvironment {
  id: string;
  name: string;
  baseUrl: string;
  variables: Array<{ id: string; key: string; value: string; enabled: boolean }>;
}

export interface HttpInterface {
  id: string;
  name: string;
  method: string;
  path: string;
  createdAt: string;
  folder?: string;
  request?: Partial<HttpRequestConfig> & {
    auth?: { enabled: boolean; responsePath: string; headerName: string; prefix: string; mode?: "none" | "bearer" | "api-key" | "basic"; username?: string; password?: string; apiKeyName?: string };
  };
}

const STORAGE_KEY = "NovaTool-http-projects";
const state = ref<HttpProject[]>(loadVersionedJson(STORAGE_KEY, [], 1, (value) => {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is HttpProject => {
    if (!item || typeof item !== "object") return false;
    const project = item as Partial<HttpProject>;
    return typeof project.id === "string" && typeof project.name === "string";
  });
}));

for (const project of state.value) {
  project.sessionToken = typeof project.sessionToken === "string" ? project.sessionToken : "";
  project.interfaces = Array.isArray(project.interfaces) ? project.interfaces : [];
  project.environment = Array.isArray(project.environment) ? project.environment : [];
  project.environments = Array.isArray(project.environments) && project.environments.length
    ? project.environments
    : [{ id: makeId("http-env"), name: "默认环境", baseUrl: "", variables: project.environment }];
  project.environments = project.environments.map((item) => ({
    ...item,
    baseUrl: typeof item.baseUrl === "string" ? item.baseUrl : "",
    variables: Array.isArray(item.variables) ? item.variables : [],
  }));
  project.activeEnvironmentId = project.activeEnvironmentId || project.environments[0].id;
  const active = project.environments.find((item) => item.id === project.activeEnvironmentId) || project.environments[0];
  project.activeEnvironmentId = active.id;
  project.environment = active.variables;
  project.interfaceFolders = Array.isArray(project.interfaceFolders) && project.interfaceFolders.length
    ? project.interfaceFolders
    : ["默认模块"];
}

watch(state, persist, { deep: true });

function persist() {
  saveVersionedJson(STORAGE_KEY, state.value, 1);
}

export function useHttpProjects() {
  function createProject(name: string, description = "") {
    const project: HttpProject = {
      id: makeId("http-project"),
      name: name.trim(),
      description: description.trim(),
      createdAt: new Date().toLocaleString("zh-CN", { hour12: false }),
      interfaces: [],
      environment: [],
      environments: [{ id: makeId("http-env"), name: "默认环境", baseUrl: "", variables: [] }],
      activeEnvironmentId: "",
      interfaceFolders: ["默认模块"],
      sessionToken: "",
    };
    project.activeEnvironmentId = project.environments[0].id;
    state.value.unshift(project);
    persist();
    return project;
  }

  function createInterface(projectId: string, name: string, method = "GET", path = "/") {
    const project = state.value.find((item) => item.id === projectId);
    if (!project) return null;
    const item: HttpInterface = { id: makeId("http-interface"), name: name.trim(), method, path: path.trim() || "/", createdAt: new Date().toLocaleString("zh-CN", { hour12: false }) };
    project.interfaces.unshift(item);
    persist();
    return item;
  }

  function deleteInterface(projectId: string, interfaceId: string) {
    const project = state.value.find((item) => item.id === projectId);
    if (!project) return;
    project.interfaces = project.interfaces.filter((item) => item.id !== interfaceId);
    persist();
  }

  function deleteProject(id: string) {
    state.value = state.value.filter((project) => project.id !== id);
    persist();
  }

  function importProject(project: HttpProject) {
    if (!project?.id || !project.name) return null;
    const normalized = { ...project, id: makeId("http-project"), interfaces: Array.isArray(project.interfaces) ? project.interfaces : [], interfaceFolders: Array.isArray(project.interfaceFolders) && project.interfaceFolders.length ? project.interfaceFolders : ["默认模块"] };
    state.value.unshift(normalized);
    persist();
    return normalized;
  }

  return { projects: state, createProject, deleteProject, createInterface, deleteInterface, importProject };
}
