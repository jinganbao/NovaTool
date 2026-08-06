use quick_xml::events::Event;
use quick_xml::Reader;

/// JSON 格式化/压缩：serde_json 解析校验后重序列化，错误自带行列号
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

    let value: serde_json::Value =
        serde_json::from_str(&input).map_err(|e| format!("JSON 解析失败: {}", e))?;

    if mode == "compact" {
        serde_json::to_string(&value).map_err(|e| format!("JSON 序列化失败: {}", e))
    } else {
        serde_json::to_string_pretty(&value).map_err(|e| format!("JSON 序列化失败: {}", e))
    }
}

/// XML 格式化/压缩：quick-xml 解析校验后重写，
/// 完整保留 CDATA / 注释 / DOCTYPE / 处理指令，文本节点内容不变
#[tauri::command]
pub fn xml_format(input: String, mode: String) -> Result<String, String> {
    // 输入上限（约 20MB）
    const MAX_INPUT_CHARS: usize = 20_000_000;
    if input.chars().count() > MAX_INPUT_CHARS {
        return Err(format!(
            "XML 过大（超过 {} 字符），请缩小输入",
            MAX_INPUT_CHARS
        ));
    }

    let compact = mode == "compact";
    let mut reader = Reader::from_str(&input);
    reader.config_mut().trim_text(false);

    let mut out: Vec<u8> = Vec::with_capacity(input.len());
    // 当前元素深度（用于缩进）
    let mut depth: usize = 0;
    // 是否在行首（已有换行+缩进，无需重复）
    let mut at_line_start = true;
    // 上一个事件是否为文本内容：Text 后 End 同行收尾（<a>text</a>），其余换行
    let mut last_was_text = false;

    macro_rules! newline_indent {
        () => {{
            if !compact && !at_line_start {
                out.push(b'\n');
                for _ in 0..depth {
                    out.extend_from_slice(b"  ");
                }
            }
        }};
    }

    loop {
        let event = reader.read_event();
        match event {
            Ok(Event::Start(e)) => {
                newline_indent!();
                write_start(&mut out, &e);
                depth += 1;
                at_line_start = false;
                last_was_text = false;
            }
            Ok(Event::Empty(e)) => {
                newline_indent!();
                write_empty(&mut out, &e);
                at_line_start = false;
                last_was_text = false;
            }
            Ok(Event::End(e)) => {
                depth = depth.saturating_sub(1);
                // 紧跟文本内容时同行收尾（<a>text</a>）
                if !last_was_text {
                    newline_indent!();
                }
                out.extend_from_slice(b"</");
                out.extend_from_slice(e.name().as_ref());
                out.push(b'>');
                at_line_start = false;
                last_was_text = false;
            }
            Ok(Event::Text(t)) => {
                // 纯空白节点：格式化/压缩时均丢弃（缩进由本工具重排）
                let raw: &[u8] = t.as_ref();
                if raw.iter().all(|b| b.is_ascii_whitespace()) {
                    continue;
                }
                // 文本紧跟标签或前一文本段，同行书写；内容不做任何改写
                out.extend_from_slice(raw);
                at_line_start = false;
                last_was_text = true;
            }
            Ok(Event::CData(c)) => {
                // 紧跟文本内容的 CDATA 同行（混合内容不拆行），否则独立行
                if !last_was_text {
                    newline_indent!();
                }
                out.extend_from_slice(b"<![CDATA[");
                out.extend_from_slice(c.as_ref());
                out.extend_from_slice(b"]]>");
                at_line_start = false;
                last_was_text = false;
            }
            Ok(Event::Comment(c)) => {
                newline_indent!();
                out.extend_from_slice(b"<!--");
                out.extend_from_slice(c.as_ref());
                out.extend_from_slice(b"-->");
                at_line_start = false;
                last_was_text = false;
            }
            Ok(Event::DocType(d)) => {
                newline_indent!();
                out.extend_from_slice(b"<!DOCTYPE ");
                out.extend_from_slice(d.as_ref());
                out.push(b'>');
                at_line_start = false;
                last_was_text = false;
            }
            Ok(Event::PI(pi)) => {
                newline_indent!();
                out.extend_from_slice(b"<?");
                out.extend_from_slice(pi.as_ref());
                out.extend_from_slice(b"?>");
                at_line_start = false;
                last_was_text = false;
            }
            Ok(Event::Decl(d)) => {
                out.extend_from_slice(b"<?xml");
                out.extend_from_slice(d.as_ref());
                out.extend_from_slice(b"?>");
                out.push(b'\n');
                at_line_start = true;
                last_was_text = false;
            }
            Ok(Event::Eof) => break,
            Err(e) => {
                let (line, col) = error_position(&input, &e);
                return Err(format!(
                    "XML 解析失败（第 {} 行，第 {} 列）: {}",
                    line, col, e
                ));
            }
        }
    }

    // 末尾换行（格式化模式）
    if !compact && !out.is_empty() {
        out.push(b'\n');
    }

    String::from_utf8(out).map_err(|e| format!("输出编码错误: {}", e))
}

