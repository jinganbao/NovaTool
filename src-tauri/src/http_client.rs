use std::collections::HashMap;
use std::time::Instant;

use serde::{Deserialize, Serialize};
use base64::Engine;
use tauri::State;
use tokio::sync::oneshot;

const MAX_RESPONSE_BYTES: usize = 16 * 1024 * 1024;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HttpKeyValue {
    pub key: String,
    pub value: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HttpBodyField {
    pub key: String,
    pub value: String,
    #[serde(default)]
    pub field_type: String,
    #[serde(default)]
    pub file_data: Option<String>,
    #[serde(default)]
    pub file_name: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HttpRequest {
    pub method: String,
    pub url: String,
    pub query: Vec<HttpKeyValue>,
    pub headers: Vec<HttpKeyValue>,
    pub body: String,
    pub body_type: String,
    #[serde(default)]
    pub body_fields: Vec<HttpBodyField>,
    pub timeout_ms: Option<u64>,
    #[serde(default)]
    pub request_id: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HttpResponse {
    pub status: u16,
    pub status_text: String,
    pub headers: HashMap<String, String>,
    pub body: String,
    pub size: usize,
    pub duration_ms: u128,
    pub truncated: bool,
}

#[tauri::command]
pub async fn http_request(request: HttpRequest, state: State<'_, crate::HttpRequestState>) -> Result<HttpResponse, String> {
    let method = reqwest::Method::from_bytes(request.method.as_bytes()).map_err(|_| "不支持的 HTTP 方法".to_string())?;
    let timeout = std::time::Duration::from_millis(request.timeout_ms.unwrap_or(15000).clamp(100, 120000));
    let client = reqwest::Client::builder().timeout(timeout).build().map_err(|error| format!("创建 HTTP 客户端失败: {}", error))?;
    let mut builder = client.request(method, &request.url);
    let query = request.query.into_iter().filter(|item| !item.key.trim().is_empty()).map(|item| (item.key, item.value)).collect::<Vec<_>>();
    if !query.is_empty() { builder = builder.query(&query); }
    for header in request.headers.into_iter().filter(|item| !item.key.trim().is_empty()) {
        builder = builder.header(&header.key, &header.value);
    }
    if request.body_type == "form-data" {
        let mut form = reqwest::multipart::Form::new();
        for field in request.body_fields.into_iter().filter(|item| !item.key.trim().is_empty()) {
            if field.field_type == "file" {
                let encoded = field.file_data.unwrap_or_default();
                let bytes = encoded.split_once(',').map(|(_, value)| value).unwrap_or(encoded.as_str());
                let decoded = base64::engine::general_purpose::STANDARD.decode(bytes).map_err(|_| "文件内容无效，无法编码为 multipart 请求".to_string())?;
                let mut part = reqwest::multipart::Part::bytes(decoded);
                if let Some(name) = field.file_name.filter(|name| !name.trim().is_empty()) { part = part.file_name(name); }
                form = form.part(field.key, part);
            } else {
                form = form.text(field.key, field.value);
            }
        }
        builder = builder.multipart(form);
    } else if !request.body.is_empty() && request.body_type != "none" {
        builder = match request.body_type.as_str() {
            "json" => builder.header(reqwest::header::CONTENT_TYPE, "application/json").body(request.body),
            "x-www-form-urlencoded" => builder.header(reqwest::header::CONTENT_TYPE, "application/x-www-form-urlencoded").body(request.body),
            "xml" => builder.header(reqwest::header::CONTENT_TYPE, "application/xml").body(request.body),
            "text" => builder.header(reqwest::header::CONTENT_TYPE, "text/plain; charset=utf-8").body(request.body),
            _ => builder.body(request.body),
        };
    }
    let started = Instant::now();
    let request_id = request.request_id.clone();
    let (cancel_tx, cancel_rx) = oneshot::channel();
    if let Some(id) = request_id.as_ref() { state.cancellations.lock().await.insert(id.clone(), cancel_tx); }
    let response_result = tokio::select! {
        result = builder.send() => result.map_err(|error| format!("HTTP 请求失败: {}", error)),
        _ = cancel_rx => Err("HTTP 请求已取消".to_string()),
    };
    if let Some(id) = request_id.as_ref() { state.cancellations.lock().await.remove(id); }
    let response = response_result?;
    let status = response.status();
    let status_text = status.canonical_reason().unwrap_or("").to_string();
    let headers = response.headers().iter().map(|(key, value)| (key.to_string(), value.to_str().unwrap_or("<binary>").to_string())).collect::<HashMap<_, _>>();
    let bytes = response.bytes().await.map_err(|error| format!("读取响应失败: {}", error))?;
    let truncated = bytes.len() > MAX_RESPONSE_BYTES;
    let body = String::from_utf8_lossy(&bytes[..bytes.len().min(MAX_RESPONSE_BYTES)]).to_string();
    Ok(HttpResponse { status: status.as_u16(), status_text, headers, size: bytes.len(), body, duration_ms: started.elapsed().as_millis(), truncated })
}

#[tauri::command]
pub async fn cancel_http_request(request_id: String, state: State<'_, crate::HttpRequestState>) -> Result<bool, String> {
    Ok(state.cancellations.lock().await.remove(&request_id).map(|sender| sender.send(()).is_ok()).unwrap_or(false))
}
