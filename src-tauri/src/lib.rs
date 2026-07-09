use std::collections::HashMap;
use std::io::{Read, Write};
use std::net::{Shutdown, TcpStream};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Duration;

use serde::Serialize;
use similar::{ChangeTag, TextDiff};
use tokio::io::AsyncReadExt;
use tokio::net::TcpListener;
use tokio::sync::{broadcast, Mutex};
use tauri::{AppHandle, Emitter};

/* ---------- TCP 客户端 ---------- */

#[tauri::command]
fn app_ready() -> &'static str {
    "NovaTool ready"
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct TcpSendResult {
    received_text: String,
    received_hex: String,
    bytes_sent: usize,
    bytes_received: usize,
}

fn decode_hex(input: &str) -> Result<Vec<u8>, String> {
    let clean: String = input.chars().filter(|c| !c.is_whitespace()).collect();
    if clean.len() % 2 != 0 {
        return Err("HEX 内容长度必须是偶数".to_string());
    }
    let mut bytes = Vec::with_capacity(clean.len() / 2);
    for i in (0..clean.len()).step_by(2) {
        let part = &clean[i..i + 2];
        let byte = u8::from_str_radix(part, 16)
            .map_err(|_| format!("非法 HEX 字节: {}", part))?;
        bytes.push(byte);
    }
    Ok(bytes)
}

fn encode_hex(bytes: &[u8]) -> String {
    bytes
        .iter()
        .map(|byte| format!("{:02X}", byte))
        .collect::<Vec<_>>()
        .join(" ")
}

#[tauri::command]
fn tcp_send(
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
    loop {
        match stream.read(&mut chunk) {
            Ok(0) => break,
            Ok(size) => received.extend_from_slice(&chunk[..size]),
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
    })
}

/* ---------- TCP 长连接池 ---------- */

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

struct TcpPool {
    connections: std::sync::Mutex<HashMap<String, TcpStream>>,
}

impl Default for TcpPool {
    fn default() -> Self {
        Self {
            connections: std::sync::Mutex::new(HashMap::new()),
        }
    }
}

