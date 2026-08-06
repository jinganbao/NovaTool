//! 系统菜单栏（全部中文，macOS 显示在系统菜单栏，Windows/Linux 显示在窗口顶部）
//!
//! - 应用菜单：关于 / 检查更新 / 隐藏 / 退出（Cmd+Q）
//! - 编辑 / 视图 / 窗口：系统预定义项（保留输入快捷键）
//! - 帮助：使用文档 / 项目主页 / 报告问题 / 开源许可证（系统 open）

use tauri::menu::{IsMenuItem, Menu, MenuItem, PredefinedMenuItem, Submenu};
use tauri::{AppHandle, Emitter};

pub const REPO_URL: &str = "https://github.com/jinganbao/NovaTool";
pub const DOCS_URL: &str = "https://github.com/jinganbao/NovaTool#readme";
pub const ISSUE_URL: &str = "https://github.com/jinganbao/NovaTool/issues";

/// 构建全中文菜单并挂载到应用
pub fn build_menu(app: &AppHandle) -> tauri::Result<()> {
    // ---- 应用菜单 ----
    let about = MenuItem::with_id(app, "about", "关于 NovaTool…", true, None::<&str>)?;
    let check_update = MenuItem::with_id(app, "check-update", "检查更新…", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "退出 NovaTool", true, Some("Cmd+Q"))?;
    let sep1 = PredefinedMenuItem::separator(app)?;
    #[cfg(target_os = "macos")]
    let sep2 = PredefinedMenuItem::separator(app)?;

    // 「隐藏」系列依赖 macOS Dock 恢复窗口，Windows/Linux 隐藏后无法找回，故仅 macOS 提供
    #[cfg(target_os = "macos")]
    let hide_item = PredefinedMenuItem::hide(app, Some("隐藏 NovaTool"))?;
    #[cfg(target_os = "macos")]
    let hide_others_item = PredefinedMenuItem::hide_others(app, Some("隐藏其他"))?;
    #[cfg(target_os = "macos")]
    let show_all_item = PredefinedMenuItem::show_all(app, Some("显示全部"))?;

    #[cfg(target_os = "macos")]
    let app_items: Vec<&dyn IsMenuItem<tauri::Wry>> = vec![
        &about,
        &check_update,
        &sep1,
        &hide_item,
        &hide_others_item,
        &show_all_item,
        &sep2,
        &quit,
    ];
    #[cfg(not(target_os = "macos"))]
    let app_items: Vec<&dyn IsMenuItem<tauri::Wry>> = vec![&about, &check_update, &sep1, &quit];

    let app_menu = Submenu::with_items(app, "NovaTool", true, &app_items)?;

    // ---- 编辑菜单（保留输入快捷键）----
    let edit_menu = Submenu::with_items(
        app,
        "编辑",
        true,
        &[
            &PredefinedMenuItem::undo(app, Some("撤销"))?,
            &PredefinedMenuItem::redo(app, Some("重做"))?,
            &PredefinedMenuItem::separator(app)?,
            &PredefinedMenuItem::cut(app, Some("剪切"))?,
            &PredefinedMenuItem::copy(app, Some("拷贝"))?,
            &PredefinedMenuItem::paste(app, Some("粘贴"))?,
            &PredefinedMenuItem::select_all(app, Some("全选"))?,
        ],
    )?;

    // ---- 视图菜单 ----
    let view_menu = Submenu::with_items(
        app,
        "视图",
        true,
        &[&PredefinedMenuItem::fullscreen(app, Some("进入全屏"))?],
    )?;

    // ---- 窗口菜单 ----
    let window_menu = Submenu::with_items(
        app,
        "窗口",
        true,
        &[
            &PredefinedMenuItem::minimize(app, Some("最小化"))?,
            &PredefinedMenuItem::close_window(app, Some("关闭窗口"))?,
        ],
    )?;

    // ---- 帮助菜单 ----
    let docs = MenuItem::with_id(app, "docs", "使用文档", true, None::<&str>)?;
    let homepage = MenuItem::with_id(app, "homepage", "项目主页", true, None::<&str>)?;
    let issue = MenuItem::with_id(app, "issue", "报告问题", true, None::<&str>)?;
    let license = MenuItem::with_id(app, "license", "开源许可证", true, None::<&str>)?;
    let help_menu = Submenu::with_items(app, "帮助", true, &[&docs, &homepage, &issue, &license])?;

    let menu = Menu::with_items(
        app,
        &[&app_menu, &edit_menu, &view_menu, &window_menu, &help_menu],
    )?;
    app.set_menu(menu)?;
    Ok(())
}

/// 菜单事件分发：应用内事件走 emit 交给前端，链接走系统 open
pub fn handle_menu_event(app: &AppHandle, id: &str) {
    match id {
        "about" => {
            let _ = app.emit("novatool-about", ());
        }
        "check-update" => {
            let _ = app.emit("novatool-check-update", ());
        }
        "quit" => app.exit(0),
        "docs" => open_url_sys(DOCS_URL),
        "homepage" => open_url_sys(REPO_URL),
        "issue" => open_url_sys(ISSUE_URL),
        "license" => open_url_sys(&format!("{}/blob/main/LICENSE", REPO_URL)),
        _ => {}
    }
}

/// 用系统默认浏览器打开链接（macOS open / Linux xdg-open / Windows start）
pub fn open_url_sys(url: &str) {
    #[cfg(target_os = "macos")]
    let _ = std::process::Command::new("open").arg(url).spawn();
    #[cfg(target_os = "linux")]
    let _ = std::process::Command::new("xdg-open").arg(url).spawn();
    #[cfg(target_os = "windows")]
    let _ = std::process::Command::new("cmd")
        .args(["/C", "start", "", url])
        .spawn();
}

/// 前端按钮打开外部链接（仅允许 http/https，防止协议注入）
#[tauri::command]
pub fn open_url(url: String) -> Result<(), String> {
    if !(url.starts_with("https://") || url.starts_with("http://")) {
        return Err("仅支持 http/https 链接".into());
    }
    open_url_sys(&url);
    Ok(())
}
