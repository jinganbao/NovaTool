/// JSON 格式化/压缩：serde_json 解析校验后重序列化，错误自带行列号。
/// 对带转义符的输入做智能容错（详见 [`parse_json_smart`]）。
#[tauri::command]
pub fn json_format(input: String, mode: String) -> Result<String, String> {
    // 输入上限（约 20MB），防止超大 JSON 撑爆内存
    const MAX_INPUT_CHARS: usize = 20_000_000;
    if input.chars().count() > MAX_INPUT_CHARS {
        return Err(format!(
            "JSON 过大（超过 {} 字符），请缩小输入",
            MAX_INPUT_CHARS
        ));
    }

    let value = parse_json_smart(&input)?;

    if mode == "compact" {
        serde_json::to_string(&value).map_err(|e| format!("JSON 序列化失败: {}", e))
    } else {
        serde_json::to_string_pretty(&value).map_err(|e| format!("JSON 序列化失败: {}", e))
    }
}

/// 智能解析 JSON，兼容两类常见带转义符的输入：
/// 1. 整体是 JSON 字符串字面量且内容本身是 JSON 对象/数组（如 `"{\"a\":1}"`，
///    从代码/日志复制的）→ 展开为真实对象/数组再格式化；
/// 2. 字符串外的裸转义引号（如 `{\"a\":1}`）→ 还原 `\"`/`\\` 后重新解析。
///
/// 其余情况保持原行为；解析失败时报原始输入的错误（自带行列号）。
fn parse_json_smart(input: &str) -> Result<serde_json::Value, String> {
    let value = serde_json::from_str::<serde_json::Value>(input).or_else(|_| {
        // 裸转义还原后重试
        let unescaped = unescape_escaped_json(input);
        if unescaped != input {
            serde_json::from_str::<serde_json::Value>(&unescaped)
        } else {
            // 复用原始错误（serde_json::Error 非 Clone，手动构造一次）
            serde_json::from_str::<serde_json::Value>(input)
        }
    });
    let value = value.map_err(|e| format!("JSON 解析失败: {}", e))?;

    // 解析结果是单个字符串且内容本身是 JSON 对象/数组 → 展开一层
    if let serde_json::Value::String(s) = &value {
        let t = s.trim_start();
        if t.starts_with('{') || t.starts_with('[') {
            if let Ok(inner) = serde_json::from_str::<serde_json::Value>(t) {
                return Ok(inner);
            }
        }
    }
    Ok(value)
}

