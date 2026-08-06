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

/// 解析 lsof 输出行（macOS/Linux）
/// 格式: COMMAND PID USER FD TYPE DEVICE SIZE/OFF NODE NAME
/// 示例: node    12345 user   15u  IPv4 0x1234      0t0  TCP *:3000 (LISTEN)
fn parse_lsof_line(line: &str) -> Option<PortEntry> {
    let parts: Vec<&str> = line.split_whitespace().collect();
    if parts.len() < 9 {
        return None;
    }

    let process_name = parts[0].to_string();
    let pid: u32 = parts[1].parse().ok()?;

    // NAME 列格式: TCP *:3000 (LISTEN) 或 TCP 127.0.0.1:3000 (LISTEN)
    let addr_part = parts[8];
    let port_str = addr_part.rfind(':').map(|pos| &addr_part[pos + 1..])?;
    let port: u16 = port_str.parse().ok()?;

    Some(PortEntry {
        port,
        pid,
        process_name,
        protocol: "TCP".into(),
    })
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
        let Some(entry) = parse_lsof_line(line) else {
            continue;
        };

        // 去重：同一个端口可能有多行（IPv4/IPv6）
        if entries
            .iter()
            .any(|e| e.port == entry.port && e.pid == entry.pid)
        {
            continue;
        }
        entries.push(entry);
    }

    entries.sort_by_key(|e| e.port);
    Ok(entries)
}

/// 解析 netstat 输出行（Windows）
/// 格式: TCP 0.0.0.0:135 0.0.0.0:0 LISTENING 1234
#[cfg(any(target_os = "windows", test))]
fn parse_netstat_line(
    line: &str,
    pid_to_name: &std::collections::HashMap<u32, String>,
) -> Option<PortEntry> {
    let trimmed = line.trim();
    if trimmed.is_empty()
        || trimmed.starts_with("活动")
        || trimmed.starts_with("Active")
        || trimmed.starts_with("协议")
        || trimmed.starts_with("Proto")
    {
        return None;
    }

    let parts: Vec<&str> = trimmed.split_whitespace().collect();
    if parts.len() < 5 {
        return None;
    }

    let local_addr = parts[1];
    let state = parts[3];
    if state != "LISTENING" {
        return None;
    }

    let port_str = local_addr.rfind(':').map(|pos| &local_addr[pos + 1..])?;
    let port: u16 = port_str.parse().ok()?;
    let pid: u32 = parts[4].parse().ok()?;

    let process_name = pid_to_name
        .get(&pid)
        .cloned()
        .unwrap_or_else(|| format!("PID-{}", pid));

    Some(PortEntry {
        port,
        pid,
        process_name,
        protocol: "TCP".into(),
    })
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
        let Some(entry) = parse_netstat_line(line, &pid_to_name) else {
            continue;
        };

        // 去重
        if entries
            .iter()
            .any(|e| e.port == entry.port && e.pid == entry.pid)
        {
            continue;
        }
        entries.push(entry);
    }

    entries.sort_by_key(|e| e.port);
    Ok(entries)
}