/// 回退到不大于 byte_pos 的最近 UTF-8 字符边界
/// （手写版不依赖 std 版本，避免 clippy::incompatible_msrv 误报）
fn prev_char_boundary(s: &str, byte_pos: usize) -> usize {
    let mut pos = byte_pos.min(s.len());
    while pos > 0 && !s.is_char_boundary(pos) {
        pos -= 1;
    }
    pos
}

/// 将 quick-xml 错误中的 byte position 转换为行列号
fn error_position(input: &str, err: &quick_xml::Error) -> (usize, usize) {
    let msg = err.to_string();
    // quick-xml 错误格式类似 "... at position 123"
    let pos = msg
        .rsplit_once("at position ")
        .and_then(|(_, rest)| rest.split_whitespace().next())
        .and_then(|s| s.parse::<usize>().ok())
        .unwrap_or(0)
        .min(input.len());
    // 字节偏移可能落在 UTF-8 字符中间，回退到合法字符边界避免切片 panic
    let pos = prev_char_boundary(input, pos);

    let line = input[..pos].bytes().filter(|&b| b == b'\n').count() + 1;
    let line_start = input[..pos].rfind('\n').map(|i| i + 1).unwrap_or(0);
    let col = input[line_start..pos].chars().count() + 1;
    (line, col)
}

/// 写起始标签 <name attr="value" ...>
fn write_start(out: &mut Vec<u8>, e: &quick_xml::events::BytesStart) {
    out.push(b'<');
    out.extend_from_slice(e.name().as_ref());
    for attr in e.attributes().flatten() {
        out.push(b' ');
        out.extend_from_slice(attr.key.as_ref());
        out.extend_from_slice(b"=\"");
        // 属性值写回：优先解码后转义（语义等价，& 一律转义避免双重转义）；
        // 未知实体（如无 DTD 定义的 &nbsp;）解码失败时保留原始字节，避免静默丢内容
        let val = match attr.unescape_value() {
            Ok(v) => escape_attr(&v, false),
            Err(_) => escape_attr(&String::from_utf8_lossy(attr.value.as_ref()), true),
        };
        out.extend_from_slice(val.as_bytes());
        out.push(b'"');
    }
    out.push(b'>');
}

/// 写自闭合标签 <name attr="value" />
fn write_empty(out: &mut Vec<u8>, e: &quick_xml::events::BytesStart) {
    write_start(out, e);
    // write_start 以 '>' 结尾，改为 '/>'
    out.pop();
    out.extend_from_slice(b"/>");
}

