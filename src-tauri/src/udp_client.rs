use std::net::UdpSocket;
use std::time::Duration;

use serde::{Deserialize, Serialize};

const MAX_SEND_BYTES: usize = 1_000_000;
const MAX_RECEIVE_BYTES: usize = 16 * 1024 * 1024;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UdpRequest {
    pub host: String,
    pub port: u16,
    pub payload: String,
    pub mode: String,
    pub timeout_ms: Option<u64>,
    pub wait_response: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UdpResponse {
    pub local_addr: String,
    pub peer_addr: String,
    pub received_text: String,
    pub received_hex: String,
    pub bytes_sent: usize,
    pub bytes_received: usize,
    pub duration_ms: u128,
}

#[tauri::command]
pub fn udp_send(request: UdpRequest) -> Result<UdpResponse, String> {
    let payload = if request.mode == "hex" {
        crate::utils::decode_hex(&request.payload)?
    } else {
        request.payload.into_bytes()
    };
    if payload.len() > MAX_SEND_BYTES {
        return Err(format!("发送数据过大（上限 {} 字节）", MAX_SEND_BYTES));
    }
    let host = request.host.trim();
    if host.is_empty() {
        return Err("Host 不能为空".into());
    }
    let socket = UdpSocket::bind("0.0.0.0:0").map_err(|error| format!("创建 UDP Socket 失败: {}", error))?;
    let timeout = Duration::from_millis(request.timeout_ms.unwrap_or(3000).clamp(100, 60000));
    socket.set_read_timeout(Some(timeout)).map_err(|error| format!("设置超时失败: {}", error))?;
    let peer = format!("{}:{}", host, request.port);
    let started = std::time::Instant::now();
    let bytes_sent = socket.send_to(&payload, &peer).map_err(|error| format!("UDP 发送失败: {}", error))?;
    let mut buffer = vec![0_u8; MAX_RECEIVE_BYTES];
    let (bytes_received, peer_addr) = if request.wait_response {
        match socket.recv_from(&mut buffer) {
            Ok((size, addr)) => (size, addr.to_string()),
            Err(error) if error.kind() == std::io::ErrorKind::TimedOut => (0, peer.clone()),
            Err(error) => return Err(format!("UDP 接收失败: {}", error)),
        }
    } else {
        (0, peer.clone())
    };
    let received = &buffer[..bytes_received];
    Ok(UdpResponse {
        local_addr: socket.local_addr().map(|addr| addr.to_string()).unwrap_or_default(),
        peer_addr,
        received_text: String::from_utf8_lossy(received).to_string(),
        received_hex: crate::utils::encode_hex(received),
        bytes_sent,
        bytes_received,
        duration_ms: started.elapsed().as_millis(),
    })
}