/// 还原转义残渣：把 `\"` → `"`、`\\` → `\`（对应 C/Java/JS 源码字符串中
/// 复制出来的 JSON），其余转义序列（`\n` `\t` `\uXXXX` 等）原样保留，
/// 交由 serde_json 按标准语义解析。
fn unescape_escaped_json(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    let mut iter = s.chars().peekable();
    while let Some(c) = iter.next() {
        if c == '\\' {
            match iter.peek() {
                Some('"') | Some('\\') => out.push(iter.next().unwrap()),
                _ => out.push('\\'),
            }
        } else {
            out.push(c);
        }
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_json_pretty() {
        let out = json_format(r#"{"a":1,"b":[1,2]}"#.into(), "pretty".into()).unwrap();
        assert!(out.contains("\n  \"a\": 1"));
    }

    #[test]
    fn test_json_compact() {
        let out = json_format("{ \"a\" : 1 }".into(), "compact".into()).unwrap();
        assert_eq!(out, r#"{"a":1}"#);
    }

    #[test]
    fn test_json_error_has_position() {
        let err = json_format(r#"{"a":1,}"#.into(), "pretty".into()).unwrap_err();
        assert!(err.contains("JSON 解析失败"));
        // serde_json 错误包含行列号
        assert!(err.contains("line") || err.contains("column"));
    }

    #[test]
    fn test_json_too_large() {
        let big = format!("[{}]", "1,".repeat(10_000_000));
        assert!(json_format(big, "pretty".into()).is_err());
    }

    #[test]
    fn test_json_wrapped_escaped_string_expanded() {
        // 整体是带转义的 JSON 字符串字面量（从代码/日志复制）→ 展开为对象
        let src = r#""{\"code\":0,\"name\":\"tom\"}""#;
        let out = json_format(src.into(), "pretty".into()).unwrap();
        assert!(out.contains("\"code\": 0"));
        assert!(out.contains("\"name\": \"tom\""));
        assert!(!out.contains("\\\""));
    }

    #[test]
    fn test_json_wrapped_escaped_string_expanded_compact() {
        let src = r#""{\"a\":[1,2]}""#;
        let out = json_format(src.into(), "compact".into()).unwrap();
        assert_eq!(out, r#"{"a":[1,2]}"#);
    }

    #[test]
    fn test_json_bare_escaped_quotes_recovered() {
        // 字符串外的裸转义引号 → 还原后格式化
        let src = r#"{\"code\":0,\"name\":\"tom\"}"#;
        let out = json_format(src.into(), "pretty".into()).unwrap();
        assert!(out.contains("\"code\": 0"));
        assert!(out.contains("\"name\": \"tom\""));
    }

    #[test]
    fn test_json_bare_escaped_nested_quotes() {
        // 裸转义外壳 + 值内转义引号（C/Java 源码复制场景）→ 语义保持
        let src = r#"{\"a\":\"x\\\"y\"}"#;
        let out = json_format(src.into(), "pretty".into()).unwrap();
        assert!(out.contains("\"x\\\"y\""));
    }

    #[test]
    fn test_json_wrapped_non_json_string_kept() {
        // 字符串内容不是 JSON → 保持原样
        let out = json_format(r#""hello""#.into(), "pretty".into()).unwrap();
        assert_eq!(out, "\"hello\"");
    }

    #[test]
    fn test_json_string_value_with_escaped_quote_kept() {
        // 合法 JSON 的字符串值内含转义引号 → 语义保持，不误还原
        let src = r#"{"a":"x\"y"}"#;
        let out = json_format(src.into(), "pretty".into()).unwrap();
        assert!(out.contains("\"x\\\"y\""));
    }

    #[test]
    fn test_json_escaped_unicode_kept() {
        // 字符串值中的 \uXXXX 与 \n 转义按标准语义解析
        let src = r#"{"u":"\u4e2d\u6587","n":"a\nb"}"#;
        let out = json_format(src.into(), "pretty".into()).unwrap();
        assert!(out.contains("中文"));
        assert!(out.contains("\"a\\nb\""));
    }

    #[test]
    fn test_json_bare_escaped_still_invalid_reports_original() {
        // 还原后仍非法 → 报错，且错误基于原始输入
        let src = r#"{\"a\":1,}"#;
        let err = json_format(src.into(), "pretty".into()).unwrap_err();
        assert!(err.contains("JSON 解析失败"));
    }

    #[test]
    fn test_json_plain_string_unchanged() {
        // 普通字符串（内部不是 JSON）不受影响
        let src = r#"{"a":1}"#;
        let out = json_format(src.into(), "pretty".into()).unwrap();
        assert!(out.contains("\"a\": 1"));
    }

    #[test]
    fn test_json_literal_escapes_in_valid_json_are_preserved() {
        // 合法 JSON 中的字面反斜杠属于业务数据，格式化不得额外解码一层。
        let src = r#"{"msg":"hello\\nworld","u":"\\u4e2d\\u6587"}"#;
        let out = json_format(src.into(), "pretty".into()).unwrap();
        let value: serde_json::Value = serde_json::from_str(&out).unwrap();
        assert_eq!(value["msg"], "hello\\nworld");
        assert_eq!(value["u"], "\\u4e2d\\u6587");
    }

    #[test]
    fn test_json_wrapped_with_literal_escapes() {
        // 整体转义字符串（C/Java 源码复制）只展开明确的外层字符串。
        let src = r#""{\"msg\":\"hello\\nworld\",\"u\":\"\\u4e2d\\u6587\"}""#;
        let out = json_format(src.into(), "pretty".into()).unwrap();
        assert!(out.contains("\"msg\": \"hello\\nworld\""));
        assert!(out.contains("\"u\": \"中文\""));
    }

    #[test]
    fn test_json_bare_quote_value_kept() {
        // 值含真实引号（serde 已解码）→ 不应被再次解码破坏
        let src = r#"{"a":"x\"y"}"#;
        let out = json_format(src.into(), "pretty".into()).unwrap();
        assert!(out.contains("\"x\\\"y\""));
    }

    #[test]
    fn test_json_windows_path_and_regex_are_preserved() {
        let src = r#"{"path":"C:\\temp\\new","regex":"\\d+\\s"}"#;
        let out = json_format(src.into(), "compact".into()).unwrap();
        let value: serde_json::Value = serde_json::from_str(&out).unwrap();
        assert_eq!(value["path"], r"C:\temp\new");
        assert_eq!(value["regex"], r"\d+\s");
    }

    #[test]
    fn test_json_literal_unicode_compact_is_preserved() {
        let src = r#"{"u":"\\u4e2d"}"#;
        let out = json_format(src.into(), "compact".into()).unwrap();
        assert_eq!(out, r#"{"u":"\\u4e2d"}"#);
    }
}
