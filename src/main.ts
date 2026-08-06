import { createApp } from "vue";
import { attachConsole } from "@tauri-apps/plugin-log";
import App from "./App.vue";

// 前端 console 转发到后端日志（stdout + 日志文件），排障时可见
void attachConsole();

// 全局错误捕获：未捕获异常 / Promise 拒绝 / 组件错误不再静默丢失
window.addEventListener("error", (event) => {
  console.error("[uncaught]", event.error ?? event.message, event.filename, event.lineno);
});
window.addEventListener("unhandledrejection", (event) => {
  console.error("[unhandledrejection]", event.reason);
});

const app = createApp(App);
app.config.errorHandler = (err, _instance, info) => {
  console.error("[vue-error]", err, info);
};
app.mount("#app");
