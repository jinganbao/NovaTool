import { createApp } from "vue";
import { attachConsole } from "@tauri-apps/plugin-log";
import { isTauri } from "@tauri-apps/api/core";
import VueCodemirror from "vue-codemirror";
import App from "./App.vue";

// 前端 console 转发到后端日志（stdout + 日志文件），排障时可见
if (isTauri()) void attachConsole();

// 全局错误捕获：未捕获异常 / Promise 拒绝 / 组件错误不再静默丢失
window.addEventListener("error", (event) => {
  console.error("[uncaught]", event.error ?? event.message, event.filename, event.lineno);
});
window.addEventListener("unhandledrejection", (event) => {
  console.error("[unhandledrejection]", event.reason);
});

const app = createApp(App);
// CodeEditor 统一管理扩展，避免默认 basicSetup 重复注册 gutter 和快捷键。
app.use(VueCodemirror, { extensions: [] });
app.config.errorHandler = (err, _instance, info) => {
  console.error("[vue-error]", err, info);
};
app.mount("#app");
