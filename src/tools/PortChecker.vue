<script setup lang="ts">
import { computed, ref } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { NButton, NInput, NSpace, NTag, NPopconfirm, useMessage } from "naive-ui";
import { Copy, RefreshCw, Search, Skull, Wifi } from "lucide-vue-next";
import { renderIcon } from "@/utils/render";
import { useClipboard } from "@/composables/useClipboard";

/* ---- 类型 ---- */
type PortEntry = {
  port: number;
  pid: number;
  processName: string;
  protocol: string;
};

/* ---- 状态 ---- */
const message = useMessage();
const { copyText } = useClipboard(message);

const entries = ref<PortEntry[]>([]);
const loading = ref(false);
const searchQuery = ref("");

/* ---- 计算 ---- */
const filtered = computed(() => {
  const q = searchQuery.value.trim().toLowerCase();
  if (!q) return entries.value;
  return entries.value.filter(
    (e) =>
      String(e.port).includes(q) ||
      String(e.pid).includes(q) ||
      e.processName.toLowerCase().includes(q),
  );
});

/* ---- 工具 ---- */
async function refresh() {
  loading.value = true;
  try {
    entries.value = await invoke<PortEntry[]>("list_ports");
  } catch (err) {
    message.error("获取端口列表失败：" + (err instanceof Error ? err.message : String(err)));
  } finally {
    loading.value = false;
  }
}

async function killProcess(pid: number) {
  try {
    await invoke("kill_process", { pid });
    message.success(`已终止进程 ${pid}`);
    await refresh();
  } catch (err) {
    message.error(err instanceof Error ? err.message : String(err));
  }
}

function copyRow(e: PortEntry) {
  void copyText(`${e.processName}\t${e.pid}\t${e.port}\t${e.protocol}`);
}

// 初始化加载
refresh();
</script>

<template>
  <section class="tool-panel port-tool">
    <!-- ====== 操作栏 ====== -->
    <div class="action-bar">
      <n-input
        v-model:value="searchQuery"
        size="small"
        placeholder="搜索端口 / PID / 进程名…"
        class="search-input"
        clearable
      >
        <template #prefix>
          <Search :size="14" />
        </template>
      </n-input>
      <n-space :size="6">
        <n-button size="small" type="primary" :loading="loading" :render-icon="() => renderIcon(RefreshCw)" @click="refresh"
          >刷新</n-button
        >
      </n-space>
    </div>

    <!-- ====== 表格 ====== -->
    <div class="table-wrap">
      <table v-if="filtered.length > 0" class="port-table">
        <thead>
          <tr>
            <th class="col-port">端口</th>
            <th class="col-pid">PID</th>
            <th class="col-name">进程名</th>
            <th class="col-proto">协议</th>
            <th class="col-act">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in filtered" :key="`${row.port}-${row.pid}`">
            <td><n-tag :bordered="false" size="small" type="info">{{ row.port }}</n-tag></td>
            <td><code class="pid-text">{{ row.pid }}</code></td>
            <td>
              <span class="proc-name">{{ row.processName }}</span>
              <n-button size="tiny" quaternary :render-icon="() => renderIcon(Copy)" @click="copyRow(row)" />
            </td>
            <td><span class="proto-badge">{{ row.protocol }}</span></td>
            <td>
              <n-popconfirm @positive-click="killProcess(row.pid)">
                <template #trigger>
                  <n-button size="tiny" type="error" secondary :render-icon="() => renderIcon(Skull)">结束进程</n-button>
                </template>
                确定要强制终止 PID {{ row.pid }} ({{ row.processName }})？
              </n-popconfirm>
            </td>
          </tr>
        </tbody>
      </table>

      <div v-else-if="!loading" class="empty">
        <Wifi :size="28" />
        <span v-if="searchQuery">无匹配结果</span>
        <span v-else>暂无监听端口</span>
      </div>
    </div>
  </section>
</template>

<style scoped>
.tool-panel {
  flex: 1;
  min-height: 0;
  box-sizing: border-box;
}

.port-tool {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-height: 0;
}

/* ---- 操作栏 ---- */
.action-bar {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 10px;
}

.search-input {
  flex: 1;
  min-width: 0;
}

/* ---- 表格 ---- */
.table-wrap {
  flex: 1;
  min-height: 0;
  overflow: auto;
  border: 1px solid var(--border-subtle);
  border-radius: 6px;
  background: var(--bg-panel);
}

.port-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.port-table th,
.port-table td {
  padding: 8px 12px;
  text-align: left;
  border-bottom: 1px solid var(--border-subtle);
  white-space: nowrap;
}

.port-table th {
  color: var(--text-muted);
  font-size: 12px;
  font-weight: 700;
  background: var(--bg-panel-hover);
  position: sticky;
  top: 0;
  z-index: 1;
}

.port-table tbody tr:hover {
  background: var(--bg-hover);
}

.col-port { width: 70px; }
.col-pid  { width: 70px; }
.col-proto { width: 60px; }
.col-act  { width: 100px; }

.pid-text {
  font-family: "SFMono-Regular", Consolas, "Liberation Mono", monospace;
  font-size: 12px;
  color: var(--text-primary);
}

.proc-name {
  color: var(--text-primary);
  font-weight: 500;
}

.proto-badge {
  color: var(--text-secondary);
  font-size: 12px;
}

/* ---- 空状态 ---- */
.empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  height: 200px;
  color: var(--text-muted);
  font-size: 13px;
}

/* ---- 按钮微调 ---- */
:deep(.n-button) {
  height: 28px;
  font-size: 12px;
}
</style>
