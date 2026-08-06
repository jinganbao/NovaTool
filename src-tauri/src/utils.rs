/// 通用小工具函数
///
/// HEX 输入上限（1MB 字符 ≈ 512KB 字节），防止超大输入耗尽内存
const MAX_HEX_INPUT_LEN: usize = 1_000_000;

pub(crate) fn decode_hex(input: &str) -> Result<Vec<u8>, String> {
    let clean: String = input.chars().filter(|c| !c.is_whitespace()).collect();
    if clean.len() > MAX_HEX_INPUT_LEN {
        return Err(format!(
            "HEX 内容过大（超过 {} 字符），已拒绝处理",
            MAX_HEX_INPUT_LEN
        ));
    }
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_decode_hex_basic() {
        assert_eq!(decode_hex("48656C6C6F").unwrap(), b"Hello");
        // 允许空白分隔
        assert_eq!(decode_hex("48 65 6C 6C 6F").unwrap(), b"Hello");
        assert_eq!(decode_hex("48\n65\t6C").unwrap(), b"Hel");
        // 小写
        assert_eq!(
            decode_hex("deadbeef").unwrap(),
            vec![0xde, 0xad, 0xbe, 0xef]
        );
    }

    #[test]
    fn test_decode_hex_errors() {
        // 奇数长度
        assert!(decode_hex("ABC").is_err());
        // 非法字符
        assert!(decode_hex("4G").is_err());
        // 空输入 -> 空结果
        assert_eq!(decode_hex("").unwrap(), Vec::<u8>::new());
    }

    #[test]
    fn test_decode_hex_too_large() {
        let big = "AB".repeat(600_000); // 120 万字符 > 100 万上限
        assert!(decode_hex(&big).is_err());
    }

    #[test]
    fn test_encode_hex() {
        assert_eq!(encode_hex(b"Hello"), "48 65 6C 6C 6F");
        assert_eq!(encode_hex(&[]), "");
        assert_eq!(encode_hex(&[0x00, 0xff]), "00 FF");
    }

    #[test]
    fn test_roundtrip() {
        let data = b"Tauri \xF0\x9F\x9A\x80 binary \x00\xff";
        assert_eq!(decode_hex(&encode_hex(data)).unwrap(), data);
    }
}
