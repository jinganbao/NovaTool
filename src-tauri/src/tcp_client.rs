use std::collections::HashMap;
use std::io::{Read, Write};
use std::net::{Shutdown, TcpStream, ToSocketAddrs};
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use serde::Serialize;
use tauri::{AppHandle, Emitter};

use crate::utils::{decode_hex, encode_hex};

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TcpSendResult {
    received_text: String,
    received_hex: String,
    bytes_sent: usize,
    bytes_received: usize,
    truncated: bool,
}

struct TcpConnection {
    writer: TcpStream,
    cancelled: Arc<AtomicBool>,
}

#[derive(Default)]
pub struct TcpPool {
    connections: Arc<Mutex<HashMap<String, TcpConnection>>>,
}

const MAX_RECEIVE_BYTES: usize = 16 * 1024 * 1024;
const MAX_SEND_BYTES: usize = 1024 * 1024;
const MAX_POOL_CONNECTIONS: usize = 32;

fn make_conn_id() -> String {
    static COUNTER: AtomicU64 = AtomicU64::new(0);
    let ts = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis();
    let seq = COUNTER.fetch_add(1, Ordering::Relaxed);
    format!("conn-{}-{}", ts, seq)
}

fn timeout_duration(timeout_ms: Option<u64>) -> Duration {
    Duration::from_millis(timeout_ms.unwrap_or(3000).clamp(100, 60000))
}

fn connect_with_timeout(host: &str, port: u16, timeout: Duration) -> Result<TcpStream, String> {
    let clean_host = host.trim();
    if clean_host.is_empty() {
        return Err("Host 不能为空".into());
    }

    let addresses = (clean_host, port)
        .to_socket_addrs()
        .map_err(|error| format!("解析地址 {}:{} 失败: {}", clean_host, port, error))?
        .collect::<Vec<_>>();
    if addresses.is_empty() {
        return Err(format!("未找到 {}:{} 对应的网络地址", clean_host, port));
    }

    let started = Instant::now();
    let mut last_error = None;
    for address in addresses {
        let remaining = timeout.saturating_sub(started.elapsed());
        if remaining.is_zero() {
            break;
        }
        match TcpStream::connect_timeout(&address, remaining) {
            Ok(stream) => return Ok(stream),
            Err(error) => last_error = Some(error),
        }
    }

    Err(format!(
        "连接 {}:{} 失败: {}",
        clean_host,
        port,
        last_error
            .map(|error| error.to_string())
            .unwrap_or_else(|| "连接超时".into())
    ))
}

fn encode_payload(payload: String, mode: &str) -> Result<Vec<u8>, String> {
    if payload.len() > MAX_SEND_BYTES * 3 {
        return Err(format!("发送数据过大（上限 {} 字节）", MAX_SEND_BYTES));
    }
    let bytes = if mode == "hex" {
        decode_hex(&payload)?
    } else {
        payload.into_bytes()
    };
    if bytes.len() > MAX_SEND_BYTES {
        return Err(format!("发送数据过大（上限 {} 字节）", MAX_SEND_BYTES));
    }
    Ok(bytes)
}

fn configure_stream(stream: &TcpStream, timeout: Duration) -> Result<(), String> {
    stream
        .set_read_timeout(Some(timeout))
        .map_err(|error| format!("设置读取超时失败: {}", error))?;
    stream
        .set_write_timeout(Some(timeout))
        .map_err(|error| format!("设置写入超时失败: {}", error))
}

/// 短连接请求-响应模式：发送后 shutdown write，等待响应或超时。
#[tauri::command]
pub fn tcp_send(
    host: String,
    port: u16,
    payload: String,
    mode: String,
    timeout_ms: Option<u64>,
) -> Result<TcpSendResult, String> {
    let timeout = timeout_duration(timeout_ms);
    let mut stream = connect_with_timeout(&host, port, timeout)?;
    configure_stream(&stream, timeout)?;

    let bytes = encode_payload(payload, &mode)?;
    stream
        .write_all(&bytes)
        .map_err(|error| format!("发送失败: {}", error))?;
    let _ = stream.shutdown(Shutdown::Write);

    let mut received = Vec::new();
    let mut chunk = [0_u8; 4096];
    let mut truncated = false;
    loop {
        match stream.read(&mut chunk) {
            Ok(0) => break,
            Ok(size) => {
                if received.len() + size > MAX_RECEIVE_BYTES {
                    let remaining = MAX_RECEIVE_BYTES - received.len();
                    received.extend_from_slice(&chunk[..remaining]);
                    truncated = true;
                    break;
                }
                received.extend_from_slice(&chunk[..size]);
            }
            Err(error)
                if error.kind() == std::io::ErrorKind::WouldBlock
                    || error.kind() == std::io::ErrorKind::TimedOut =>
            {
                break;
            }
            Err(error) => return Err(format!("接收失败: {}", error)),
        }
    }

    Ok(TcpSendResult {
        received_text: String::from_utf8_lossy(&received).to_string(),
        received_hex: encode_hex(&received),
        bytes_sent: bytes.len(),
        bytes_received: received.len(),
        truncated,
    })
}

