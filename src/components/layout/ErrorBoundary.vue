<script setup lang="ts">
import { ref, onErrorCaptured } from "vue";

const error = ref<Error | null>(null);

onErrorCaptured((err: unknown) => {
  error.value = err instanceof Error ? err : new Error(String(err));
  // 阻止错误继续向上传播
  return false;
});

function retry() {
  error.value = null;
}

defineExpose({ reset: retry });
</script>

<template>
  <div v-if="error" class="error-boundary">
    <div class="error-card">
      <div class="error-icon">!</div>
      <div class="error-title">工具运行出错</div>
      <div class="error-message">{{ error.message }}</div>
      <button class="error-retry" @click="retry">重试</button>
    </div>
  </div>
  <slot v-else />
</template>

<style scoped>
.error-boundary {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}

.error-card {
  text-align: center;
  max-width: 360px;
}

.error-icon {
  width: 48px;
  height: 48px;
  margin: 0 auto 12px;
  border-radius: 50%;
  background: var(--danger-soft, rgba(239, 68, 68, 0.12));
  color: var(--danger, #ef4444);
  font-size: 24px;
  font-weight: 700;
  line-height: 48px;
}

.error-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 6px;
}

.error-message {
  font-size: 12px;
  color: var(--text-muted);
  word-break: break-word;
  margin-bottom: 16px;
}

.error-retry {
  padding: 6px 20px;
  border: 1px solid var(--border-strong);
  border-radius: 6px;
  background: var(--bg-input);
  color: var(--text-primary);
  cursor: pointer;
  font-size: 12px;
}

.error-retry:hover {
  border-color: var(--brand);
  background: var(--brand-soft);
}
</style>
