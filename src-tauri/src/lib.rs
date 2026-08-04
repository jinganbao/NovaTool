mod port_check;
mod tcp_client;
mod tcp_server;
mod text_diff;
mod utils;

#[tauri::command]
fn app_ready() -> &'static str {
    "NovaTool ready"
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
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
        .run(tauri::generate_context!())
        .expect("error while running NovaTool");
}
