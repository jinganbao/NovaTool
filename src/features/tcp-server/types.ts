export interface ServerEvent {
  type: "info" | "connect" | "data" | "disconnect" | "error" | "server-send";
  clientId: string;
  addr: string;
  message: string;
  text?: string;
  hex?: string;
  bytes?: number;
}

export interface ClientEntry {
  id: string;
  addr: string;
}
