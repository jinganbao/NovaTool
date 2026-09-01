use std::collections::HashMap;
use std::time::Instant;

use serde::{Deserialize, Serialize};

const MAX_RESPONSE_BYTES: usize = 16 * 1024 * 1024;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HttpKeyValue {
    pub key: String,
    pub value: String,
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
    pub timeout_ms: Option<u64>,
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
pub async fn http_request(request: HttpRequest) -> Result<HttpResponse, String> {
    let method = reqwest::Method::from_bytes(request.method.as_bytes()).map_err(|_| "不支持的 HTTP 方法".to_string())?;
    let timeout = std::time::Duration::from_millis(request.timeout_ms.unwrap_or(15000).clamp(100, 120000));
    let client = reqwest::Client::builder().timeout(timeout).build().map_err(|error| format!("创建 HTTP 客户端失败: {}", error))?;
    let mut builder = client.request(method, &request.url);
    let query = request.query.into_iter().filter(|item| !item.key.trim().is_empty()).map(|item| (item.key, item.value)).collect::<Vec<_>>();
    if !query.is_empty() { builder = builder.query(&query); }
    for header in request.headers.into_iter().filter(|item| !item.key.trim().is_empty()) {
        builder = builder.header(&header.key, &header.value);
    }
    if !request.body.is_empty() && request.body_type != "none" {
        builder = if request.body_type == "json" { builder.header(reqwest::header::CONTENT_TYPE, "application/json").body(request.body) } else { builder.body(request.body) };
    }
    let started = Instant::now();
    let response = builder.send().await.map_err(|error| format!("HTTP 请求失败: {}", error))?;
    let status = response.status();
    let status_text = status.canonical_reason().unwrap_or("").to_string();
    let headers = response.headers().iter().map(|(key, value)| (key.to_string(), value.to_str().unwrap_or("<binary>").to_string())).collect::<HashMap<_, _>>();
    let bytes = response.bytes().await.map_err(|error| format!("读取响应失败: {}", error))?;
    let truncated = bytes.len() > MAX_RESPONSE_BYTES;
    let body = String::from_utf8_lossy(&bytes[..bytes.len().min(MAX_RESPONSE_BYTES)]).to_string();
    Ok(HttpResponse { status: status.as_u16(), status_text, headers, size: bytes.len(), body, duration_ms: started.elapsed().as_millis(), truncated })
}
