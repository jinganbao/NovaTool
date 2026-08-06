<script setup lang="ts">
import { NButton, NModal, NProgress, NSpace, NSpin, NText } from "naive-ui";
import { Rocket } from "lucide-vue-next";
import type { UpdateResult } from "@/utils/update";

const show = defineModel<boolean>("show", { required: true });

defineProps<{
  checking: boolean;
  installing: boolean;
  info: UpdateResult | null;
  error: string;
  downloaded: number;
  total: number;
  progressLabel: string;
  progressPercentage: number;
}>();

const emit = defineEmits<{ download: []; retry: [] }>();
</script>

<template>
  <n-modal v-model:show="show" preset="card" title="版本更新" class="nova-modal" style="width: 420px">
    <n-spin :show="checking && !info">
      <!-- 下载中 -->
      <n-space v-if="installing" vertical :size="10">
        <n-progress type="line" :percentage="progressPercentage" :show-indicator="false" />
        <n-text depth="3" style="font-size: 12px">{{ progressLabel }}</n-text>
      </n-space>

      <!-- 有更新 -->
      <template v-else-if="info?.hasUpdate">
        <n-space vertical :size="10">
          <n-text>
            发现新版本 <strong>v{{ info.version }}</strong>（当前 v{{ info.currentVersion }}）
          </n-text>
          <n-text v-if="info.date" depth="3">发布日期：{{ info.date }}</n-text>
          <div v-if="info.body" class="update-body">
            <n-text depth="3">{{ info.body }}</n-text>
          </div>
        </n-space>
      </template>

      <!-- 无更新 -->
      <template v-else-if="info">
        <div style="text-align: center; padding: 12px 0">
          <Rocket :size="32" style="color: var(--brand); margin-bottom: 8px" />
          <n-text>当前已是最新版本</n-text>
        </div>
      </template>

      <!-- 检查失败 -->
      <template v-else-if="error">
        <n-text type="error">检查更新失败：{{ error }}</n-text>
      </template>

      <!-- 检查中 -->
      <template v-else>
        <n-text depth="3">正在检查更新...</n-text>
      </template>
    </n-spin>

    <template #footer>
      <n-space justify="end">
        <template v-if="installing">
          <n-button @click="show = false">后台下载</n-button>
        </template>
        <template v-else>
          <n-button @click="show = false">关闭</n-button>
          <n-button v-if="info?.hasUpdate" type="primary" @click="emit('download')">
            下载并安装
          </n-button>
          <n-button v-else-if="error" @click="emit('retry')">重试</n-button>
        </template>
      </n-space>
    </template>
  </n-modal>
</template>

<style scoped>
.update-body {
  max-height: 120px;
  overflow-y: auto;
  white-space: pre-wrap;
  padding: 8px;
  border-radius: 5px;
  background: var(--bg-input);
}
</style>
