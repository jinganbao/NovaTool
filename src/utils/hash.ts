/**
 * 哈希工具 - 基于 hash-wasm (WebAssembly)，支持 MD5 / SHA-1 / SHA-256 / SHA-512 / SM3
 */

import { md5 as hwMd5, sha1 as hwSha1, sha256 as hwSha256, sha512 as hwSha512, sm3 as hwSm3 } from "hash-wasm";

export function md5(input: string): Promise<string> {
  return hwMd5(input);
}
export function sha1(input: string): Promise<string> {
  return hwSha1(input);
}
export function sha256(input: string): Promise<string> {
  return hwSha256(input);
}
export function sha512(input: string): Promise<string> {
  return hwSha512(input);
}
export function sm3(input: string): Promise<string> {
  return hwSm3(input);
}
