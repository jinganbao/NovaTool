export interface UdpResponse {
  localAddr: string;
  peerAddr: string;
  receivedText: string;
  receivedHex: string;
  bytesSent: number;
  bytesReceived: number;
  durationMs: number;
}
