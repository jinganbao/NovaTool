use std::time::Duration;

use serde::Serialize;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PortEntry {
    port: u16,
    pid: u32,
    process_name: String,
    protocol: String,
}

/// 列出所有监听端口（macOS/Linux 用 lsof）
#[cfg(not(target_os = "windows"))]
#[tauri::command]
pub fn list_ports() -> Result<Vec<PortEntry>, String> {
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

/// 列出所有监听端口（Windows 用 netstat + tasklist）
#[cfg(target_os = "windows")]
#[tauri::command]
pub fn list_ports() -> Result<Vec<PortEntry>, String> {
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

/// 终止进程（macOS/Linux）：先 SIGTERM 优雅退出，超时后 SIGKILL
#[cfg(not(target_os = "windows"))]
#[tauri::command]
pub fn kill_process(pid: u32) -> Result<(), String> {
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
        // kill -0 不发送信号，仅检查进程是否存在
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

/// 终止进程（Windows 用 taskkill）
#[cfg(target_os = "windows")]
#[tauri::command]
pub fn kill_process(pid: u32) -> Result<(), String> {
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
