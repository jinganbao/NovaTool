use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, AtomicU32, Ordering};
use std::sync::Arc;

use serde::Serialize;
use tauri::{AppHandle, Emitter};
use tokio::io::AsyncReadExt;
use tokio::net::TcpListener;
use tokio::sync::{broadcast, Mutex};

/// 推送到前端的日志事件
#[derive(Clone, Serialize)]
pub struct ServerEvent {
    #[serde(rename = "type")]
    pub event_type: String,
    pub client_id: String,
    pub addr: String,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub text: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub hex: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub bytes: Option<usize>,
}

/// 服务器运行状态（Arc 包装，可安全移入 tokio::spawn）
pub struct ServerState {
    running: Arc<AtomicBool>,
    shutdown_tx: Arc<Mutex<Option<broadcast::Sender<()>>>>,
    // bounded channel：客户端消费过慢时发送端 try_send 失败，防止内存无限堆积
    client_senders: Arc<Mutex<HashMap<String, tokio::sync::mpsc::Sender<Vec<u8>>>>>,
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

/// 启动 TCP 服务端：监听端口，多客户端管理，支持向客户端发送数据
/// lan=true 时绑定 0.0.0.0（局域网可访问），默认仅本机 127.0.0.1
#[tauri::command]
pub async fn tcp_server_start(
    app: AppHandle,
    state: tauri::State<'_, ServerState>,
    port: u16,
    lan: Option<bool>,
) -> Result<(), String> {
    if state.running.load(Ordering::SeqCst) {
        return Err("服务器已在运行中".into());
    }

    let bind_addr = if lan.unwrap_or(false) {
        format!("0.0.0.0:{}", port)
    } else {
        format!("127.0.0.1:{}", port)
    };
    let listener = TcpListener::bind(&bind_addr)
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
            message: format!("服务器已启动，监听 {}", bind_addr),
            text: None,
            hex: None,
            bytes: None,
        },
    );

    let app_handle = app.clone();

    // 最大并发连接数限制
    const MAX_CONNECTIONS: u32 = 128;
    let active_connections = Arc::new(AtomicU32::new(0));
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

                            // 注册客户端发送通道（bounded，防内存无限堆积）
                            let (tx, mut rx) = tokio::sync::mpsc::channel::<Vec<u8>>(1024);
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
                                            if let Err(e) = stream.write_all(&data).await {
                                                let _ = app_clone.emit("tcp-server-event", ServerEvent {
                                                    event_type: "error".into(),
                                                    client_id: cid_clone.clone(),
                                                    addr: addr_clone.clone(),
                                                    message: format!("发送失败: {}", e),
                                                    text: None, hex: None, bytes: None,
                                                });
                                                // 发送失败说明连接已不可写：清理并结束该客户端任务
                                                conn_cnt.fetch_sub(1, Ordering::SeqCst);
                                                ss.lock().await.remove(&cid_clone);
                                                let _ = app_clone.emit("tcp-server-event", ServerEvent {
                                                    event_type: "disconnect".into(),
                                                    client_id: cid_clone.clone(),
                                                    addr: addr_clone.clone(),
                                                    message: "连接已断开".into(),
                                                    text: None, hex: None, bytes: None,
                                                });
                                                break;
                                            } else {
                                                let _ = app_clone.emit("tcp-server-event", ServerEvent {
                                                    event_type: "server-send".into(),
                                                    client_id: cid_clone.clone(),
                                                    addr: addr_clone.clone(),
                                                    message: format!("已发送 {} bytes", data.len()),
                                                    text: Some(String::from_utf8_lossy(&data).to_string()),
                                                    hex: Some(crate::utils::encode_hex(&data)),
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
        let _ = app_handle.emit(
            "tcp-server-event",
            ServerEvent {
                event_type: "info".into(),
                client_id: "-".into(),
                addr: "-".into(),
                message: "服务器已停止".into(),
                text: None,
                hex: None,
                bytes: None,
            },
        );
    });

    Ok(())
}

/// 停止 TCP 服务端
#[tauri::command]
pub async fn tcp_server_stop(state: tauri::State<'_, ServerState>) -> Result<(), String> {
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

/// 向指定客户端发送数据（mode="hex" 时按 HEX 字符串解码后发送）
#[tauri::command]
pub async fn tcp_server_send(
    state: tauri::State<'_, ServerState>,
    client_id: String,
    data: String,
    mode: Option<String>,
) -> Result<(), String> {
    // 单次发送上限（1MB），防止超大 payload 堆积内存
    const MAX_SEND_BYTES: usize = 1_000_000;
    if data.len() > MAX_SEND_BYTES {
        return Err(format!("发送数据过大（上限 {} 字节）", MAX_SEND_BYTES));
    }

    let bytes = if mode.as_deref() == Some("hex") {
        crate::utils::decode_hex(&data)?
    } else {
        data.into_bytes()
    };

    let senders = state.client_senders.lock().await;
    if let Some(tx) = senders.get(&client_id) {
        // bounded channel 已满说明客户端消费过慢，拒绝本次发送避免内存堆积
        tx.try_send(bytes)
            .map_err(|_| "发送失败：客户端消费过慢或已断开".to_string())
    } else {
        Err(format!("客户端 {} 不存在", client_id))
    }
}

/// 断开指定客户端
#[tauri::command]
pub async fn tcp_server_disconnect_client(
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
