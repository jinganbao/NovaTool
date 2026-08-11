use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::Arc;

use serde::Serialize;
use tauri::{AppHandle, Emitter};
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpListener;
use tokio::sync::{broadcast, mpsc, Mutex, Notify};

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
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

#[derive(Clone)]
struct ClientHandle {
    sender: mpsc::Sender<Vec<u8>>,
    shutdown: broadcast::Sender<()>,
}

pub struct ServerState {
    running: Arc<AtomicBool>,
    shutdown_tx: Arc<Mutex<Option<broadcast::Sender<()>>>>,
    stopped: Arc<Notify>,
    clients: Arc<Mutex<HashMap<String, ClientHandle>>>,
}

impl Default for ServerState {
    fn default() -> Self {
        Self {
            running: Arc::new(AtomicBool::new(false)),
            shutdown_tx: Arc::new(Mutex::new(None)),
            stopped: Arc::new(Notify::new()),
            clients: Arc::new(Mutex::new(HashMap::new())),
        }
    }
}

const MAX_CONNECTIONS: usize = 128;
const MAX_SEND_BYTES: usize = 1_000_000;

fn emit_event(app: &AppHandle, event: ServerEvent) {
    let _ = app.emit("tcp-server-event", event);
}

fn simple_event(event_type: &str, client_id: &str, addr: &str, message: String) -> ServerEvent {
    ServerEvent {
        event_type: event_type.into(),
        client_id: client_id.into(),
        addr: addr.into(),
        message,
        text: None,
        hex: None,
        bytes: None,
    }
}

fn next_client_id() -> String {
    static COUNTER: AtomicU64 = AtomicU64::new(0);
    format!("Client-{}", COUNTER.fetch_add(1, Ordering::Relaxed) + 1)
}

/// 启动 TCP 服务端。lan=true 时绑定 0.0.0.0，默认仅本机访问。
#[tauri::command]
pub async fn tcp_server_start(
    app: AppHandle,
    state: tauri::State<'_, ServerState>,
    port: u16,
    lan: Option<bool>,
) -> Result<(), String> {
    if state
        .running
        .compare_exchange(false, true, Ordering::AcqRel, Ordering::Acquire)
        .is_err()
    {
        return Err("服务器已在运行中".into());
    }

    let bind_addr = if lan.unwrap_or(false) {
        format!("0.0.0.0:{}", port)
    } else {
        format!("127.0.0.1:{}", port)
    };
    let listener = match TcpListener::bind(&bind_addr).await {
        Ok(listener) => listener,
        Err(error) => {
            state.running.store(false, Ordering::Release);
            return Err(format!("绑定端口失败: {}", error));
        }
    };

    let (shutdown_tx, mut shutdown_rx) = broadcast::channel::<()>(1);
    *state.shutdown_tx.lock().await = Some(shutdown_tx);
    emit_event(
        &app,
        simple_event(
            "info",
            "-",
            "-",
            format!("服务器已启动，监听 {}", bind_addr),
        ),
    );

    let running = state.running.clone();
    let stopped = state.stopped.clone();
    let clients = state.clients.clone();
    let app_handle = app.clone();

    tokio::spawn(async move {
        loop {
            tokio::select! {
                accepted = listener.accept() => {
                    match accepted {
                        Ok((stream, addr)) => {
                            if clients.lock().await.len() >= MAX_CONNECTIONS {
                                emit_event(&app_handle, simple_event(
                                    "error", "-", &addr.to_string(),
                                    format!("连接数已达上限({})，拒绝新连接", MAX_CONNECTIONS),
                                ));
                                continue;
                            }

                            let client_id = next_client_id();
                            let addr_text = addr.to_string();
                            let (sender, receiver) = mpsc::channel::<Vec<u8>>(256);
                            let (client_shutdown, shutdown_receiver) = broadcast::channel::<()>(1);
                            clients.lock().await.insert(
                                client_id.clone(),
                                ClientHandle { sender, shutdown: client_shutdown },
                            );
                            emit_event(&app_handle, simple_event(
                                "connect", &client_id, &addr_text,
                                format!("客户端已连接: {}", addr_text),
                            ));

                            spawn_client_task(
                                app_handle.clone(),
                                clients.clone(),
                                client_id,
                                addr_text,
                                stream,
                                receiver,
                                shutdown_receiver,
                            );
                        }
                        Err(error) => emit_event(&app_handle, simple_event(
                            "error", "-", "-", format!("接受连接失败: {}", error),
                        )),
                    }
                }
                _ = shutdown_rx.recv() => break,
            }
        }

        running.store(false, Ordering::Release);
        emit_event(
            &app_handle,
            simple_event("info", "-", "-", "服务器已停止".into()),
        );
        stopped.notify_waiters();
    });

    Ok(())
}

