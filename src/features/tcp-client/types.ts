export interface TcpConnection {
  id: string;
  name: string;
  host: string;
  port: string;
  mode: "utf8" | "hex";
}

export interface SavedPayload {
  id: string;
  name: string;
  content: string;
}

export interface TemplateField {
  id: string;
  key: string;
  value: string;
}

export interface TcpSendResult {
  receivedText: string;
  receivedHex: string;
  bytesSent: number;
  bytesReceived: number;
  truncated: boolean;
}

export interface TcpClientEvent {
  type: "data" | "disconnect";
  connId: string;
  text?: string;
  hex?: string;
  bytes?: number;
  message?: string;
}
