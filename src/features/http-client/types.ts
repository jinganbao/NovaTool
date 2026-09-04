export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "HEAD" | "OPTIONS";

export interface HttpKeyValue {
  id: string;
  key: string;
  value: string;
  enabled: boolean;
  type?: "string" | "number" | "boolean" | "object" | "file";
  description?: string;
  fileData?: string;
  fileName?: string;
}

export interface HttpRequestConfig {
  method: HttpMethod;
  url: string;
  query: HttpKeyValue[];
  headers: HttpKeyValue[];
  cookies?: HttpKeyValue[];
  body: string;
  bodyType: "none" | "form-data" | "x-www-form-urlencoded" | "json" | "xml" | "text" | "binary" | "graphql" | "msgpack";
  bodyFields?: HttpKeyValue[];
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
  projectId?: string;
}

export interface HttpTemplate extends HttpHistoryItem {
  name: string;
}