/// 终止进程（macOS/Linux）：先 SIGTERM 优雅退出，超时后 SIGKILL
#[cfg(not(target_os = "windows"))]
#[tauri::command]
pub fn kill_process(pid: u32) -> Result<(), String> {
    // 安全校验：拒绝危险 PID（POSIX 语义下 kill -0/15/9 对 0 号 PID 会作用于整个进程组）
    if pid == 0 {
        return Err("拒绝终止 PID 0（会向整个进程组发信号，可能导致应用自身退出）".into());
    }
    if pid == 1 {
        return Err("拒绝终止 PID 1（系统 init 进程）".into());
    }
    if pid == std::process::id() {
        return Err("拒绝终止应用自身".into());
    }
    if pid < 100 {
        return Err(format!("拒绝终止 PID {}（系统进程）", pid));
    }

    // kill -0 不发送信号，仅检查进程是否存在
    let alive = std::process::Command::new("kill")
        .args(["-0", &pid.to_string()])
        .output()
        .map_err(|e| format!("执行 kill 失败: {}", e))?
        .status
        .success();
    if !alive {
        return Err(format!("进程 {} 不存在", pid));
    }

    let term_output = std::process::Command::new("kill")
        .args(["-15", &pid.to_string()])
        .output()
        .map_err(|e| format!("执行 kill 失败: {}", e))?;

    if !term_output.status.success() {
        // SIGTERM 失败（可能权限不足或进程恰好退出）：先复查进程状态再决定是否 SIGKILL
        let still_alive = std::process::Command::new("kill")
            .args(["-0", &pid.to_string()])
            .output()
            .map(|o| o.status.success())
            .unwrap_or(false);
        if !still_alive {
            return Ok(());
        }
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
    // 安全校验：拒绝危险 PID（System Idle Process=0、System=4）
    if pid == 0 {
        return Err("拒绝终止 PID 0（System Idle Process）".into());
    }
    if pid == 4 {
        return Err("拒绝终止 PID 4（System 进程）".into());
    }
    if pid == std::process::id() {
        return Err("拒绝终止应用自身".into());
    }
    if pid < 100 {
        return Err(format!("拒绝终止 PID {}（系统进程）", pid));
    }

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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_lsof_line_normal() {
        let entry =
            parse_lsof_line("node    12345 user   15u  IPv4 0x1234      0t0  TCP *:3000 (LISTEN)")
                .unwrap();
        assert_eq!(entry.port, 3000);
        assert_eq!(entry.pid, 12345);
        assert_eq!(entry.process_name, "node");
        assert_eq!(entry.protocol, "TCP");
    }

    #[test]
    fn test_parse_lsof_line_localhost() {
        let entry = parse_lsof_line(
            "python3 9999  user   5u  IPv6 0x5678      0t0  TCP 127.0.0.1:8080 (LISTEN)",
        )
        .unwrap();
        assert_eq!(entry.port, 8080);
        assert_eq!(entry.pid, 9999);
    }

    #[test]
    fn test_parse_lsof_line_invalid() {
        // 列数不足 / PID 非数字 / 端口非数字
        assert!(parse_lsof_line("node 12345 user").is_none());
        assert!(parse_lsof_line("node abc user 15u IPv4 0x1 0t0 TCP *:3000 (LISTEN)").is_none());
        assert!(parse_lsof_line("node 12345 user 15u IPv4 0x1 0t0 TCP *:abc (LISTEN)").is_none());
        // 无端口部分（NAME 列没有冒号）
        assert!(parse_lsof_line("node 12345 user 15u IPv4 0x1 0t0 TCP (LISTEN)").is_none());
    }

    #[test]
    fn test_parse_netstat_line_normal() {
        let mut map = std::collections::HashMap::new();
        map.insert(1234u32, "svchost.exe".to_string());
        let entry = parse_netstat_line(
            "  TCP    0.0.0.0:135            0.0.0.0:0              LISTENING       1234",
            &map,
        )
        .unwrap();
        assert_eq!(entry.port, 135);
        assert_eq!(entry.pid, 1234);
        assert_eq!(entry.process_name, "svchost.exe");
    }

    #[test]
    fn test_parse_netstat_line_no_name_fallback() {
        let map = std::collections::HashMap::new();
        let entry =
            parse_netstat_line("TCP 127.0.0.1:5432 0.0.0.0:0 LISTENING 4242", &map).unwrap();
        assert_eq!(entry.port, 5432);
        assert_eq!(entry.process_name, "PID-4242");
    }

    #[test]
    fn test_parse_netstat_line_skips() {
        let map = std::collections::HashMap::new();
        // 表头 / 非 LISTENING / 列数不足
        assert!(parse_netstat_line("  活动连接", &map).is_none());
        assert!(parse_netstat_line("  Proto  Local Address", &map).is_none());
        assert!(parse_netstat_line("TCP 0.0.0.0:80 0.0.0.0:0 ESTABLISHED 1", &map).is_none());
        assert!(parse_netstat_line("TCP 0.0.0.0:80", &map).is_none());
    }
}
