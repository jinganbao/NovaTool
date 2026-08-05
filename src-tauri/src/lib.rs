mod port_check;
mod tcp_client;
mod tcp_server;
mod text_diff;
mod utils;

use std::sync::atomic::{AtomicBool, Ordering};

#[cfg(target_os = "macos")]
use tauri::Manager;

#[tauri::command]
fn app_ready() -> &'static str {
    "NovaTool ready"
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app = tauri::Builder::default()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .manage(tcp_server::ServerState::default())
        .manage(tcp_client::TcpPool::default())
        .invoke_handler(tauri::generate_handler![
            app_ready,
            tcp_client::tcp_send,
            tcp_client::tcp_connect,
            tcp_client::tcp_conn_send,
            tcp_client::tcp_disconnect,
            tcp_server::tcp_server_start,
            tcp_server::tcp_server_stop,
            tcp_server::tcp_server_send,
            tcp_server::tcp_server_disconnect_client,
            text_diff::text_diff,
            port_check::list_ports,
            port_check::kill_process
        ])
        .build(tauri::generate_context!())
        .expect("error while building NovaTool");

    #[cfg(target_os = "macos")]
    app.run(handle_macos_dock_lifecycle);

    #[cfg(not(target_os = "macos"))]
    app.run(|_app, _event| {});
}

/// macOS 生命周期：点击关闭按钮只隐藏窗口、驻留 Dock；Cmd+Q / 右键退出才真正退出。
/// 点击 Dock 图标时重新显示窗口。
#[cfg(target_os = "macos")]
fn handle_macos_dock_lifecycle(
    app_handle: &tauri::AppHandle,
    event: tauri::RunEvent,
) {
    // 应用是否处于退出流程（Cmd+Q / 系统退出）：此时允许窗口真正关闭
    static QUITTING: AtomicBool = AtomicBool::new(false);

    match event {
        tauri::RunEvent::ExitRequested { .. } => {
            QUITTING.store(true, Ordering::SeqCst);
        }
        // 点击 Dock 图标：重新显示主窗口
        tauri::RunEvent::Reopen { has_visible_windows, .. } => {
            if !has_visible_windows {
                if let Some(window) = app_handle.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.unminimize();
                    let _ = window.set_focus();
                }
            }
        }
        // 关闭请求：非退出流程时拦截并隐藏（驻留 Dock）
        tauri::RunEvent::WindowEvent {
            label,
            event: tauri::WindowEvent::CloseRequested { api, .. },
            ..
        } => {
            if label == "main" && !QUITTING.load(Ordering::SeqCst) {
                api.prevent_close();
                if let Some(window) = app_handle.get_webview_window("main") {
                    let _ = window.hide();
                }
            }
        }
        _ => {}
    }
}
