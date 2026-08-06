use serde::Serialize;
use similar::{DiffOp, TextDiff};

#[derive(Serialize, Debug)]
pub struct LineMark {
    pub from: usize,
    pub to: usize,
    #[serde(rename = "type")]
    pub mark_type: String,
}

/// 字符级标记（1-based 行号，0-based [from, to) UTF-16 偏移，与 CodeMirror 对齐）
#[derive(Serialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct CharMark {
    pub line: usize,
    pub from: usize,
    pub to: usize,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TextDiffResult {
    pub left_marks: Vec<LineMark>,
    pub right_marks: Vec<LineMark>,
    pub left_char_marks: Vec<CharMark>,
    pub right_char_marks: Vec<CharMark>,
}

/// 字符索引转 UTF-16 code unit 偏移（CodeMirror 位置按 UTF-16 计）
fn char_idx_to_utf16(s: &str, char_idx: usize) -> usize {
    s.chars().take(char_idx).map(|c| c.len_utf16()).sum()
}

/// 计算左右文本的差异：行级标记 + 对 changed 行对做字符级标记
/// 返回标记位置（行号 1-based；字符区间 0-based [from, to) UTF-16 偏移）
#[tauri::command]
pub fn text_diff(left: String, right: String) -> Result<TextDiffResult, String> {
    // 输入大小限制（单侧 1MB），防止超大输入导致 O(n·d) 最坏 O(n²) 计算卡死
    const MAX_INPUT_CHARS: usize = 1_000_000;
    if left.chars().count() > MAX_INPUT_CHARS || right.chars().count() > MAX_INPUT_CHARS {
        return Err(format!(
            "文本过大（单侧上限 {} 字符），请缩小对比范围",
            MAX_INPUT_CHARS
        ));
    }

    let diff = TextDiff::from_lines(&left, &right);
    let changes: Vec<_> = diff.iter_all_changes().collect();

    let mut left_marks: Vec<LineMark> = Vec::new();
    let mut right_marks: Vec<LineMark> = Vec::new();
    // changed 行对（1-based 左行号, 右行号），供字符级 diff 使用
    let mut char_pairs: Vec<(usize, usize)> = Vec::new();
    let mut i = 0;

    while i < changes.len() {
        let ch = &changes[i];
        match ch.tag() {
            similar::ChangeTag::Delete => {
                let del_lines = ch.value().lines().count();
                let del_start = ch.old_index().unwrap_or(0) + 1;
                let del_end = del_start + del_lines.saturating_sub(1);

                if i + 1 < changes.len() && changes[i + 1].tag() == similar::ChangeTag::Insert {
                    let ins = &changes[i + 1];
                    let ins_lines = ins.value().lines().count();
                    let ins_start = ins.new_index().unwrap_or(0) + 1;
                    let ins_end = ins_start + ins_lines.saturating_sub(1);

                    left_marks.push(LineMark {
                        from: del_start,
                        to: del_end,
                        mark_type: "changed".into(),
                    });
                    right_marks.push(LineMark {
                        from: ins_start,
                        to: ins_end,
                        mark_type: "changed".into(),
                    });
                    // 收集行对（与行级标记同一次遍历，天然对齐，不会错位）
                    let pairs = del_lines.min(ins_lines);
                    for k in 0..pairs {
                        char_pairs.push((del_start + k, ins_start + k));
                    }
                    i += 2;
                } else {
                    left_marks.push(LineMark {
                        from: del_start,
                        to: del_end,
                        mark_type: "removed".into(),
                    });
                    i += 1;
                }
            }
            similar::ChangeTag::Insert => {
                let ins_lines = ch.value().lines().count();
                let ins_start = ch.new_index().unwrap_or(0) + 1;
                let ins_end = ins_start + ins_lines.saturating_sub(1);
                right_marks.push(LineMark {
                    from: ins_start,
                    to: ins_end,
                    mark_type: "added".into(),
                });
                i += 1;
            }
            similar::ChangeTag::Equal => {
                i += 1;
            }
        }
    }

    // ---- 字符级 diff：对行级遍历收集的 changed 行对逐对计算 ----
    // 单行字符 diff 上限：超过则跳过字符级高亮（行级标记仍有），防极端行卡死
    const MAX_CHAR_DIFF_LINE: usize = 65_536;

    let left_lines: Vec<&str> = left.split('\n').collect();
    let right_lines: Vec<&str> = right.split('\n').collect();
    let mut left_char_marks: Vec<CharMark> = Vec::new();
    let mut right_char_marks: Vec<CharMark> = Vec::new();

    for (li, ri) in char_pairs {
        let a = left_lines.get(li - 1).copied().unwrap_or("");
        let b = right_lines.get(ri - 1).copied().unwrap_or("");
        if a == b
            || a.chars().count() > MAX_CHAR_DIFF_LINE
            || b.chars().count() > MAX_CHAR_DIFF_LINE
        {
            continue;
        }

        let cd = TextDiff::from_chars(a, b);
        for cop in cd.ops() {
            match cop {
                DiffOp::Delete {
                    old_index: oi,
                    old_len: ol,
                    ..
                } => {
                    left_char_marks.push(CharMark {
                        line: li,
                        from: char_idx_to_utf16(a, *oi),
                        to: char_idx_to_utf16(a, oi + ol),
                    });
                }
                DiffOp::Insert {
                    new_index: ni,
                    new_len: nl,
                    ..
                } => {
                    right_char_marks.push(CharMark {
                        line: ri,
                        from: char_idx_to_utf16(b, *ni),
                        to: char_idx_to_utf16(b, ni + nl),
                    });
                }
                DiffOp::Replace {
                    old_index: oi,
                    old_len: ol,
                    new_index: ni,
                    new_len: nl,
                } => {
                    left_char_marks.push(CharMark {
                        line: li,
                        from: char_idx_to_utf16(a, *oi),
                        to: char_idx_to_utf16(a, oi + ol),
                    });
                    right_char_marks.push(CharMark {
                        line: ri,
                        from: char_idx_to_utf16(b, *ni),
                        to: char_idx_to_utf16(b, ni + nl),
                    });
                }
                _ => {}
            }
        }
    }

    Ok(TextDiffResult {
        left_marks,
        right_marks,
        left_char_marks,
        right_char_marks,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_char_idx_to_utf16_ascii() {
        assert_eq!(char_idx_to_utf16("hello", 3), 3);
        assert_eq!(char_idx_to_utf16("hello", 0), 0);
    }

    #[test]
    fn test_char_idx_to_utf16_cjk() {
        // CJK 基本区字符在 UTF-16 中占 1 个 code unit（与 JS string 一致）
        assert_eq!(char_idx_to_utf16("你好abc", 2), 2);
        assert_eq!(char_idx_to_utf16("你好abc", 5), 5);
    }

    #[test]
    fn test_char_idx_to_utf16_emoji() {
        // emoji（U+1F600）占 2 个 UTF-16 code unit
        assert_eq!(char_idx_to_utf16("a😀b", 2), 3);
    }

    #[test]
    fn test_text_diff_line_marks() {
        let result = text_diff("a\nb\nc".into(), "a\nx\nc".into()).unwrap();
        // 第二行 changed：左右各一个 changed 标记
        assert_eq!(result.left_marks.len(), 1);
        assert_eq!(result.left_marks[0].mark_type, "changed");
        assert_eq!(result.left_marks[0].from, 2);
        assert_eq!(result.left_marks[0].to, 2);
        assert_eq!(result.right_marks.len(), 1);
        assert_eq!(result.right_marks[0].from, 2);
    }

    #[test]
    fn test_text_diff_char_marks() {
        let result = text_diff("a\nhello world\nc".into(), "a\nhello there\nc".into()).unwrap();
        // 第二行 changed，字符级标记非空且完整覆盖 "world" -> "there" 变化区域 [6, 11)
        assert!(!result.left_char_marks.is_empty());
        assert!(!result.right_char_marks.is_empty());
        for m in result
            .left_char_marks
            .iter()
            .chain(result.right_char_marks.iter())
        {
            assert_eq!(m.line, 2);
        }
        assert_eq!(result.left_char_marks.iter().map(|m| m.from).min(), Some(6));
        assert_eq!(result.left_char_marks.iter().map(|m| m.to).max(), Some(11));
        assert_eq!(
            result.right_char_marks.iter().map(|m| m.from).min(),
            Some(6)
        );
        assert_eq!(result.right_char_marks.iter().map(|m| m.to).max(), Some(11));
    }

    #[test]
    fn test_text_diff_char_marks_cjk_utf16() {
        let result = text_diff("a\n你好世界\nc".into(), "a\n你好火星\nc".into()).unwrap();
        // 世界 -> 火星：字符偏移 2..4，UTF-16 偏移同样是 2..4（CJK 占 1 个 code unit）
        assert_eq!(result.left_char_marks.len(), 1);
        assert_eq!(result.left_char_marks[0].from, 2);
        assert_eq!(result.left_char_marks[0].to, 4);
        assert_eq!(result.right_char_marks[0].from, 2);
        assert_eq!(result.right_char_marks[0].to, 4);
    }

    #[test]
    fn test_text_diff_identical() {
        let result = text_diff("same\ncontent".into(), "same\ncontent".into()).unwrap();
        assert!(result.left_marks.is_empty());
        assert!(result.right_marks.is_empty());
        assert!(result.left_char_marks.is_empty());
        assert!(result.right_char_marks.is_empty());
    }

    #[test]
    fn test_text_diff_too_large() {
        let big = "x".repeat(1_000_001);
        assert!(text_diff(big.clone(), "y".into()).is_err());
        assert!(text_diff("y".into(), big).is_err());
    }

    #[test]
    fn test_text_diff_removed_added() {
        // 左侧多一行、右侧多一行：应产生 removed / added 标记
        let result = text_diff("a\nb\nc".into(), "a\nc\nd".into()).unwrap();
        assert!(result.left_marks.iter().any(|m| m.mark_type == "removed"));
        assert!(result.right_marks.iter().any(|m| m.mark_type == "added"));
        assert!(result.left_marks.iter().all(|m| m.mark_type != "added"));
        assert!(result.right_marks.iter().all(|m| m.mark_type != "removed"));
        // removed/added 不生成字符级标记
        assert!(result.left_char_marks.is_empty());
        assert!(result.right_char_marks.is_empty());
    }
}
