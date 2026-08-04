use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, AtomicU32, Ordering};
use std::sync::Arc;

use serde::Serialize;
use tokio::io::AsyncReadExt;
use tokio::net::TcpListener;
use tokio::sync::{broadcast, Mutex};
use tauri::{AppHandle, Emitter};

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

/// 启动 TCP 服务端：监听端口，多客户端管理，支持向客户端发送数据
#[tauri::command]
pub async fn tcp_server_start(
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

/// 停止 TCP 服务端
#[tauri::command]
pub async fn tcp_server_stop(
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
pub async fn tcp_server_send(
    state: tauri::State<'_, ServerState>,
    client_id: String,
    data: String,
) -> Result<(), String> {
    let senders = state.client_senders.lock().await;
    if let Some(tx) = senders.get(&client_id) {
        tx.send(data).map_err(|_| "客户端已断开".to_string())
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
