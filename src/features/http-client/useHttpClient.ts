import { computed, ref, watch, type Ref } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { useMessage } from "naive-ui";
import { makeId, loadJson, saveJson } from "@/utils/storage";
import { queryJson } from "@/features/query/queryService";
import type { HttpProject } from "./useHttpProjects";
import type { HttpHistoryItem, HttpKeyValue, HttpMethod, HttpRequestConfig, HttpResponse, HttpTemplate } from "./types";
import { buildCurl, parseCurl } from "./curlService";

const HISTORY_KEY = "NovaTool-http-history";
const TEMPLATES_KEY = "NovaTool-http-templates";
const ENVIRONMENT_KEY = "NovaTool-http-environment";
const DEFAULT_HEADERS: HttpKeyValue[] = [{ id: makeId("header"), key: "Accept", value: "application/json", enabled: true }];

function row(key = "", value = ""): HttpKeyValue {
  return { id: makeId("param"), key, value, enabled: true };
}

export function useHttpClient(
  projectId?: Ref<string | null>,
  projects?: Ref<HttpProject[]>,
  interfaceId?: Ref<string | null>,
) {
  const message = useMessage();
  const method = ref<HttpMethod>("GET");
  const url = ref("https://httpbin.org/get");
  const query = ref<HttpKeyValue[]>([row()]);
  const headers = ref<HttpKeyValue[]>(DEFAULT_HEADERS);
  const body = ref("");
  const bodyFields = ref<HttpKeyValue[]>([row()]);
  const bodyType = ref<HttpRequestConfig["bodyType"]>("none");
  const timeoutMs = ref(15000);
  const loading = ref(false);
  const response = ref<HttpResponse | null>(null);
  const error = ref("");
  const history = ref<HttpHistoryItem[]>(loadJson(HISTORY_KEY, []));
  const selectedHistoryId = ref<string | null>(null);
  const templates = ref<HttpTemplate[]>(loadJson(TEMPLATES_KEY, []));
  const selectedTemplateId = ref<string | null>(null);
  const templateName = ref("");
  const environment = ref<HttpKeyValue[]>(loadJson(ENVIRONMENT_KEY, [row("BASE_URL", "https://httpbin.org")]));
  const curlText = ref("");
  const sessionAuth = ref({
    enabled: false,
    responsePath: "$.tokenValue",
    headerName: "Authorization",
    prefix: "",
    token: "",
  });

  function currentInterface() {
    const project = projects?.value.find((item) => item.id === projectId?.value);
    return project?.interfaces.find((item) => item.id === interfaceId?.value);
  }

  function restoreInterfaceRequest() {
    const saved = currentInterface()?.request;
    if (!saved) {
      method.value = "GET";
      url.value = "";
      query.value = [row()];
      headers.value = [{ ...DEFAULT_HEADERS[0], id: makeId("header") }];
      body.value = "";
      bodyFields.value = [row()];
      bodyType.value = "none";
      timeoutMs.value = 15000;
      sessionAuth.value = { enabled: false, responsePath: "$.tokenValue", headerName: "Authorization", prefix: "", token: "" };
      return;
    }
    method.value = saved.method ?? "GET";
    url.value = saved.url ?? "";
    query.value = saved.query?.map((item) => ({ ...item, id: makeId("param") })) ?? [row()];
    headers.value = saved.headers?.map((item) => ({ ...item, id: makeId("header") })) ?? [row()];
    body.value = saved.body ?? "";
    bodyFields.value = saved.bodyFields?.map((item) => ({ ...item, id: makeId("body") })) ?? [row()];
    bodyType.value = saved.bodyType ?? "none";
    timeoutMs.value = saved.timeoutMs ?? 15000;
    sessionAuth.value = {
      enabled: saved.auth?.enabled ?? false,
      responsePath: saved.auth?.responsePath ?? "$.tokenValue",
      headerName: saved.auth?.headerName ?? "Authorization",
      prefix: saved.auth?.prefix ?? "",
      token: "",
    };
  }

  function persistInterfaceRequest() {
    const item = currentInterface();
    if (!item) return;
    item.method = method.value;
    item.request = {
      method: method.value,
      url: url.value,
      query: query.value,
      headers: headers.value,
      body: body.value,
      bodyFields: bodyFields.value,
      bodyType: bodyType.value,
      timeoutMs: timeoutMs.value,
      auth: {
        enabled: sessionAuth.value.enabled,
        responsePath: sessionAuth.value.responsePath,
        headerName: sessionAuth.value.headerName,
        prefix: sessionAuth.value.prefix,
      },
    };
  }

  const enabledHeaders = computed(() => headers.value.filter((item) => item.enabled && item.key.trim()));
  const requestHeaders = computed(() => {
    const sessionHeader = sessionAuth.value.enabled && sessionAuth.value.token
      ? { key: sessionAuth.value.headerName.trim() || "Authorization", value: sessionAuth.value.prefix + sessionAuth.value.token }
      : null;
    const normalHeaders = enabledHeaders.value.filter((item) => !sessionHeader || item.key.toLowerCase() !== sessionHeader.key.toLowerCase());
    return sessionHeader ? [...normalHeaders, sessionHeader] : normalHeaders;
  });
  const enabledQuery = computed(() => query.value.filter((item) => item.enabled && item.key.trim()));
  const responseHeaders = computed(() => response.value ? Object.entries(response.value.headers) : []);
  const responseBody = computed(() => {
    const value = response.value?.body ?? "";
    if (!value) return "";
    const contentType = response.value?.headers["content-type"] ?? "";
    if (contentType.includes("json")) {
      try { return JSON.stringify(JSON.parse(value), null, 2); } catch { return value; }
    }
    return value;
  });

  watch(history, (value) => saveJson(HISTORY_KEY, value), { deep: true });
  watch(templates, (value) => saveJson(TEMPLATES_KEY, value), { deep: true });
  watch(environment, (value) => {
    const project = projects?.value.find((item) => item.id === projectId?.value);
    if (project) project.environment = value;
    else saveJson(ENVIRONMENT_KEY, value);
  }, { deep: true });
  watch(projectId ?? ref(null), (id) => {
    const project = projects?.value.find((item) => item.id === id);
    environment.value = project?.environment?.length
      ? project.environment.map((item) => ({ ...item, id: makeId("env") }))
      : [row("BASE_URL", "https://httpbin.org")];
  }, { immediate: true });
  watch(interfaceId ?? ref(null), restoreInterfaceRequest, { immediate: true });
  watch(
    [method, url, query, headers, body, bodyFields, bodyType, timeoutMs, sessionAuth],
    persistInterfaceRequest,
    { deep: true },
  );

  function addQuery() { query.value.push(row()); }
  function addHeader() { headers.value.push(row()); }
  function addBodyField() { bodyFields.value.push(row()); }
  function removeRow(list: HttpKeyValue[], id: string) {
    const next = list.filter((item) => item.id !== id);
    if (list === query.value) query.value = next.length ? next : [row()];
    else if (list === headers.value) headers.value = next.length ? next : [row()];
    else if (list === bodyFields.value) bodyFields.value = next.length ? next : [row()];
    else environment.value = next;
  }

  function addEnvironment() { environment.value.push(row()); }

  function applyTemplate(id: string | null) {
    const item = templates.value.find((entry) => entry.id === id);
    if (!item) return;
    selectedTemplateId.value = item.id;
    templateName.value = item.name;
    method.value = item.method;
    url.value = item.url;
    query.value = item.query.map((entry) => ({ ...entry, id: makeId("param") }));
    headers.value = item.headers.map((entry) => ({ ...entry, id: makeId("header") }));
    body.value = item.body;
    bodyFields.value = item.bodyFields?.map((entry) => ({ ...entry, id: makeId("body") })) ?? [row()];
    bodyType.value = item.bodyType;
    timeoutMs.value = item.timeoutMs;
    response.value = null;
    error.value = "";
  }

  function saveTemplate() {
    const name = templateName.value.trim();
    if (!name) { message.warning("请输入模板名称"); return; }
    const item: HttpTemplate = {
      id: selectedTemplateId.value ?? makeId("template"), name, createdAt: new Date().toLocaleString("zh-CN", { hour12: false }),
      method: method.value, url: url.value, query: query.value, headers: headers.value,
      body: body.value, bodyType: bodyType.value, timeoutMs: timeoutMs.value,
    };
    templates.value = [item, ...templates.value.filter((entry) => entry.id !== item.id && entry.name !== name)].slice(0, 50);
    selectedTemplateId.value = item.id;
    message.success("请求模板已保存");
  }

  function resolve(value: string) {
    return value.replace(/\{\{\s*([A-Za-z_][\w.-]*)\s*\}\}/g, (match, key: string) => {
      const variable = environment.value.find((item) => item.enabled && item.key.trim() === key);
      return variable ? variable.value : match;
    });
  }

  function captureSessionToken(responseText: string) {
    if (!sessionAuth.value.enabled || !sessionAuth.value.responsePath.trim()) return;
    try {
      const values = queryJson(responseText, sessionAuth.value.responsePath);
      const token = values[0];
      if (typeof token === "string" && token.trim()) {
        sessionAuth.value.token = token.trim();
        message.success("已提取 Token，后续请求将自动携带");
      }
    } catch {
      // 非 JSON 响应或路径不存在时，不影响本次请求结果
    }
  }

  function applyHistory(id: string | null) {
    const item = history.value.find((entry) => entry.id === id);
    if (!item) return;
    selectedHistoryId.value = item.id;
    method.value = item.method;
    url.value = item.url;
    query.value = item.query.map((entry) => ({ ...entry, id: makeId("param") }));
    headers.value = item.headers.map((entry) => ({ ...entry, id: makeId("header") }));
    body.value = item.body;
    bodyFields.value = item.bodyFields?.map((entry) => ({ ...entry, id: makeId("body") })) ?? [row()];
    bodyType.value = item.bodyType;
    timeoutMs.value = item.timeoutMs;
    response.value = null;
    error.value = "";
  }

  function saveHistory() {
    const item: HttpHistoryItem = {
      id: makeId("http"), createdAt: new Date().toLocaleString("zh-CN", { hour12: false }),
      method: method.value, url: url.value, query: query.value, headers: headers.value,
      body: body.value, bodyType: bodyType.value, timeoutMs: timeoutMs.value,
    };
    history.value = [item, ...history.value.filter((entry) => !(entry.method === item.method && entry.url === item.url))].slice(0, 30);
    selectedHistoryId.value = item.id;
  }

  async function send() {
    if (!url.value.trim()) { message.warning("请输入请求 URL"); return; }
    loading.value = true;
    response.value = null;
    error.value = "";
    try {
      response.value = await invoke<HttpResponse>("http_request", {
        request: {
          method: method.value,
          url: resolve(url.value.trim()),
          query: enabledQuery.value.map(({ key, value }) => ({ key: resolve(key), value: resolve(value) })),
          headers: requestHeaders.value.map(({ key, value }) => ({ key: resolve(key), value: resolve(value) })),
          body: bodyType.value === "x-www-form-urlencoded"
            ? new URLSearchParams(bodyFields.value.filter((item) => item.enabled && item.key.trim()).map((item) => [resolve(item.key), resolve(item.value)])).toString()
            : bodyType.value === "form-data"
              ? JSON.stringify(bodyFields.value.filter((item) => item.enabled && item.key.trim()).reduce<Record<string, string>>((result, item) => {
                result[resolve(item.key)] = resolve(item.value);
                return result;
              }, {}))
              : resolve(body.value),
          bodyType: bodyType.value,
          timeoutMs: timeoutMs.value,
        },
      });
      captureSessionToken(response.value.body);
      saveHistory();
      message.success(`${response.value.status} ${response.value.statusText}`);
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : String(cause);
      message.error(`请求失败：${error.value}`);
    } finally { loading.value = false; }
  }

  function clearResponse() { response.value = null; error.value = ""; }

  function exportCurl() {
    curlText.value = buildCurl({ method: method.value, url: url.value, query: query.value, headers: headers.value, body: body.value, bodyType: bodyType.value, timeoutMs: timeoutMs.value });
    return curlText.value;
  }

  function importCurl(command: string) {
    const parsed = parseCurl(command);
    if (parsed.method) method.value = parsed.method;
    if (parsed.url) url.value = parsed.url;
    if (parsed.query) query.value = parsed.query;
    if (parsed.headers) headers.value = parsed.headers;
    if (parsed.body !== undefined) body.value = parsed.body;
    if (parsed.bodyType) bodyType.value = parsed.bodyType;
    response.value = null;
    error.value = "";
  }

  return {
    method, url, query, headers, body, bodyFields, bodyType, timeoutMs, loading, response, responseBody,
    responseHeaders, error, history, selectedHistoryId, sessionAuth,
    historyOptions: computed(() => history.value.map((item) => ({ label: `${item.method} ${item.url}`, value: item.id }))),
    curlText, templates, selectedTemplateId, templateName, environment, addQuery, addHeader, addBodyField, addEnvironment, removeRow, applyHistory, applyTemplate, saveTemplate, send, clearResponse, exportCurl, importCurl,
  };
}