#[tauri::command]
fn tcp_connect(
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
    state.connections.lock().unwrap().insert(id.clone(), stream);

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

#[tauri::command]
fn tcp_conn_send(
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

    // 长连接模式：只发不读，不 shutdown，不发 FIN，不阻塞等回包
    // 异步回应以后用后台 reader + 事件推送实现
    Ok(TcpSendResult {
        received_text: String::new(),
        received_hex: String::new(),
        bytes_sent,
        bytes_received: 0,
    })
}

#[tauri::command]
fn tcp_disconnect(
    state: tauri::State<'_, TcpPool>,
    conn_id: String,
) -> Result<(), String> {
    state
        .connections
        .lock()
        .unwrap()
        .remove(&conn_id)
        .map(|_| ())
        .ok_or("连接不存在".to_string())
}

/* ---------- TCP 服务器 ---------- */

/// 推送到前端的日志事件
#[derive(Clone, Serialize)]
struct ServerEvent {
    #[serde(rename = "type")]
    event_type: String,
    client_id: String,
    addr: String,
    message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    text: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    hex: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    bytes: Option<usize>,
}

/// 服务器运行状态（Arc 包装，可安全移入 tokio::spawn）
struct ServerState {
    running: Arc<AtomicBool>,
    shutdown_tx: Arc<Mutex<Option<broadcast::Sender<()>>>>,
    client_senders: Arc<Mutex<HashMap<String, tokio::sync::mpsc::UnboundedSender<String>>>>,
}

impl Default for ServerState {
    fn default() -> Self {
        Self {
            running: Arc::new(AtomicBool::new(false)),
            shutdown_tx: Arc::new(Mutex::new(None)),
            client_senders: Arc::new(Mutex::new(HashMap::new())),
        }
    }
}

#[tauri::command]
async fn tcp_server_start(
    app: AppHandle,
    state: tauri::State<'_, ServerState>,
    port: u16,
) -> Result<(), String> {
    if state.running.load(Ordering::SeqCst) {
        return Err("服务器已在运行中".into());
    }

    let listener = TcpListener::bind(format!("0.0.0.0:{}", port))
        .await
        .map_err(|e| format!("绑定端口失败: {}", e))?;

    let (shutdown_tx, mut shutdown_rx) = broadcast::channel::<()>(1);
    *state.shutdown_tx.lock().await = Some(shutdown_tx);
    state.running.store(true, Ordering::SeqCst);

    let running = state.running.clone();
    let shutdown_guard = state.shutdown_tx.clone();

    let _ = app.emit(
        "tcp-server-event",
        ServerEvent {
            event_type: "info".into(),
            client_id: "-".into(),
            addr: "-".into(),
            message: format!("服务器已启动，监听 0.0.0.0:{}", port),
            text: None,
            hex: None,
            bytes: None,
        },
    );

    let app_handle = app.clone();

    // 最大并发连接数限制
    const MAX_CONNECTIONS: u32 = 128;
    let active_connections = Arc::new(std::sync::atomic::AtomicU32::new(0));
    let server_senders = state.client_senders.clone();

    tokio::spawn(async move {
        let mut client_counter: u32 = 0;

        loop {
            tokio::select! {
                result = listener.accept() => {
                    match result {
                        Ok((mut stream, addr)) => {
                            // 检查连接数限制
                            let current = active_connections.load(Ordering::SeqCst);
                            if current >= MAX_CONNECTIONS {
                                let _ = app_handle.emit("tcp-server-event", ServerEvent {
                                    event_type: "error".into(),
                                    client_id: "-".into(),
                                    addr: addr.to_string(),
                                    message: format!("连接数已达上限({})，拒绝新连接: {}", MAX_CONNECTIONS, addr),
                                    text: None,
                                    hex: None,
                                    bytes: None,
                                });
                                continue;
                            }

                            client_counter += 1;
                            let client_id = format!("Client-{}", client_counter);
                            let addr_str = addr.to_string();
                            let app = app_handle.clone();
                            let conn_counter = active_connections.clone();
                            conn_counter.fetch_add(1, Ordering::SeqCst);

                            let _ = app.emit("tcp-server-event", ServerEvent {
                                event_type: "connect".into(),
                                client_id: client_id.clone(),
                                addr: addr_str.clone(),
                                message: format!("客户端已连接: {}", addr_str),
                                text: None,
                                hex: None,
                                bytes: None,
                            });

                            // 注册客户端发送通道
                            let (tx, mut rx) = tokio::sync::mpsc::unbounded_channel::<String>();
                            server_senders.lock().await.insert(client_id.clone(), tx);

                            // 每个客户端一个任务：读取 + 发送
                            let ss = server_senders.clone();
                            let app_clone = app.clone();
                            let cid_clone = client_id.clone();
                            let addr_clone = addr_str.clone();
                            let conn_cnt = active_connections.clone();

                            tokio::spawn(async move {
                                let mut buf = [0u8; 8192];
                                loop {
                                    tokio::select! {
                                        Some(data) = rx.recv() => {
                                            use tokio::io::AsyncWriteExt;
                                            if let Err(e) = stream.write_all(data.as_bytes()).await {
                                                let _ = app_clone.emit("tcp-server-event", ServerEvent {
                                                    event_type: "error".into(),
                                                    client_id: cid_clone.clone(),
                                                    addr: addr_clone.clone(),
                                                    message: format!("发送失败: {}", e),
                                                    text: None, hex: None, bytes: None,
                                                });
                                            } else {
                                                let _ = app_clone.emit("tcp-server-event", ServerEvent {
                                                    event_type: "server-send".into(),
                                                    client_id: cid_clone.clone(),
                                                    addr: addr_clone.clone(),
                                                    message: format!("已发送 {} bytes", data.len()),
                                                    text: Some(data.clone()),
                                                    hex: None,
                                                    bytes: Some(data.len()),
                                                });
                                            }
                                        }
                                        result = stream.read(&mut buf) => {
                                            match result {
                                                Ok(0) => {
                                                    conn_cnt.fetch_sub(1, Ordering::SeqCst);
                                                    ss.lock().await.remove(&cid_clone);
                                                    let _ = app_clone.emit("tcp-server-event", ServerEvent {
                                                        event_type: "disconnect".into(),
                                                        client_id: cid_clone.clone(),
                                                        addr: addr_clone.clone(),
                                                        message: "客户端已断开".into(),
                                                        text: None, hex: None, bytes: None,
                                                    });
                                                    break;
                                                }
                                                Ok(n) => {
                                                    let chunk = &buf[..n];
                                                    let _ = app_clone.emit("tcp-server-event", ServerEvent {
                                                        event_type: "data".into(),
                                                        client_id: cid_clone.clone(),
                                                        addr: addr_clone.clone(),
                                                        message: String::from_utf8_lossy(chunk).to_string(),
                                                        text: Some(String::from_utf8_lossy(chunk).to_string()),
                                                        hex: Some(chunk.iter().map(|b| format!("{:02X}", b)).collect::<Vec<_>>().join(" ")),
                                                        bytes: Some(n),
                                                    });
                                                }
                                                Err(_) => {
                                                    conn_cnt.fetch_sub(1, Ordering::SeqCst);
                                                    ss.lock().await.remove(&cid_clone);
                                                    let _ = app_clone.emit("tcp-server-event", ServerEvent {
                                                        event_type: "disconnect".into(),
                                                        client_id: cid_clone.clone(),
                                                        addr: addr_clone.clone(),
                                                        message: "连接异常断开".into(),
                                                        text: None, hex: None, bytes: None,
                                                    });
                                                    break;
                                                }
                                            }
                                        }
                                    }
                                }
                            });
                        }
                        Err(e) => {
                            let _ = app_handle.emit("tcp-server-event", ServerEvent {
                                event_type: "error".into(),
                                client_id: "-".into(),
                                addr: "-".into(),
                                message: format!("接受连接失败: {}", e),
                                text: None,
                                hex: None,
                                bytes: None,
                            });
                        }
                    }
                }
                _ = shutdown_rx.recv() => {
                    break;
                }
            }
        }

        running.store(false, Ordering::SeqCst);
        // shutdown_tx 的 Arc 引用在这里自动 drop，stop 命令能检测到 None
        drop(shutdown_guard);
        let _ = app_handle.emit("tcp-server-event", ServerEvent {
            event_type: "info".into(),
            client_id: "-".into(),
            addr: "-".into(),
            message: "服务器已停止".into(),
            text: None,
            hex: None,
            bytes: None,
        });
    });

    Ok(())
}

#[tauri::command]
async fn tcp_server_stop(
    state: tauri::State<'_, ServerState>,
) -> Result<(), String> {
    let mut guard = state.shutdown_tx.lock().await;
    if let Some(tx) = guard.take() {
        let _ = tx.send(());
        state.running.store(false, Ordering::SeqCst);
        // 清空客户端发送通道
        state.client_senders.lock().await.clear();
        Ok(())
    } else {
        Err("服务器未在运行".into())
    }
}

/// 向指定客户端发送数据
#[tauri::command]
async fn tcp_server_send(
    state: tauri::State<'_, ServerState>,
    client_id: String,
    data: String,
) -> Result<(), String> {
    let senders = state.client_senders.lock().await;
    if let Some(tx) = senders.get(&client_id) {
        tx.send(data)
            .map_err(|_| "客户端已断开".to_string())
    } else {
        Err(format!("客户端 {} 不存在", client_id))
    }
}

/// 断开指定客户端
#[tauri::command]
async fn tcp_server_disconnect_client(
    state: tauri::State<'_, ServerState>,
    client_id: String,
) -> Result<(), String> {
    let mut senders = state.client_senders.lock().await;
    if senders.remove(&client_id).is_some() {
        Ok(())
    } else {
        Err(format!("客户端 {} 不存在", client_id))
    }
}

/* ---------- 文本 Diff ---------- */

#[derive(Serialize)]
struct LineMark {
    from: usize,
    to: usize,
    #[serde(rename = "type")]
    mark_type: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct TextDiffResult {
    left_marks: Vec<LineMark>,
    right_marks: Vec<LineMark>,
}

#[tauri::command]
fn text_diff(left: String, right: String) -> TextDiffResult {
    let diff = TextDiff::from_lines(&left, &right);
    let changes: Vec<_> = diff.iter_all_changes().collect();

    let mut left_marks: Vec<LineMark> = Vec::new();
    let mut right_marks: Vec<LineMark> = Vec::new();
    let mut i = 0;

    while i < changes.len() {
        let ch = &changes[i];
        match ch.tag() {
            ChangeTag::Delete => {
                let del_lines = ch.value().lines().count();
                let del_start = ch.old_index().unwrap_or(0) + 1;
                let del_end = del_start + del_lines.saturating_sub(1);

                if i + 1 < changes.len() && changes[i + 1].tag() == ChangeTag::Insert {
                    let ins = &changes[i + 1];
                    let ins_lines = ins.value().lines().count();
                    let ins_start = ins.new_index().unwrap_or(0) + 1;
                    let ins_end = ins_start + ins_lines.saturating_sub(1);

                    left_marks.push(LineMark { from: del_start, to: del_end, mark_type: "changed".into() });
                    right_marks.push(LineMark { from: ins_start, to: ins_end, mark_type: "changed".into() });
                    i += 2;
                } else {
                    left_marks.push(LineMark { from: del_start, to: del_end, mark_type: "removed".into() });
                    i += 1;
                }
            }
            ChangeTag::Insert => {
                let ins_lines = ch.value().lines().count();
                let ins_start = ch.new_index().unwrap_or(0) + 1;
                let ins_end = ins_start + ins_lines.saturating_sub(1);
                right_marks.push(LineMark { from: ins_start, to: ins_end, mark_type: "added".into() });
                i += 1;
            }
            ChangeTag::Equal => {
                i += 1;
            }
        }
    }

    TextDiffResult { left_marks, right_marks }
}

/* ---------- 端口检查 ---------- */

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct PortEntry {
    port: u16,
    pid: u32,
    process_name: String,
    protocol: String,
}

#[cfg(not(target_os = "windows"))]
#[tauri::command]
fn list_ports() -> Result<Vec<PortEntry>, String> {
    let output = std::process::Command::new("lsof")
        .args(["-iTCP", "-sTCP:LISTEN", "-nP"])
        .output()
        .map_err(|e| format!("执行 lsof 失败: {}", e))?;

    if !output.status.success() {
        return Err("lsof 命令执行失败".into());
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let mut entries: Vec<PortEntry> = Vec::new();

    for line in stdout.lines().skip(1) {
        let parts: Vec<&str> = line.split_whitespace().collect();
        if parts.len() < 9 {
            continue;
        }

        let process_name = parts[0].to_string();
        let pid: u32 = parts[1]
            .parse()
            .map_err(|_| format!("解析 PID 失败: {}", parts[1]))?;

        // NAME 列格式: TCP *:3000 (LISTEN) 或 TCP 127.0.0.1:3000 (LISTEN)
        let addr_part = parts[8];
        let port_str = if let Some(pos) = addr_part.rfind(':') {
            &addr_part[pos + 1..]
        } else {
            continue;
        };

        let port: u16 = port_str
            .parse()
            .map_err(|_| format!("解析端口失败: {}", port_str))?;

        // 去重：同一个端口可能有多行（IPv4/IPv6）
        if entries.iter().any(|e| e.port == port && e.pid == pid) {
            continue;
        }

        entries.push(PortEntry {
            port,
            pid,
            process_name,
            protocol: "TCP".into(),
        });
    }

    entries.sort_by_key(|e| e.port);
    Ok(entries)
}

#[cfg(target_os = "windows")]
#[tauri::command]
fn list_ports() -> Result<Vec<PortEntry>, String> {
    // Windows: 用 netstat -ano -p TCP 列出监听端口
    let output = std::process::Command::new("netstat")
        .args(["-ano", "-p", "TCP"])
        .output()
        .map_err(|e| format!("执行 netstat 失败: {}", e))?;

    if !output.status.success() {
        return Err("netstat 命令执行失败".into());
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let mut pid_to_name: std::collections::HashMap<u32, String> = std::collections::HashMap::new();

    // 用 tasklist 获取 PID -> 进程名映射
    if let Ok(tasklist_out) = std::process::Command::new("tasklist")
        .args(["/FO", "CSV", "/NH"])
        .output()
    {
        let tasklist_stdout = String::from_utf8_lossy(&tasklist_out.stdout);
        for line in tasklist_stdout.lines() {
            // 格式: "进程名","PID","会话名","会话#","内存"
            let fields: Vec<&str> = line.split("\",\"").collect();
            if fields.len() >= 2 {
                let name = fields[0].trim_start_matches('"').to_string();
                if let Ok(pid) = fields[1].parse::<u32>() {
                    pid_to_name.entry(pid).or_insert(name);
                }
            }
        }
    }

    let mut entries: Vec<PortEntry> = Vec::new();

    for line in stdout.lines() {
        // 跳过空行和表头
        let trimmed = line.trim();
        if trimmed.is_empty() || trimmed.starts_with("活动") || trimmed.starts_with("Active")
            || trimmed.starts_with("协议") || trimmed.starts_with("Proto")
        {
            continue;
        }

        let parts: Vec<&str> = trimmed.split_whitespace().collect();
        if parts.len() < 5 {
            continue;
        }

        // 格式: TCP 0.0.0.0:135 0.0.0.0:0 LISTENING 1234
        let local_addr = parts[1];
        let state = parts[3];
        if state != "LISTENING" {
            continue;
        }

        let port_str = if let Some(pos) = local_addr.rfind(':') {
            &local_addr[pos + 1..]
        } else {
            continue;
        };

        let port: u16 = match port_str.parse() {
            Ok(p) => p,
            Err(_) => continue,
        };

        let pid: u32 = match parts[4].parse() {
            Ok(p) => p,
            Err(_) => continue,
        };

        // 去重
        if entries.iter().any(|e| e.port == port && e.pid == pid) {
            continue;
        }

        let process_name = pid_to_name
            .get(&pid)
            .cloned()
            .unwrap_or_else(|| format!("PID-{}", pid));

        entries.push(PortEntry {
            port,
            pid,
            process_name,
            protocol: "TCP".into(),
        });
    }

    entries.sort_by_key(|e| e.port);
    Ok(entries)
}

#[cfg(not(target_os = "windows"))]
#[tauri::command]
fn kill_process(pid: u32) -> Result<(), String> {
    // 先尝试 SIGTERM 优雅退出，超时后 SIGKILL
    let term_output = std::process::Command::new("kill")
        .args(["-15", &pid.to_string()])
        .output()
        .map_err(|e| format!("执行 kill 失败: {}", e))?;

    if !term_output.status.success() {
        // SIGTERM 失败，直接尝试 SIGKILL
        let kill_output = std::process::Command::new("kill")
            .args(["-9", &pid.to_string()])
            .output()
            .map_err(|e| format!("执行 kill 失败: {}", e))?;

        if !kill_output.status.success() {
            return Err(format!("终止进程 {} 失败，可能权限不足", pid));
        }
        return Ok(());
    }

    // 等待进程退出（最多 3 秒）
    std::thread::sleep(Duration::from_millis(500));
    for _ in 0..5 {
        // 检查进程是否仍在运行: kill -0 不发送信号，仅检查进程是否存在
        let check = std::process::Command::new("kill")
            .args(["-0", &pid.to_string()])
            .output();
        if check.map(|o| !o.status.success()).unwrap_or(true) {
            return Ok(());
        }
        std::thread::sleep(Duration::from_millis(500));
    }

    // 超时仍未退出，强制 SIGKILL
    let _ = std::process::Command::new("kill")
        .args(["-9", &pid.to_string()])
        .output();
    Ok(())
}

#[cfg(target_os = "windows")]
#[tauri::command]
fn kill_process(pid: u32) -> Result<(), String> {
    // Windows: taskkill /PID xxx /F
    let output = std::process::Command::new("taskkill")
        .args(["/PID", &pid.to_string(), "/F"])
        .output()
        .map_err(|e| format!("执行 taskkill 失败: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("终止进程 {} 失败: {}", pid, stderr.trim()));
    }
    Ok(())
}

/* ---------- 启动入口 ---------- */

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .manage(ServerState::default())
        .manage(TcpPool::default())
        .invoke_handler(tauri::generate_handler![
            app_ready,
            tcp_send,
            tcp_connect,
            tcp_conn_send,
            tcp_disconnect,
            tcp_server_start,
            tcp_server_stop,
            tcp_server_send,
            tcp_server_disconnect_client,
            text_diff,
            list_ports,
            kill_process
        ])
        .run(tauri::generate_context!())
        .expect("error while running NovaTool");
}
