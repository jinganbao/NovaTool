import { h, type Component } from "vue";

/**
 * 渲染 lucide 图标为 naive-ui render-icon 格式
 */
export function renderIcon(icon: Component, size = 14) {
  return h(icon, { size, strokeWidth: 2.1 });
}
