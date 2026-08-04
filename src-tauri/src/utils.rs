/// 通用小工具函数

pub(crate) fn decode_hex(input: &str) -> Result<Vec<u8>, String> {
    let clean: String = input.chars().filter(|c| !c.is_whitespace()).collect();
    if clean.len() % 2 != 0 {
        return Err("HEX 内容长度必须是偶数".to_string());
    }
    let mut bytes = Vec::with_capacity(clean.len() / 2);
    for i in (0..clean.len()).step_by(2) {
        let part = &clean[i..i + 2];
        let byte = u8::from_str_radix(part, 16).map_err(|_| format!("非法 HEX 字节: {}", part))?;
        bytes.push(byte);
    }
    Ok(bytes)
}

pub(crate) fn encode_hex(bytes: &[u8]) -> String {
    bytes
        .iter()
        .map(|byte| format!("{:02X}", byte))
        .collect::<Vec<_>>()
        .join(" ")
}
