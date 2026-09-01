mod formatters;
mod http_client;
mod menu;
mod port_check;
mod tcp_client;
mod tcp_server;
mod udp_client;
mod text_diff;
mod utils;

#[cfg(target_os = "macos")]
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
        .plugin(
            // 日志插件：stdout + 应用日志目录落盘，供排障使用
            tauri_plugin_log::Builder::new()
                .level(log::LevelFilter::Info)
                .targets([
                    tauri_plugin_log::Target::new(tauri_plugin_log::TargetKind::Stdout),
                    tauri_plugin_log::Target::new(tauri_plugin_log::TargetKind::LogDir {
                        file_name: Some("NovaTool".into()),
                    }),
                ])
                .build(),
        )
        .manage(tcp_server::ServerState::default())
        .manage(tcp_client::TcpPool::default())
        .invoke_handler(tauri::generate_handler![
            app_ready,
            tcp_client::tcp_send,
            tcp_client::tcp_connect,
            tcp_client::tcp_conn_send,
            tcp_client::tcp_disconnect,
            udp_client::udp_send,
            tcp_server::tcp_server_start,
            tcp_server::tcp_server_stop,
            tcp_server::tcp_server_send,
            tcp_server::tcp_server_broadcast,
            tcp_server::tcp_server_disconnect_client,
            text_diff::text_diff,
            formatters::json::json_format,
            formatters::xml::xml_format,
            port_check::list_ports,
            port_check::kill_process,
            menu::open_url
            , http_client::http_request
        ])
        .setup(|app| {
            // 系统菜单栏（全中文）
            menu::build_menu(app.handle())?;
            app.on_menu_event(move |app, event| {
                menu::handle_menu_event(app, event.id().as_ref());
            });
            Ok(())
        })
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
fn handle_macos_dock_lifecycle(app_handle: &tauri::AppHandle, event: tauri::RunEvent) {
    // 应用是否处于退出流程（Cmd+Q / 系统退出）：此时允许窗口真正关闭
    static QUITTING: AtomicBool = AtomicBool::new(false);

    match event {
        tauri::RunEvent::ExitRequested { .. } => {
            QUITTING.store(true, Ordering::SeqCst);
        }
        // 点击 Dock 图标：重新显示主窗口
        tauri::RunEvent::Reopen {
            has_visible_windows,
            ..
        } => {
            if !has_visible_windows {
                if let Some(window) = app_handle.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.unminimize();
                    let _ = window.set_focus();
                }
            }
        }
        // 关闭请求：非退出流程时拦截并隐藏（驻留 Dock）
        // 保持 MSRV 1.77，不采用 clippy 建议的 let-chain/match-guard 写法
        #[allow(clippy::collapsible_match)]
        tauri::RunEvent::WindowEvent {
            label,
            event: tauri::WindowEvent::CloseRequested { api, .. },
            ..
        } => {
            if label == "main" && !QUITTING.load(Ordering::SeqCst) {
                api.prevent_close();
                // map 代替嵌套 if-let，避免 clippy::collapsible_if（保持 MSRV 1.77）
                let _ = app_handle.get_webview_window("main").map(|window| {
                    let _ = window.hide();
                });
            }
        }
        _ => {}
    }
}
