import type { HttpProject } from "./useHttpProjects";

const METHODS = ["get", "post", "put", "patch", "delete", "head", "options"] as const;

function id(prefix: string) { return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`; }
function variable(key: string, value: string) { return { id: id("var"), key, value, enabled: true }; }

export function importCollection(source: unknown): Partial<HttpProject> | null {
  if (!source || typeof source !== "object") return null;
  const raw = source as Record<string, any>;
  if (raw.openapi || raw.swagger) return fromOpenApi(raw);
  if (raw.info?.schema || Array.isArray(raw.item)) return fromPostman(raw);
  return null;
}

function fromOpenApi(raw: Record<string, any>): Partial<HttpProject> {
  const baseUrl = raw.servers?.[0]?.url || (raw.host ? `${raw.schemes?.[0] || "https"}://${raw.host}${raw.basePath || ""}` : "");
  const folders = new Set<string>(["默认模块"]);
  const interfaces: any[] = [];
  for (const [path, pathItem] of Object.entries(raw.paths || {})) {
    if (!pathItem || typeof pathItem !== "object") continue;
    for (const method of METHODS) {
      const operation = (pathItem as any)[method];
      if (!operation) continue;
      const folder = operation.tags?.[0] || "默认模块";
      folders.add(folder);
      const query = (operation.parameters || []).filter((p: any) => p.in === "query").map((p: any) => variable(p.name || "", p.example ?? p.default ?? ""));
      interfaces.push({ id: id("interface"), name: operation.summary || operation.operationId || `${method.toUpperCase()} ${path}`, method: method.toUpperCase(), path, folder, createdAt: new Date().toLocaleString("zh-CN", { hour12: false }), request: { method: method.toUpperCase(), url: `${String(baseUrl).replace(/\/$/, "")}${path}`, query, headers: [], cookies: [], body: "", bodyType: "none", timeoutMs: 15000 } });
    }
  }
  return { name: raw.info?.title || "导入的 OpenAPI 项目", description: raw.info?.description || "", interfaces, interfaceFolders: [...folders], environment: [variable("BASE_URL", baseUrl)], environments: [{ id: id("env"), name: "默认环境", baseUrl, variables: [variable("BASE_URL", baseUrl)] }] };
}

function fromPostman(raw: Record<string, any>): Partial<HttpProject> {
  const folders = new Set<string>(["默认模块"]);
  const interfaces: any[] = [];
  function visit(items: any[], folder = "默认模块") {
    for (const item of items || []) {
      if (Array.isArray(item.item)) { folders.add(item.name || folder); visit(item.item, item.name || folder); continue; }
      const request = item.request;
      if (!request) continue;
      const url = typeof request.url === "string" ? request.url : request.url?.raw || "/";
      const method = String(request.method || "GET").toUpperCase();
      interfaces.push({ id: id("interface"), name: item.name || `${method} ${url}`, method, path: url, folder, createdAt: new Date().toLocaleString("zh-CN", { hour12: false }), request: { method, url, query: [], headers: (request.header || []).map((h: any) => variable(h.key, h.value || "")), body: typeof request.body?.raw === "string" ? request.body.raw : "", bodyType: request.body?.mode === "urlencoded" ? "x-www-form-urlencoded" : request.body?.mode === "formdata" ? "form-data" : "none", timeoutMs: 15000 } });
    }
  }
  visit(raw.item || []);
  return { name: raw.info?.name || "导入的 Postman 项目", description: "从 Postman Collection 导入", interfaces, interfaceFolders: [...folders], environment: [], environments: [{ id: id("env"), name: "默认环境", baseUrl: "", variables: [] }] };
}

export function exportOpenApi(project: HttpProject) {
  const paths: Record<string, any> = {};
  for (const item of project.interfaces) {
    const path = item.path || item.request?.url || "/";
    const method = (item.method || "GET").toLowerCase();
    paths[path] ||= {};
    paths[path][method] = { summary: item.name, operationId: item.id, tags: [item.folder || "默认模块"], parameters: (item.request?.query || []).filter((p) => p.enabled && p.key).map((p) => ({ name: p.key, in: "query", required: false, schema: { type: "string" } })) };
  }
  const environment = project.environments?.find((item) => item.id === project.activeEnvironmentId) || project.environments?.[0];
  return { openapi: "3.0.3", info: { title: project.name, description: project.description, version: "1.0.0" }, servers: environment?.baseUrl ? [{ url: environment.baseUrl }] : [], paths };
}
