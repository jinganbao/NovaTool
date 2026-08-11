export type UrlCodecScope = "component" | "uri";

export interface UrlCodecOptions {
  scope: UrlCodecScope;
  spaceAsPlus: boolean;
}

export function encodeUrl(input: string, options: UrlCodecOptions): string {
  if (options.scope === "uri") return encodeURI(input);
  if (options.spaceAsPlus) {
    return new URLSearchParams([["value", input]]).toString().slice("value=".length);
  }
  return encodeURIComponent(input);
}

export function decodeUrl(input: string, options: UrlCodecOptions): string {
  if (options.scope === "uri") return decodeURI(input);
  const normalized = options.spaceAsPlus ? input.replace(/\+/g, " ") : input;
  return decodeURIComponent(normalized);
}

