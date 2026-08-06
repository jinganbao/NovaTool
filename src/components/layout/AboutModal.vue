<script setup lang="ts">
import { onMounted, ref } from "vue";
import { getVersion } from "@tauri-apps/api/app";
import { invoke } from "@tauri-apps/api/core";
import { NButton, NModal, NSpace } from "naive-ui";
import { Hammer } from "lucide-vue-next";

const show = defineModel<boolean>("show", { required: true });
const appVersion = ref("...");

onMounted(async () => {
  try {
    appVersion.value = await getVersion();
  } catch {
    appVersion.value = "unknown";
  }
});

const REPO_URL = "https://github.com/jinganbao/NovaTool";

function openUrl(url: string) {
  void invoke("open_url", { url }).catch((err) => {
    console.error("打开链接失败", err);
  });
}
</script>

<template>
  <n-modal v-model:show="show" preset="card" title="关于 NovaTool" class="nova-modal" style="width: 400px">
    <div class="about-content">
      <div class="about-logo">
        <Hammer :size="24" stroke-width="2.2" />
      </div>
      <div class="about-name">NovaTool</div>
      <div class="about-version">v{{ appVersion }}</div>
      <p class="about-desc">程序员常用开发工具箱 · Tauri 2 + Vue 3</p>
      <div class="about-links">
        <n-button size="small" @click="openUrl(REPO_URL)">项目主页</n-button>
        <n-button size="small" @click="openUrl(`${REPO_URL}/blob/main/LICENSE`)">开源许可证</n-button>
      </div>
    </div>
    <template #footer>
      <n-space justify="end">
        <n-button @click="show = false">关闭</n-button>
      </n-space>
    </template>
  </n-modal>
</template>

<style scoped>
.about-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 8px 0 16px;
}

.about-logo {
  width: 56px;
  height: 56px;
  border-radius: 14px;
  display: grid;
  place-items: center;
  color: #fff;
  background: var(--brand-gradient);
  box-shadow: 0 2px 8px var(--shadow-strong);
}

.about-name {
  font-size: 18px;
  font-weight: 700;
  margin-top: 6px;
}

.about-version {
  color: var(--text-muted);
  font-size: 12px;
}

.about-desc {
  color: var(--text-secondary);
  font-size: 13px;
  margin: 4px 0 0;
  text-align: center;
}

.about-links {
  display: flex;
  gap: 8px;
  margin-top: 10px;
}
</style>