/// 建立长连接并启动可取消的后台读取线程。
#[tauri::command]
pub fn tcp_connect(
    app: AppHandle,
    state: tauri::State<'_, TcpPool>,
    host: String,
    port: u16,
    timeout_ms: Option<u64>,
) -> Result<String, String> {
    let timeout = timeout_duration(timeout_ms);
    let stream = connect_with_timeout(&host, port, timeout)?;
    configure_stream(&stream, timeout)?;

    let mut reader = stream
        .try_clone()
        .map_err(|error| format!("克隆连接失败: {}", error))?;
    reader
        .set_nonblocking(true)
        .map_err(|error| format!("设置连接模式失败: {}", error))?;

    let id = make_conn_id();
    let cancelled = Arc::new(AtomicBool::new(false));
    {
        let mut pool = state
            .connections
            .lock()
            .map_err(|_| "连接池状态异常".to_string())?;
        if pool.len() >= MAX_POOL_CONNECTIONS {
            return Err(format!(
                "连接数已达上限（{}），请先断开部分连接",
                MAX_POOL_CONNECTIONS
            ));
        }
        pool.insert(
            id.clone(),
            TcpConnection {
                writer: stream,
                cancelled: cancelled.clone(),
            },
        );
    }

    let conn_id = id.clone();
    let connections = state.connections.clone();
    std::thread::spawn(move || {
        let mut buf = [0_u8; 8192];
        let mut disconnect_message = None;

        while !cancelled.load(Ordering::Acquire) {
            match reader.read(&mut buf) {
                Ok(0) => {
                    if !cancelled.load(Ordering::Acquire) {
                        disconnect_message = Some("连接已断开");
                    }
                    break;
                }
                Ok(size) => {
                    let chunk = &buf[..size];
                    let _ = app.emit(
                        "tcp-client-event",
                        serde_json::json!({
                            "type": "data",
                            "connId": conn_id,
                            "text": String::from_utf8_lossy(chunk),
                            "hex": encode_hex(chunk),
                            "bytes": size
                        }),
                    );
                }
                Err(error) if error.kind() == std::io::ErrorKind::WouldBlock => {
                    std::thread::sleep(Duration::from_millis(50));
                }
                Err(error) if error.kind() == std::io::ErrorKind::Interrupted => {}
                Err(_) => {
                    if !cancelled.load(Ordering::Acquire) {
                        disconnect_message = Some("连接异常断开");
                    }
                    break;
                }
            }
        }

        let _ = reader.shutdown(Shutdown::Both);
        if let Ok(mut pool) = connections.lock() {
            pool.remove(&conn_id);
        }
        if let Some(message) = disconnect_message {
            let _ = app.emit(
                "tcp-client-event",
                serde_json::json!({
                    "type": "disconnect",
                    "connId": conn_id,
                    "message": message
                }),
            );
        }
    });

    Ok(id)
}

/// 长连接发送：回应由后台 reader 通过事件推送。
#[tauri::command]
pub fn tcp_conn_send(
    state: tauri::State<'_, TcpPool>,
    conn_id: String,
    payload: String,
    mode: String,
    timeout_ms: Option<u64>,
) -> Result<TcpSendResult, String> {
    let bytes = encode_payload(payload, &mode)?;
    let timeout = timeout_duration(timeout_ms);
    let bytes_sent = bytes.len();

    let mut pool = state
        .connections
        .lock()
        .map_err(|_| "连接池状态异常".to_string())?;
    let send_result = {
        let connection = pool
            .get_mut(&conn_id)
            .ok_or_else(|| "连接不存在或已断开，请重新连接".to_string())?;
        connection
            .writer
            .set_write_timeout(Some(timeout))
            .map_err(|error| format!("设置超时失败: {}", error))?;
        connection.writer.write_all(&bytes)
    };

    if let Err(error) = send_result {
        if let Some(connection) = pool.remove(&conn_id) {
            connection.cancelled.store(true, Ordering::Release);
            let _ = connection.writer.shutdown(Shutdown::Both);
        }
        return Err(format!("发送失败: {}", error));
    }

    Ok(TcpSendResult {
        received_text: String::new(),
        received_hex: String::new(),
        bytes_sent,
        bytes_received: 0,
        truncated: false,
    })
}

/// 断开长连接，同时取消后台读取线程并关闭 socket。
#[tauri::command]
pub fn tcp_disconnect(state: tauri::State<'_, TcpPool>, conn_id: String) -> Result<(), String> {
    let connection = state
        .connections
        .lock()
        .map_err(|_| "连接池状态异常".to_string())?
        .remove(&conn_id)
        .ok_or_else(|| "连接不存在".to_string())?;
    connection.cancelled.store(true, Ordering::Release);
    connection
        .writer
        .shutdown(Shutdown::Both)
        .map_err(|error| format!("断开连接失败: {}", error))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn encode_payload_preserves_utf8_and_limits_size() {
        assert_eq!(
            encode_payload("中文".into(), "utf8").unwrap(),
            "中文".as_bytes()
        );
        let oversized = "a".repeat(MAX_SEND_BYTES + 1);
        assert!(encode_payload(oversized, "utf8").is_err());
    }

    #[test]
    fn connect_with_timeout_supports_hostnames() {
        let listener = std::net::TcpListener::bind(("127.0.0.1", 0)).unwrap();
        let port = listener.local_addr().unwrap().port();
        let accept = std::thread::spawn(move || listener.accept().unwrap());
        let stream = connect_with_timeout("localhost", port, Duration::from_secs(1)).unwrap();
        drop(stream);
        let _ = accept.join().unwrap();
    }
}
