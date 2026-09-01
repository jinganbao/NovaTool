import {
  ArrowLeftRight,
  Binary,
  Braces,
  Clock,
  FileCode2,
  Fingerprint,
  GitCompare,
  Globe,
  Hash,
  KeyRound,
  ListTree,
  Network,
  QrCode,
  Radio,
  RadioReceiver,
  RadioTower,
  Regex,
  SearchCode,
  Server,
  Sparkles,
  TerminalSquare,
  TextCursorInput,
  Wand2,
} from "lucide-vue-next";
import type { ToolGroup, ToolItem } from "@/types/tools";

export const toolGroups: ToolGroup[] = [
  {
    key: "network",
    title: "网络调试",
    icon: Network,
    tools: [
      { key: "http-client", title: "HTTP 请求", desc: "请求、响应与接口调试", icon: Globe, status: "ready" },
      { key: "tcp-client", title: "TCP 客户端", desc: "连接、发送、查看响应", icon: RadioReceiver, status: "ready" },
      { key: "udp-client", title: "UDP 客户端", desc: "数据报发送与响应调试", icon: RadioTower, status: "ready" },
      { key: "tcp-server", title: "TCP 服务端", desc: "监听端口、收发日志", icon: Server, status: "ready" },
      { key: "port-check", title: "端口检查", desc: "查看占用端口、终止进程", icon: Radio, status: "ready" },
    ],
  },
  {
    key: "format",
    title: "文本与格式化",
    icon: FileCode2,
    tools: [
      { key: "data-query", title: "JSONPath / XPath", desc: "结构化数据查询与定位", icon: SearchCode, status: "ready" },
      { key: "json-format", title: "JSON 格式化", desc: "校验、美化或压缩 JSON", icon: Braces, status: "ready" },
      { key: "xml-format", title: "XML 格式化", desc: "快速整理 XML 层级", icon: ListTree, status: "ready" },
      { key: "text-diff", title: "文本比较", desc: "逐行对比，高亮差异", icon: GitCompare, status: "ready" },
      { key: "regex", title: "正则测试", desc: "正则匹配、高亮、替换", icon: Regex, status: "ready" },
    ],
  },
  {
    key: "encode",
    title: "编码转换",
    icon: TextCursorInput,
    tools: [
      { key: "url-codec", title: "URL 编解码", desc: "URI、参数值与表单编码", icon: Wand2, status: "ready" },
      { key: "timestamp", title: "时间戳转换", desc: "Epoch 多精度、日期与时区转换", icon: TerminalSquare, status: "ready" },
      { key: "base64", title: "Base64 编解码", desc: "标准 Base64 与 Base64URL", icon: Binary, status: "ready" },
      { key: "radix", title: "进制转换", desc: "任意精度二/八/十/十六进制", icon: ArrowLeftRight, status: "ready" },
      { key: "hash", title: "哈希计算", desc: "WebAssembly MD5 · SHA · SM3", icon: Hash, status: "ready" },
    ],
  },
  {
    key: "generate",
    title: "生成器",
    icon: Sparkles,
    tools: [
      { key: "password", title: "密码生成", desc: "可配置长度与字符集", icon: KeyRound, status: "ready" },
      { key: "cron", title: "Cron 表达式", desc: "Quartz 6/7 字段生成、解析与运行时间", icon: Clock, status: "ready" },
      { key: "qrcode", title: "二维码生成", desc: "文本/URL 转二维码，支持下载", icon: QrCode, status: "ready" },
      { key: "uuid", title: "UUID 生成", desc: "v4/v7/NIL，批量生成", icon: Fingerprint, status: "ready" },
    ],
  },
];

export const allTools: ToolItem[] = toolGroups.flatMap((group) => group.tools);
