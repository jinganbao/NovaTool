import type { Component } from "vue";

export type ToolKey =
  | "data-query"
  | "http-client"
  | "udp-client"
  | "tcp-client"
  | "tcp-server"
  | "port-check"
  | "json-format"
  | "xml-format"
  | "text-diff"
  | "regex"
  | "url-codec"
  | "timestamp"
  | "base64"
  | "radix"
  | "cron"
  | "hash"
  | "password"
  | "qrcode"
  | "uuid";

export type ToolStatus = "ready" | "draft";

export type ToolItem = {
  key: ToolKey;
  title: string;
  desc: string;
  icon: Component;
  status: ToolStatus;
};

export type ToolGroup = {
  key: string;
  title: string;
  icon: Component;
  tools: ToolItem[];
};
