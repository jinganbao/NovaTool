use serde::Serialize;
use similar::{ChangeTag, TextDiff};

#[derive(Serialize)]
pub struct LineMark {
    pub from: usize,
    pub to: usize,
    #[serde(rename = "type")]
    pub mark_type: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TextDiffResult {
    pub left_marks: Vec<LineMark>,
    pub right_marks: Vec<LineMark>,
}

/// 计算左右文本的行级差异，返回标记位置（1-based 行号）
#[tauri::command]
pub fn text_diff(left: String, right: String) -> TextDiffResult {
    let diff = TextDiff::from_lines(&left, &right);
    let changes: Vec<_> = diff.iter_all_changes().collect();

    let mut left_marks: Vec<LineMark> = Vec::new();
    let mut right_marks: Vec<LineMark> = Vec::new();
    let mut i = 0;

    while i < changes.len() {
        let ch = &changes[i];
        match ch.tag() {
            ChangeTag::Delete => {
                let del_lines = ch.value().lines().count();
                let del_start = ch.old_index().unwrap_or(0) + 1;
                let del_end = del_start + del_lines.saturating_sub(1);

                if i + 1 < changes.len() && changes[i + 1].tag() == ChangeTag::Insert {
                    let ins = &changes[i + 1];
                    let ins_lines = ins.value().lines().count();
                    let ins_start = ins.new_index().unwrap_or(0) + 1;
                    let ins_end = ins_start + ins_lines.saturating_sub(1);

                    left_marks.push(LineMark { from: del_start, to: del_end, mark_type: "changed".into() });
                    right_marks.push(LineMark { from: ins_start, to: ins_end, mark_type: "changed".into() });
                    i += 2;
                } else {
                    left_marks.push(LineMark { from: del_start, to: del_end, mark_type: "removed".into() });
                    i += 1;
                }
            }
            ChangeTag::Insert => {
                let ins_lines = ch.value().lines().count();
                let ins_start = ch.new_index().unwrap_or(0) + 1;
                let ins_end = ins_start + ins_lines.saturating_sub(1);
                right_marks.push(LineMark { from: ins_start, to: ins_end, mark_type: "added".into() });
                i += 1;
            }
            ChangeTag::Equal => {
                i += 1;
            }
        }
    }

    TextDiffResult { left_marks, right_marks }
}
