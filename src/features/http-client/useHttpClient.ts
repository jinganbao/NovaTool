import { computed, ref, watch, type Ref } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { useMessage } from "naive-ui";
import { makeId, loadJson, saveJson } from "@/utils/storage";
import { queryJson } from "@/features/query/queryService";
import type { HttpProject } from "./useHttpProjects";
import type { HttpHistoryItem, HttpKeyValue, HttpMethod, HttpRequestConfig, HttpResponse, HttpTemplate } from "./types";
import { buildCurl, parseCurl } from "./curlService";
import { enabledBodyFields, serializeUrlEncoded } from "./requestSerialization";

const HISTORY_KEY = "NovaTool-http-history";
const TEMPLATES_KEY = "NovaTool-http-templates";
const ENVIRONMENT_KEY = "NovaTool-http-environment";
const DEFAULT_HEADERS: HttpKeyValue[] = [{ id: makeId("header"), key: "Accept", value: "application/json", enabled: true }];

function row(key = "", value = ""): HttpKeyValue {
  return { id: makeId("param"), key, value, enabled: true };
}

function bodyRow(key = "", value = ""): HttpKeyValue {
  return { ...row(key, value), type: "string", description: "" };
}

function normalizeBodyFields(fields?: HttpKeyValue[]) {
  return fields?.map((item) => ({
    ...item,
    id: makeId("body"),
    type: item.type ?? "string",
    description: item.description ?? "",
  })) ?? [bodyRow()];
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
  const bodyFields = ref<HttpKeyValue[]>([bodyRow()]);
  const cookies = ref<HttpKeyValue[]>([row()]);
  const bodyType = ref<HttpRequestConfig["bodyType"]>("none");
  const timeoutMs = ref(15000);
  const loading = ref(false);
  let requestSequence = 0;
  const response = ref<HttpResponse | null>(null);
  const responseView = ref<"pretty" | "raw">("pretty");
  const responseSearch = ref("");
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
    mode: "bearer" as "none" | "bearer" | "api-key" | "basic",
    responsePath: "$.tokenValue",
    headerName: "Authorization",
    prefix: "",
    token: "",
    username: "",
    password: "",
    apiKeyName: "X-API-Key",
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
      cookies.value = [row()];
      body.value = "";
      bodyFields.value = [bodyRow()];
      bodyType.value = "none";
      timeoutMs.value = 15000;
      sessionAuth.value = { enabled: false, mode: "bearer", responsePath: "$.tokenValue", headerName: "Authorization", prefix: "Bearer ", token: projects?.value.find((item) => item.id === projectId?.value)?.sessionToken ?? "", username: "", password: "", apiKeyName: "X-API-Key" };
      return;
    }
    method.value = saved.method ?? "GET";
    url.value = saved.url ?? "";
    query.value = saved.query?.map((item) => ({ ...item, id: makeId("param") })) ?? [row()];
    headers.value = saved.headers?.map((item) => ({ ...item, id: makeId("header") })) ?? [row()];
    cookies.value = saved.cookies?.map((item) => ({ ...item, id: makeId("cookie") })) ?? [row()];
    body.value = saved.body ?? "";
    bodyFields.value = normalizeBodyFields(saved.bodyFields);
    bodyType.value = saved.bodyType ?? "none";
    timeoutMs.value = saved.timeoutMs ?? 15000;
    sessionAuth.value = {
      enabled: saved.auth?.enabled ?? false,
      mode: saved.auth?.mode ?? "bearer",
      responsePath: saved.auth?.responsePath ?? "$.tokenValue",
      headerName: saved.auth?.headerName ?? "Authorization",
      prefix: saved.auth?.prefix ?? "",
      token: projects?.value.find((item) => item.id === projectId?.value)?.sessionToken ?? "",
      username: saved.auth?.username ?? "", password: saved.auth?.password ?? "", apiKeyName: saved.auth?.apiKeyName ?? "X-API-Key",
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
      cookies: cookies.value,
      body: body.value,
      bodyFields: bodyFields.value,
      bodyType: bodyType.value,
      timeoutMs: timeoutMs.value,
      auth: {
        enabled: sessionAuth.value.enabled,
        responsePath: sessionAuth.value.responsePath,
        headerName: sessionAuth.value.headerName,
        prefix: sessionAuth.value.prefix,
        mode: sessionAuth.value.mode, username: sessionAuth.value.username, password: sessionAuth.value.password, apiKeyName: sessionAuth.value.apiKeyName,
      },
    };
  }

  const enabledHeaders = computed(() => headers.value.filter((item) => item.enabled && item.key.trim()));
  const requestHeaders = computed(() => {
    const sessionHeader = sessionAuth.value.enabled && sessionAuth.value.mode !== "none" && (sessionAuth.value.mode === "basic" || sessionAuth.value.token)
      ? sessionAuth.value.mode === "basic"
        ? { key: "Authorization", value: `Basic ${btoa(`${sessionAuth.value.username}:${sessionAuth.value.password}`)}` }
        : { key: sessionAuth.value.mode === "api-key" ? (sessionAuth.value.apiKeyName.trim() || "X-API-Key") : (sessionAuth.value.headerName.trim() || "Authorization"), value: sessionAuth.value.mode === "api-key" ? sessionAuth.value.token : sessionAuth.value.prefix + sessionAuth.value.token }
      : null;
    const cookieHeader = cookies.value.filter((item) => item.enabled && item.key.trim()).map((item) => `${resolve(item.key)}=${resolve(item.value)}`).join("; ");
    const normalHeaders = enabledHeaders.value.filter((item) => !sessionHeader || item.key.toLowerCase() !== sessionHeader.key.toLowerCase());
    const withoutCookie = normalHeaders.filter((item) => item.key.toLowerCase() !== "cookie");
    const withSession = sessionHeader ? [...withoutCookie, sessionHeader] : withoutCookie;
    return cookieHeader ? [...withSession, { key: "Cookie", value: cookieHeader }] : withSession;
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
  const responseRawBody = computed(() => response.value?.body ?? "");
  const responseMatchCount = computed(() => {
    const needle = responseSearch.value.trim().toLowerCase();
    if (!needle) return 0;
    return responseRawBody.value.toLowerCase().split(needle).length - 1;
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
    sessionAuth.value.token = project?.sessionToken ?? "";
  }, { immediate: true });
  watch(interfaceId ?? ref(null), restoreInterfaceRequest, { immediate: true });
  watch(
    [method, url, query, headers, cookies, body, bodyFields, bodyType, timeoutMs, sessionAuth],
    persistInterfaceRequest,
    { deep: true },
  );

  function addQuery() { query.value.push(row()); }
  function addHeader() { headers.value.push(row()); }
  function addCookie() { cookies.value.push(row()); }
  function addBodyField() { bodyFields.value.push(bodyRow()); }
  function removeRow(list: HttpKeyValue[], id: string) {
    const next = list.filter((item) => item.id !== id);
    if (list === query.value) query.value = next.length ? next : [row()];
    else if (list === headers.value) headers.value = next.length ? next : [row()];
    else if (list === cookies.value) cookies.value = next.length ? next : [row()];
    else if (list === bodyFields.value) bodyFields.value = next.length ? next : [bodyRow()];
    else environment.value = next;
  }

  watch(() => sessionAuth.value.token, (token) => {
    const project = projects?.value.find((item) => item.id === projectId?.value);
    if (project) project.sessionToken = token;
  });

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
    cookies.value = item.cookies?.map((entry) => ({ ...entry, id: makeId("cookie") })) ?? [row()];
    body.value = item.body;
    bodyFields.value = normalizeBodyFields(item.bodyFields);
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
      cookies: cookies.value,
      body: body.value, bodyFields: bodyFields.value, bodyType: bodyType.value, timeoutMs: timeoutMs.value,
      projectId: projectId?.value ?? undefined,
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
    cookies.value = item.cookies?.map((entry) => ({ ...entry, id: makeId("cookie") })) ?? [row()];
    body.value = item.body;
    bodyFields.value = normalizeBodyFields(item.bodyFields);
    bodyType.value = item.bodyType;
    timeoutMs.value = item.timeoutMs;
    response.value = null;
    error.value = "";
  }

  function saveHistory() {
    const item: HttpHistoryItem = {
      id: makeId("http"), createdAt: new Date().toLocaleString("zh-CN", { hour12: false }),
      method: method.value, url: url.value, query: query.value, headers: headers.value,
      cookies: cookies.value,
      body: body.value, bodyFields: bodyFields.value, bodyType: bodyType.value, timeoutMs: timeoutMs.value,
    };
    history.value = [item, ...history.value.filter((entry) => !(entry.method === item.method && entry.url === item.url))].slice(0, 30);
    selectedHistoryId.value = item.id;
  }

  async function send() {
    if (loading.value) { message.info("请求正在执行中"); return; }
    const resolvedUrl = resolve(url.value.trim());
    if (!resolvedUrl) { message.warning("请输入请求 URL"); return; }
    if (!/^https?:\/\/\S+/i.test(resolvedUrl)) { message.warning("请求地址必须以 http:// 或 https:// 开头"); return; }
    const rowGroups: Array<[string, HttpKeyValue[]]> = [
      ["Query 参数", query.value], ["Headers", headers.value], ["Cookies", cookies.value],
      ["Body 参数", bodyFields.value],
    ];
    const invalidRows = rowGroups.find(([, rows]) => rows.some((item) => item.enabled && !item.key.trim() && item.value.trim()));
    if (invalidRows) { message.warning(`${invalidRows[0]}存在未填写名称的值，请补全或删除该行`); return; }
    if (bodyType.value === "json" && body.value.trim()) {
      try { JSON.parse(body.value); } catch { message.warning("JSON Body 格式无效，请修正后再发送"); return; }
    }
    const sequence = ++requestSequence;
    loading.value = true;
    response.value = null;
    error.value = "";
    try {
      const nextResponse = await invoke<HttpResponse>("http_request", {
        request: {
          method: method.value,
          url: resolvedUrl,
          query: enabledQuery.value.map(({ key, value }) => ({ key: resolve(key), value: resolve(value) })),
          headers: requestHeaders.value.map(({ key, value }) => ({ key: resolve(key), value: resolve(value) })),
          body: bodyType.value === "x-www-form-urlencoded"
            ? serializeUrlEncoded(bodyFields.value, resolve)
            : bodyType.value === "form-data" ? "" : resolve(body.value),
          bodyFields: bodyType.value === "form-data"
            ? enabledBodyFields(bodyFields.value, resolve)
            : [],
          bodyType: bodyType.value,
          timeoutMs: timeoutMs.value,
          requestId: `http-request-${sequence}`,
        },
      });
      if (sequence !== requestSequence) return;
      response.value = nextResponse;
      captureSessionToken(response.value.body);
      saveHistory();
      message.success(`${response.value.status} ${response.value.statusText}`);
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : String(cause);
      message.error(`请求失败：${error.value}`);
    } finally { loading.value = false; }
  }

  function cancel() {
    if (!loading.value) return;
    const requestId = `http-request-${requestSequence}`;
    requestSequence += 1;
    void invoke("cancel_http_request", { requestId });
    loading.value = false;
    error.value = "请求已取消";
    message.info("请求已取消");
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
    method, url, query, headers, cookies, body, bodyFields, bodyType, timeoutMs, loading, response, responseBody,
    responseHeaders, responseRawBody, responseView, responseSearch, responseMatchCount, error, history, selectedHistoryId, sessionAuth,
    historyOptions: computed(() => history.value.filter((item) => !projectId?.value || !item.projectId || item.projectId === projectId.value).map((item) => ({ label: `${item.method} ${item.url}`, value: item.id }))),
    curlText, templates, selectedTemplateId, templateName, environment, addQuery, addHeader, addCookie, addBodyField, addEnvironment, removeRow, applyHistory, applyTemplate, saveTemplate, send, cancel, clearResponse, exportCurl, importCurl,
  };
}
