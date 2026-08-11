import { Base64 } from "js-base64";

export interface Base64EncodeOptions {
  urlSafe: boolean;
  padding: boolean;
}

export function encodeBase64(input: string, options: Base64EncodeOptions): string {
  let result = options.urlSafe ? Base64.encodeURI(input) : Base64.encode(input);
  if (options.padding) result = result.padEnd(Math.ceil(result.length / 4) * 4, "=");
  else result = result.replace(/=+$/g, "");
  return result;
}

export function decodeBase64(input: string): string {
  const normalized = input.replace(/\s+/g, "");
  if (!normalized || !Base64.isValid(normalized)) throw new Error("请输入合法的 Base64 或 Base64URL 字符串");
  return Base64.decode(normalized);
}

