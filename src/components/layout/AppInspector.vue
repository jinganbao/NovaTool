<script setup lang="ts">
import { Clipboard, Sparkles } from "lucide-vue-next";
import { brandColor } from "@/config/theme";
import { toolGroups } from "@/config/tools";
import type { ToolKey } from "@/types/tools";

const props = defineProps<{ activeTool: ToolKey }>();
const emit = defineEmits<{ action: ["format" | "copy"] }>();

function activeGroupTitle() {
  return toolGroups.find((group) => group.tools.some((tool) => tool.key === props.activeTool))?.title ?? "-";
}
</script>

<template>
  <aside class="inspector">
    <section>
      <div class="section-title">工具状态</div>
      <div class="status-grid">
        <div><span>分类</span><strong>{{ activeGroupTitle() }}</strong></div>
        <div><span>主色</span><strong>{{ brandColor }}</strong></div>
      </div>
    </section>
    <section>
      <div class="section-title">常用动作</div>
      <button class="quick-action" @click="emit('action', 'format')">
        <Sparkles :size="16" />
        <span>格式化当前内容</span>
      </button>
      <button class="quick-action" @click="emit('action', 'copy')">
        <Clipboard :size="16" />
        <span>复制结果</span>
      </button>
    </section>
    <section>
      <div class="section-title">扩展入口</div>
      <div class="mini-list">
        <span>Base64</span>
        <span>JWT 解析</span>
        <span>正则测试</span>
        <span>Hash 计算</span>
        <span>UUID 生成</span>
      </div>
    </section>
  </aside>
</template>

<style scoped>
.inspector {
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 18px;
  border-left: 1px solid var(--border-subtle);
  background: var(--bg-sider);
  padding: 22px 14px;
  overflow-y: auto;
}

.section-title {
  color: var(--text-muted);
  font-size: 12px;
  font-weight: 700;
  margin-bottom: 10px;
}

.status-grid {
  display: grid;
  gap: 8px;
}

.status-grid div {
  border: 1px solid var(--border-subtle);
  border-radius: 6px;
  background: var(--bg-panel);
  padding: 10px;
}

.status-grid span {
  display: block;
  color: var(--text-muted);
  font-size: 11px;
  margin-bottom: 5px;
}

.status-grid strong {
  font-size: 13px;
  color: var(--text-primary);
}

.quick-action {
  width: 100%;
  height: 34px;
  border: 1px solid var(--border-subtle);
  border-radius: 6px;
  background: var(--bg-panel);
  color: var(--text-secondary);
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 10px;
  cursor: pointer;
  margin-bottom: 7px;
}

.quick-action:hover {
  border-color: var(--border-strong);
  color: var(--brand);
}

.mini-list {
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
}

.mini-list span {
  border: 1px solid var(--border-subtle);
  border-radius: 5px;
  padding: 5px 8px;
  background: var(--bg-panel);
  color: var(--text-secondary);
  font-size: 12px;
}

@media (max-width: 1160px) {
  .inspector {
    display: none;
  }
}
</style>