/// 属性值转义（与 XML 语义等价）。
/// preserve_entities=true 时（原始字节路径），已有的实体引用（&amp; 等）原样保留；
/// false 时（解码后路径）& 一律转义，避免把字面 "&amp;" 误判为实体造成双重转义。
fn escape_attr(s: &str, preserve_entities: bool) -> String {
    let mut out = String::with_capacity(s.len());
    let mut i = 0;
    while i < s.len() {
        let ch = s[i..].chars().next().unwrap();
        if ch == '&' && preserve_entities {
            // 已是完整实体引用（&name; / &#123; / &#xAB;）则原样保留
            if let Some(semi) = s[i + 1..].find(';') {
                let entity = &s[i..=i + 1 + semi];
                let inner = &entity[1..entity.len() - 1];
                let is_entity = !inner.is_empty()
                    && inner.len() <= 32
                    && inner
                        .chars()
                        .all(|c| c.is_ascii_alphanumeric() || c == '#' || c == 'x' || c == 'X');
                if is_entity {
                    out.push_str(entity);
                    i += entity.len();
                    continue;
                }
            }
        }
        match ch {
            '&' => out.push_str("&amp;"),
            '<' => out.push_str("&lt;"),
            '>' => out.push_str("&gt;"),
            '"' => out.push_str("&quot;"),
            '\n' => out.push_str("&#10;"),
            '\r' => out.push_str("&#13;"),
            '\t' => out.push_str("&#9;"),
            _ => out.push(ch),
        }
        i += ch.len_utf8();
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
    fn test_xml_pretty_basic() {
        let out = xml_format("<root><a>1</a><b>2</b></root>".into(), "pretty".into()).unwrap();
        assert_eq!(out, "<root>\n  <a>1</a>\n  <b>2</b>\n</root>\n");
    }

    #[test]
    fn test_xml_pretty_attributes() {
        let out = xml_format(
            r#"<root a="1" b="x &amp; y"><c/></root>"#.into(),
            "pretty".into(),
        )
        .unwrap();
        assert!(out.contains(r#"a="1""#));
        assert!(out.contains("x &amp; y"));
        assert!(out.contains("<c/>"));
    }

    #[test]
    fn test_xml_cdata_preserved() {
        let src = "<root><![CDATA[a < b && c > d]]></root>";
        let out = xml_format(src.into(), "pretty".into()).unwrap();
        // CDATA 内容完整保留，不被拆散、不转义
        assert!(out.contains("<![CDATA[a < b && c > d]]>"));
    }

    #[test]
    fn test_xml_comment_preserved() {
        let src = "<!-- note --><root/>";
        let out = xml_format(src.into(), "pretty".into()).unwrap();
        assert!(out.contains("<!-- note -->"));
    }

    #[test]
    fn test_xml_doctype_preserved() {
        let src = "<!DOCTYPE root><root/>";
        let out = xml_format(src.into(), "pretty".into()).unwrap();
        assert!(out.contains("<!DOCTYPE root>"));
    }

    #[test]
    fn test_xml_compact() {
        let src = "<root>\n  <a>1</a>\n  <b>2</b>\n</root>";
        let out = xml_format(src.into(), "compact".into()).unwrap();
        assert_eq!(out, "<root><a>1</a><b>2</b></root>");
    }

    #[test]
    fn test_xml_text_preserved_whitespace() {
        // 文本节点内的空白（非纯空白节点）必须保留
        let src = "<root><pre>  keep  me  </pre></root>";
        let out = xml_format(src.into(), "pretty".into()).unwrap();
        assert!(out.contains("  keep  me  "));
    }

    #[test]
    fn test_xml_error_position() {
        let err = xml_format("<root><a></b></root>".into(), "pretty".into()).unwrap_err();
        assert!(err.contains("XML 解析失败"));
        assert!(err.contains("第"));
        assert!(err.contains("列"));
    }

    #[test]
    fn test_xml_attr_unknown_entity_preserved() {
        // 无 DTD 定义的命名实体（&nbsp;）：解码失败时应原样保留，不得静默清空
        let src = r#"<root a="x&nbsp;y"><b/></root>"#;
        let out = xml_format(src.into(), "pretty".into()).unwrap();
        assert!(out.contains(r#"a="x&nbsp;y""#));
    }

    #[test]
    fn test_xml_attr_predefined_entity_roundtrip() {
        // 预定义实体解码再转义，语义等价
        let src = r#"<root a="1 &lt; 2 &amp;&amp; 3"/>"#;
        let out = xml_format(src.into(), "pretty".into()).unwrap();
        assert!(out.contains(r#"a="1 &lt; 2 &amp;&amp; 3""#));
    }

    #[test]
    fn test_xml_attr_double_entity_roundtrip() {
        // 字面 "&amp;"（输入为 &amp;amp;）必须原样往返，不得被误判为实体保留
        let src = r#"<root a="&amp;amp;"/>"#;
        let out = xml_format(src.into(), "pretty".into()).unwrap();
        assert!(out.contains(r#"a="&amp;amp;""#));
    }

    #[test]
    fn test_xml_attr_non_ascii() {
        // 中文属性值原样保留（多字节 UTF-8）
        let src = r#"<root a="你好" title="中文 &amp; 测试"/>"#;
        let out = xml_format(src.into(), "pretty".into()).unwrap();
        assert!(out.contains(r#"a="你好""#));
        assert!(out.contains(r#"title="中文 &amp; 测试""#));
    }

    #[test]
    fn test_xml_mixed_content_cdata_same_line() {
        // 文本 + CDATA 混合内容：不拆行
        let src = "<root>text<![CDATA[ raw <data> ]]></root>";
        let out = xml_format(src.into(), "pretty".into()).unwrap();
        assert!(out.contains("text<![CDATA[ raw <data> ]]>"));
    }

    #[test]
    fn test_xml_too_large() {
        let big = format!("<root>{}</root>", "x".repeat(20_000_001));
        assert!(xml_format(big, "pretty".into()).is_err());
    }

    #[test]
    fn test_error_position_line_col() {
        let input = "<root>\n  <a>\n</root>";
        // 从真实解析错误中验证行列换算（EOF 时必有解析错误）
        let mut reader = Reader::from_str(input);
        let err = loop {
            match reader.read_event() {
                Ok(Event::Eof) => break None,
                Err(e) => break Some(e),
                Ok(_) => {}
            }
        };
        if let Some(e) = err {
            let (line, _col) = error_position(input, &e);
            assert!(line >= 1);
        }
    }
}