#[allow(clippy::too_many_arguments)]
fn spawn_client_task(
    app: AppHandle,
    clients: Arc<Mutex<HashMap<String, ClientHandle>>>,
    client_id: String,
    addr: String,
    mut stream: tokio::net::TcpStream,
    mut receiver: mpsc::Receiver<Vec<u8>>,
    mut shutdown: broadcast::Receiver<()>,
) {
    tokio::spawn(async move {
        let mut buffer = [0_u8; 8192];
        let disconnect_message = loop {
            tokio::select! {
                outgoing = receiver.recv() => {
                    let Some(data) = outgoing else {
                        break "连接已关闭";
                    };
                    if let Err(error) = stream.write_all(&data).await {
                        emit_event(&app, simple_event(
                            "error", &client_id, &addr, format!("发送失败: {}", error),
                        ));
                        break "连接异常断开";
                    }
                    emit_event(&app, ServerEvent {
                        event_type: "server-send".into(),
                        client_id: client_id.clone(),
                        addr: addr.clone(),
                        message: format!("已发送 {} bytes", data.len()),
                        text: Some(String::from_utf8_lossy(&data).to_string()),
                        hex: Some(crate::utils::encode_hex(&data)),
                        bytes: Some(data.len()),
                    });
                }
                result = stream.read(&mut buffer) => {
                    match result {
                        Ok(0) => break "客户端已断开",
                        Ok(size) => {
                            let chunk = &buffer[..size];
                            emit_event(&app, ServerEvent {
                                event_type: "data".into(),
                                client_id: client_id.clone(),
                                addr: addr.clone(),
                                message: String::from_utf8_lossy(chunk).to_string(),
                                text: Some(String::from_utf8_lossy(chunk).to_string()),
                                hex: Some(crate::utils::encode_hex(chunk)),
                                bytes: Some(size),
                            });
                        }
                        Err(_) => break "连接异常断开",
                    }
                }
                _ = shutdown.recv() => break "连接已关闭",
            }
        };

        let _ = stream.shutdown().await;
        clients.lock().await.remove(&client_id);
        emit_event(
            &app,
            simple_event("disconnect", &client_id, &addr, disconnect_message.into()),
        );
    });
}

/// 停止监听并关闭所有已建立客户端连接；返回前确保监听任务已退出。
#[tauri::command]
pub async fn tcp_server_stop(state: tauri::State<'_, ServerState>) -> Result<(), String> {
    let stopped = state.stopped.notified();
    let tx = state
        .shutdown_tx
        .lock()
        .await
        .take()
        .ok_or_else(|| "服务器未在运行".to_string())?;

    let handles = {
        let mut clients = state.clients.lock().await;
        clients
            .drain()
            .map(|(_, handle)| handle)
            .collect::<Vec<_>>()
    };
    for handle in handles {
        let _ = handle.shutdown.send(());
    }
    let _ = tx.send(());
    stopped.await;
    Ok(())
}

/// 向指定客户端发送数据。
#[tauri::command]
pub async fn tcp_server_send(
    state: tauri::State<'_, ServerState>,
    client_id: String,
    data: String,
    mode: Option<String>,
) -> Result<(), String> {
    if data.len() > MAX_SEND_BYTES * 3 {
        return Err(format!("发送数据过大（上限 {} 字节）", MAX_SEND_BYTES));
    }
    let bytes = if mode.as_deref() == Some("hex") {
        crate::utils::decode_hex(&data)?
    } else {
        data.into_bytes()
    };
    if bytes.len() > MAX_SEND_BYTES {
        return Err(format!("发送数据过大（上限 {} 字节）", MAX_SEND_BYTES));
    }

    let sender = state
        .clients
        .lock()
        .await
        .get(&client_id)
        .map(|handle| handle.sender.clone())
        .ok_or_else(|| format!("客户端 {} 不存在", client_id))?;
    sender
        .try_send(bytes)
        .map_err(|_| "发送失败：客户端消费过慢或已断开".to_string())
}

/// 关闭指定客户端的 socket，并由客户端任务统一发送断开事件和清理状态。
#[tauri::command]
pub async fn tcp_server_disconnect_client(
    state: tauri::State<'_, ServerState>,
    client_id: String,
) -> Result<(), String> {
    let handle = state
        .clients
        .lock()
        .await
        .remove(&client_id)
        .ok_or_else(|| format!("客户端 {} 不存在", client_id))?;
    handle
        .shutdown
        .send(())
        .map(|_| ())
        .map_err(|_| "客户端连接已结束".to_string())
}
