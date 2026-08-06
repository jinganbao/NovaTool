use std::collections::HashMap;
use std::io::{Read, Write};
use std::net::{Shutdown, TcpStream};
use std::time::Duration;

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

fn make_conn_id() -> String {
    use std::sync::atomic::{AtomicU64, Ordering as AtomicOrdering};
    static COUNTER: AtomicU64 = AtomicU64::new(0);
    let ts = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis();
    let seq = COUNTER.fetch_add(1, AtomicOrdering::SeqCst);
    format!("conn-{}-{}", ts, seq)
}

pub struct TcpPool {
    connections: std::sync::Mutex<HashMap<String, TcpStream>>,
}

impl Default for TcpPool {
    fn default() -> Self {
        Self {
            connections: std::sync::Mutex::new(HashMap::new()),
        }
    }
}

/// 单次接收上限（16MB），防止对端持续灌数据撑爆内存
const MAX_RECEIVE_BYTES: usize = 16 * 1024 * 1024;
/// 长连接池上限，防止无限创建连接/线程耗尽 fd
const MAX_POOL_CONNECTIONS: usize = 32;

/// 短连接请求-响应模式：发送后 shutdown write，等待响应或超时
#[tauri::command]
pub fn tcp_send(
    host: String,
    port: u16,
    payload: String,
    mode: String,
    timeout_ms: Option<u64>,
) -> Result<TcpSendResult, String> {
    let timeout = Duration::from_millis(timeout_ms.unwrap_or(3000).clamp(100, 60000));
    let address = format!("{}:{}", host.trim(), port);
    let mut stream = TcpStream::connect(&address)
        .map_err(|error| format!("连接 {} 失败: {}", address, error))?;
    stream
        .set_read_timeout(Some(timeout))
        .map_err(|error| format!("设置读取超时失败: {}", error))?;
    stream
        .set_write_timeout(Some(timeout))
        .map_err(|error| format!("设置写入超时失败: {}", error))?;

    let bytes = if mode == "hex" {
        decode_hex(&payload)?
    } else {
        payload.into_bytes()
    };
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
                received.extend_from_slice(&chunk[..size])
            }
            Err(error)
                if error.kind() == std::io::ErrorKind::WouldBlock
                    || error.kind() == std::io::ErrorKind::TimedOut =>
            {
                break
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

/// 建立长连接：存入连接池，并启动后台读取线程通过事件推送数据
#[tauri::command]
pub fn tcp_connect(
    app: AppHandle,
    state: tauri::State<'_, TcpPool>,
    host: String,
    port: u16,
    timeout_ms: Option<u64>,
) -> Result<String, String> {
    let timeout = Duration::from_millis(timeout_ms.unwrap_or(3000).clamp(100, 60000));
    let address = format!("{}:{}", host.trim(), port);
    let stream = TcpStream::connect(&address)
        .map_err(|error| format!("连接 {} 失败: {}", address, error))?;
    stream
        .set_read_timeout(Some(timeout))
        .map_err(|error| format!("设置读取超时失败: {}", error))?;
    stream
        .set_write_timeout(Some(timeout))
        .map_err(|error| format!("设置写入超时失败: {}", error))?;

    // 克隆一个用于后台读取
    let mut reader = stream
        .try_clone()
        .map_err(|e| format!("克隆连接失败: {}", e))?;

    let id = make_conn_id();
    {
        let mut pool = state.connections.lock().unwrap();
        if pool.len() >= MAX_POOL_CONNECTIONS {
            return Err(format!(
                "连接数已达上限（{}），请先断开部分连接",
                MAX_POOL_CONNECTIONS
            ));
        }
        pool.insert(id.clone(), stream);
    }

    // 启动后台读取线程，通过事件推送接收到的数据
    let conn_id = id.clone();
    let app_handle = app.clone();
    std::thread::spawn(move || {
        // 设置非阻塞模式，轮询读取
        let _ = reader.set_nonblocking(true);
        let mut buf = [0u8; 8192];
        loop {
            match reader.read(&mut buf) {
                Ok(0) => {
                    let _ = app_handle.emit(
                        "tcp-client-event",
                        serde_json::json!({
                            "type": "disconnect",
                            "connId": conn_id,
                            "message": "连接已断开"
                        }),
                    );
                    break;
                }
                Ok(n) => {
                    let chunk = &buf[..n];
                    let text = String::from_utf8_lossy(chunk).to_string();
                    let hex = chunk
                        .iter()
                        .map(|b| format!("{:02X}", b))
                        .collect::<Vec<_>>()
                        .join(" ");
                    let _ = app_handle.emit(
                        "tcp-client-event",
                        serde_json::json!({
                            "type": "data",
                            "connId": conn_id,
                            "text": text,
                            "hex": hex,
                            "bytes": n
                        }),
                    );
                }
                Err(ref e)
                    if e.kind() == std::io::ErrorKind::WouldBlock
                        || e.kind() == std::io::ErrorKind::TimedOut =>
                {
                    std::thread::sleep(Duration::from_millis(50));
                }
                Err(_) => {
                    let _ = app_handle.emit(
                        "tcp-client-event",
                        serde_json::json!({
                            "type": "disconnect",
                            "connId": conn_id,
                            "message": "连接异常断开"
                        }),
                    );
                    break;
                }
            }
        }
    });

    Ok(id)
}

/// 长连接发送：只发不读，不 shutdown，不发 FIN，不阻塞等回包
#[tauri::command]
pub fn tcp_conn_send(
    state: tauri::State<'_, TcpPool>,
    conn_id: String,
    payload: String,
    mode: String,
    timeout_ms: Option<u64>,
) -> Result<TcpSendResult, String> {
    let timeout = Duration::from_millis(timeout_ms.unwrap_or(3000).clamp(100, 60000));
    let mut pool = state.connections.lock().unwrap();
    let stream = pool
        .get_mut(&conn_id)
        .ok_or("连接不存在或已断开，请重新连接".to_string())?;

    stream
        .set_write_timeout(Some(timeout))
        .map_err(|e| format!("设置超时失败: {}", e))?;

    let bytes = if mode == "hex" {
        decode_hex(&payload)?
    } else {
        payload.into_bytes()
    };
    let bytes_sent = bytes.len();
    stream
        .write_all(&bytes)
        .map_err(|error| format!("发送失败: {}", error))?;

    // 异步回应由 tcp_connect 的后台 reader 通过事件推送
    Ok(TcpSendResult {
        received_text: String::new(),
        received_hex: String::new(),
        bytes_sent,
        bytes_received: 0,
        truncated: false,
    })
}

/// 断开长连接
#[tauri::command]
pub fn tcp_disconnect(state: tauri::State<'_, TcpPool>, conn_id: String) -> Result<(), String> {
    state
        .connections
        .lock()
        .unwrap()
        .remove(&conn_id)
        .map(|_| ())
        .ok_or("连接不存在".to_string())
}
