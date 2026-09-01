import { computed, ref, watch } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { useMessage } from "naive-ui";
import { makeId, loadJson, saveJson } from "@/utils/storage";
import type { HttpHistoryItem, HttpKeyValue, HttpMethod, HttpRequestConfig, HttpResponse, HttpTemplate } from "./types";
import { buildCurl, parseCurl } from "./curlService";

const HISTORY_KEY = "NovaTool-http-history";
const TEMPLATES_KEY = "NovaTool-http-templates";
const ENVIRONMENT_KEY = "NovaTool-http-environment";
const DEFAULT_HEADERS: HttpKeyValue[] = [{ id: makeId("header"), key: "Accept", value: "application/json", enabled: true }];

function row(key = "", value = ""): HttpKeyValue {
  return { id: makeId("param"), key, value, enabled: true };
}

export function useHttpClient() {
  const message = useMessage();
  const method = ref<HttpMethod>("GET");
  const url = ref("https://httpbin.org/get");
  const query = ref<HttpKeyValue[]>([row()]);
  const headers = ref<HttpKeyValue[]>(DEFAULT_HEADERS);
  const body = ref("");
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

  const enabledHeaders = computed(() => headers.value.filter((item) => item.enabled && item.key.trim()));
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
  watch(environment, (value) => saveJson(ENVIRONMENT_KEY, value), { deep: true });

  function addQuery() { query.value.push(row()); }
  function addHeader() { headers.value.push(row()); }
  function removeRow(list: HttpKeyValue[], id: string) {
    const next = list.filter((item) => item.id !== id);
    if (list === query.value) query.value = next.length ? next : [row()];
    else if (list === headers.value) headers.value = next.length ? next : [row()];
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

  function applyHistory(id: string | null) {
    const item = history.value.find((entry) => entry.id === id);
    if (!item) return;
    selectedHistoryId.value = item.id;
    method.value = item.method;
    url.value = item.url;
    query.value = item.query.map((entry) => ({ ...entry, id: makeId("param") }));
    headers.value = item.headers.map((entry) => ({ ...entry, id: makeId("header") }));
    body.value = item.body;
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
        method: method.value,
        url: resolve(url.value.trim()),
        query: enabledQuery.value.map(({ key, value }) => ({ key: resolve(key), value: resolve(value) })),
        headers: enabledHeaders.value.map(({ key, value }) => ({ key: resolve(key), value: resolve(value) })),
        body: resolve(body.value),
        bodyType: bodyType.value,
        timeoutMs: timeoutMs.value,
      });
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
    method, url, query, headers, body, bodyType, timeoutMs, loading, response, responseBody,
    responseHeaders, error, history, selectedHistoryId,
    historyOptions: computed(() => history.value.map((item) => ({ label: `${item.method} ${item.url}`, value: item.id }))),
    curlText, templates, selectedTemplateId, templateName, environment, addQuery, addHeader, addEnvironment, removeRow, applyHistory, applyTemplate, saveTemplate, send, clearResponse, exportCurl, importCurl,
  };
}
