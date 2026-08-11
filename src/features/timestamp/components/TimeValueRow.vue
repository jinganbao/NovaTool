<script setup lang="ts">
import { NButton, NTooltip } from "naive-ui";
import { Copy } from "lucide-vue-next";
import { renderIcon } from "@/utils/render";

withDefaults(defineProps<{ label: string; value: string; copyable?: boolean }>(), {
  copyable: true,
});
defineEmits<{ copy: [value: string] }>();
</script>

<template>
  <div class="value-row">
    <span>{{ label }}</span>
    <code :title="value">{{ value }}</code>
    <n-tooltip v-if="copyable !== false" placement="top" :show-arrow="false">
      <template #trigger>
        <n-button
          size="tiny"
          quaternary
          :aria-label="`复制${label}`"
          :render-icon="() => renderIcon(Copy)"
          @click="$emit('copy', value)"
        />
      </template>
      复制
    </n-tooltip>
  </div>
</template>

<style scoped>
.value-row { min-height: 34px; display: grid; grid-template-columns: 82px minmax(0, 1fr) 28px; align-items: center; gap: 8px; padding: 3px 5px 3px 10px; border-bottom: 1px solid var(--border-subtle); }
.value-row:last-child { border-bottom: 0; }
.value-row > span { color: var(--text-muted); font-size: 11px; }
.value-row code { min-width: 0; overflow: hidden; color: var(--text-primary); font-family: "SFMono-Regular", Consolas, "Liberation Mono", monospace; font-size: 11px; text-overflow: ellipsis; white-space: nowrap; }
:deep(.n-button) { width: 26px; height: 26px; }
</style>
