import type { HttpRequestConfig, HttpMethod } from "./types";

function tokenize(command: string): string[] {
  const tokens: string[] = [];
  const pattern = /(?:[^\s"']+|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')+/g;
  for (const match of command.match(pattern) ?? []) {
    tokens.push(match.replace(/^(['"])(.*)\1$/, "$2").replace(/\\(["'\\])/g, "$1"));
  }
  return tokens;
}

export function parseCurl(command: string): Partial<HttpRequestConfig> {
  const tokens = tokenize(command.trim());
  if (tokens[0]?.toLowerCase() !== "curl") throw new Error("请输入以 curl 开头的命令");
  let method: HttpMethod | undefined;
  let body = "";
  const headers: Array<{ key: string; value: string; enabled: boolean; id: string }> = [];
  let url = "";
  for (let index = 1; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token === "-X" || token === "--request") method = tokens[++index]?.toUpperCase() as HttpMethod;
    else if (token === "-H" || token === "--header") {
      const value = tokens[++index] ?? "";
      const separator = value.indexOf(":");
      if (separator > 0) headers.push({ id: `curl-header-${headers.length}`, key: value.slice(0, separator).trim(), value: value.slice(separator + 1).trim(), enabled: true });
    } else if (["-d", "--data", "--data-raw", "--data-binary"].includes(token)) {
      body = tokens[++index] ?? "";
      method ??= "POST";
    } else if (token === "-G" || token === "--get") method = "GET";
    else if (!token.startsWith("-")) url ||= token;
  }
  if (!url) throw new Error("cURL 命令中没有找到 URL");
  let query: HttpRequestConfig["query"] = [];
  try {
    const parsed = new URL(url);
    query = [...parsed.searchParams].map(([key, value], index) => ({ id: `curl-query-${index}`, key, value, enabled: true }));
    parsed.search = "";
    url = parsed.toString();
  } catch { /* 让后端返回更具体的 URL 错误 */ }
  const contentType = headers.find((item) => item.key.toLowerCase() === "content-type")?.value ?? "";
  return { method: method ?? (body ? "POST" : "GET"), url, query, headers, body, bodyType: contentType.includes("json") ? "json" : body ? "text" : "none" };
}

function shell(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

export function buildCurl(config: HttpRequestConfig): string {
  const query = config.query.filter((item) => item.enabled && item.key.trim());
  const url = new URL(config.url);
  for (const item of query) url.searchParams.set(item.key, item.value);
  const parts = [`curl --request ${config.method} ${shell(url.toString())}`];
  for (const item of config.headers.filter((header) => header.enabled && header.key.trim())) parts.push(`--header ${shell(`${item.key}: ${item.value}`)}`);
  if (config.bodyType !== "none" && config.body) parts.push(`--data-raw ${shell(config.body)}`);
  return parts.join(" \\\n  ");
}
