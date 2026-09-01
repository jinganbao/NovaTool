<script setup lang="ts">
import { AlertCircle, CheckCircle2, Inbox, LoaderCircle } from "lucide-vue-next";

type StateType = "empty" | "error" | "success" | "loading";

const props = withDefaults(defineProps<{
  type?: StateType;
  title: string;
  detail?: string;
  compact?: boolean;
}>(), { type: "empty", detail: "", compact: false });

const icons = { empty: Inbox, error: AlertCircle, success: CheckCircle2, loading: LoaderCircle };
</script>

<template>
  <div class="tool-state" :class="[`is-${props.type}`, { compact: props.compact }]" role="status">
    <component :is="icons[props.type]" :size="compact ? 18 : 24" />
    <strong>{{ title }}</strong>
    <span v-if="detail">{{ detail }}</span>
  </div>
</template>

<style scoped>
.tool-state { min-height: 120px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; padding: 24px; color: var(--text-muted); text-align: center; }
.tool-state svg { color: var(--text-muted); opacity: 0.82; }
.tool-state strong { color: var(--text-secondary); font-size: 12px; font-weight: 600; }
.tool-state span { max-width: 520px; color: var(--text-muted); font-size: 11px; line-height: 1.5; }
.tool-state.is-error svg, .tool-state.is-error strong { color: var(--danger); }
.tool-state.is-success svg, .tool-state.is-success strong { color: var(--success); }
.tool-state.is-loading svg { color: var(--brand); animation: tool-state-spin 1s linear infinite; }
.tool-state.compact { min-height: 0; padding: 12px; flex-direction: row; justify-content: flex-start; text-align: left; }
.tool-state.compact span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
@keyframes tool-state-spin { to { transform: rotate(360deg); } }
</style>
