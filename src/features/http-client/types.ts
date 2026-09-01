export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "HEAD" | "OPTIONS";

export interface HttpKeyValue {
  id: string;
  key: string;
  value: string;
  enabled: boolean;
}

export interface HttpRequestConfig {
  method: HttpMethod;
  url: string;
  query: HttpKeyValue[];
  headers: HttpKeyValue[];
  body: string;
  bodyType: "none" | "json" | "text" | "form";
  timeoutMs: number;
}

export interface HttpResponse {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: string;
  size: number;
  durationMs: number;
  truncated: boolean;
}

export interface HttpHistoryItem extends HttpRequestConfig {
  id: string;
  createdAt: string;
}

export interface HttpTemplate extends HttpHistoryItem {
  name: string;
}
