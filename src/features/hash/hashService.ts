import { md5, sha1, sha256, sha512, sm3 } from "hash-wasm";

export type HashAlgorithm = "md5" | "sha1" | "sha256" | "sha512" | "sm3";

export const HASH_ALGORITHMS: Array<{ key: HashAlgorithm; label: string; bits: number }> = [
  { key: "md5", label: "MD5", bits: 128 },
  { key: "sha1", label: "SHA-1", bits: 160 },
  { key: "sha256", label: "SHA-256", bits: 256 },
  { key: "sha512", label: "SHA-512", bits: 512 },
  { key: "sm3", label: "SM3", bits: 256 },
];

const HASHERS: Record<HashAlgorithm, (input: string) => Promise<string>> = {
  md5,
  sha1,
  sha256,
  sha512,
  sm3,
};

export async function computeTextHashes(input: string, algorithms: HashAlgorithm[]): Promise<Map<HashAlgorithm, string>> {
  const entries = await Promise.all(algorithms.map(async (algorithm) => [algorithm, await HASHERS[algorithm](input)] as const));
  return new Map(entries);
}

export function utf8ByteLength(input: string): number {
  return new TextEncoder().encode(input).byteLength;
}

