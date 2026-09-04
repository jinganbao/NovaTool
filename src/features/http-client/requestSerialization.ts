import type { HttpKeyValue } from "./types";

export function serializeUrlEncoded(fields: HttpKeyValue[], resolve: (value: string) => string) {
  return new URLSearchParams(fields.filter((item) => item.enabled && item.key.trim()).map((item) => [resolve(item.key), resolve(item.value)])).toString();
}

export function enabledBodyFields(fields: HttpKeyValue[], resolve: (value: string) => string) {
  return fields.filter((item) => item.enabled && item.key.trim()).map((item) => ({ key: resolve(item.key), value: resolve(item.value), fieldType: item.type ?? "string", fileData: item.fileData, fileName: item.fileName }));
}
