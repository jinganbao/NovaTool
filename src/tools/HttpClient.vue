<script setup lang="ts">
import { computed, h, ref, watch } from "vue";
import { NAlert, NButton, NDropdown, NInput, NInputNumber, NModal, NPopover, NSelect, NSpace, NSwitch, NTag } from "naive-ui";
import { ArrowLeft, ChevronDown, ChevronRight, Copy, Folder, FolderPlus, Plus, Search, Send, SlidersHorizontal, Terminal, Trash2 } from "lucide-vue-next";
import CodeEditor from "@/components/editor/CodeEditor.vue";
import ToolState from "@/components/common/ToolState.vue";
import { useClipboard } from "@/composables/useClipboard";
import { useHttpClient } from "@/features/http-client/useHttpClient";
import { useHttpProjects } from "@/features/http-client/useHttpProjects";
import { makeId } from "@/utils/storage";
import type { HttpKeyValue, HttpRequestConfig } from "@/features/http-client/types";
import { renderIcon } from "@/utils/render";
import { useMessage } from "naive-ui";

const message = useMessage();
const { copyText } = useClipboard(message);
const { projects, createProject, deleteProject, createInterface, deleteInterface } = useHttpProjects();
const showHome = ref(true);
const showCreateProject = ref(false);
const projectName = ref("");
const projectDescription = ref("");
const activeProjectId = ref<string | null>(null);
const activeInterfaceId = ref<string | null>(null);
const openInterfaceIds = ref<string[]>([]);
const interfaceSearch = ref("");
const showSaveInterface = ref(false);
const saveInterfaceName = ref("");
const saveInterfaceFolder = ref("默认模块");
const showCreateMenu = ref(false);
const showTabCreateMenu = ref(false);
const showCreateFolder = ref(false);
const folderName = ref("");
const expandedFolders = ref<Record<string, boolean>>({ "默认模块": true });
const showDeleteConfirm = ref(false);
const pendingDeleteInterfaceId = ref("");
const pendingDeleteInterfaceName = ref("");
const requestTab = ref<"params" | "body" | "headers" | "cookies" | "auth">("params");
const {
  method, url, query, headers, body, bodyFields, bodyType, timeoutMs, loading, response, responseBody,
  responseHeaders, error, templates, selectedTemplateId, templateName, environment,
  sessionAuth,
  addQuery, addHeader, addBodyField, addEnvironment, removeRow, applyTemplate, saveTemplate, send, clearResponse,
} = useHttpClient(activeProjectId, projects, activeInterfaceId);

const methodOptions = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"].map((value) => ({ label: value, value }));
const methodColors: Record<string, string> = {
  GET: "#20c997",
  POST: "#f59e0b",
  PUT: "#3b82f6",
  PATCH: "#a78bfa",
  DELETE: "#f87171",
  HEAD: "#94a3b8",
  OPTIONS: "#22d3ee",
};
function renderMethodLabel(option: { label: string; value: string }) {
  return h("span", { style: { color: methodColors[option.value] || "var(--text-primary)", fontWeight: "600" } }, option.label);
}
const bodyOptions: Array<{ label: string; value: HttpRequestConfig["bodyType"] }> = [
  { label: "none", value: "none" }, { label: "form-data", value: "form-data" },
  { label: "x-www-form-urlencoded", value: "x-www-form-urlencoded" }, { label: "JSON", value: "json" },
  { label: "XML", value: "xml" }, { label: "Text", value: "text" },
];
const bodyFieldTypeOptions = ["string", "number", "boolean", "object"].map((value) => ({ label: value, value }));
const rowColumns = (list: HttpKeyValue[]) => list;
const showEnvironmentManager = ref(false);
const selectedEnvironmentId = ref("");
const environmentName = ref("");
const environmentBaseUrl = ref("");
const templateOptions = computed(() => templates.value.map((item) => ({ label: item.name, value: item.id })));
const sensitiveKeyPattern = /authorization|proxy-authorization|cookie|set-cookie|token|secret|password|api[-_]?key/i;
const hasSensitiveData = computed(() =>
  [...headers.value, ...environment.value].some((item) => item.enabled && sensitiveKeyPattern.test(item.key)),
);
function isSensitiveKey(key: string) {
  return sensitiveKeyPattern.test(key);
}
function openProject(id: string) {
  activeProjectId.value = id;
  activeInterfaceId.value = null;
  openInterfaceIds.value = [];
  showHome.value = false;
}
const activeProject = computed(() => projects.value.find((project) => project.id === activeProjectId.value));
const environmentProfiles = computed(() => activeProject.value?.environments ?? []);
const activeEnvironment = computed(() => environmentProfiles.value.find((item) => item.id === activeProject.value?.activeEnvironmentId) || environmentProfiles.value[0]);
const requestBaseUrl = computed(() => (activeEnvironment.value?.baseUrl || "").replace(/\/+$/, ""));
const requestPath = computed({
  get() {
    const current = url.value.trim();
    if (requestBaseUrl.value && current.startsWith(requestBaseUrl.value)) {
      return current.slice(requestBaseUrl.value.length) || "/";
    }
    return current || "/";
  },
  set(value: string) {
    const path = value.trim() || "/";
    url.value = requestBaseUrl.value ? requestBaseUrl.value + "/" + path.replace(/^\/+/, "") : path;
  },
});
const interfaceFolderOptions = computed(() => {
  return (activeProject.value?.interfaceFolders ?? ["默认模块"]).map((value) => ({ label: value, value }));
});
const environmentMenuOptions = computed(() => [
  ...environmentProfiles.value.map((item) => ({ label: item.name, key: item.id })),
  { type: "divider", key: "divider" },
  { label: "环境管理", key: "manage" },
]);
function selectEnvironment(id: string) {
  const project = activeProject.value;
  const profile = environmentProfiles.value.find((item) => item.id === id);
  if (!project || !profile) return;
  const current = environmentProfiles.value.find((item) => item.id === project.activeEnvironmentId);
  if (current) current.variables = environment.value;
  project.activeEnvironmentId = profile.id;
  project.environment = profile.variables;
  environment.value = profile.variables.map((item) => ({ ...item, id: makeId("env") }));
  environmentBaseUrl.value = profile.baseUrl || "";
}
function syncUrlToEnvironment() {
  const base = requestBaseUrl.value;
  if (!base) return;
  const current = url.value.trim();
  let path = "/";
  if (current && !current.startsWith("http://") && !current.startsWith("https://")) {
    path = current;
  } else if (current) {
    try {
      const parsed = new URL(current);
      path = parsed.pathname + parsed.search;
    } catch {
      path = "/";
    }
  }
  url.value = base + "/" + path.replace(/^\/+/, "");
}
watch([activeEnvironment, activeInterfaceId], syncUrlToEnvironment);
function openEnvironmentManager() {
  selectedEnvironmentId.value = activeEnvironment.value?.id || "";
  environmentName.value = activeEnvironment.value?.name || "默认环境";
  environmentBaseUrl.value = activeEnvironment.value?.baseUrl || "";
  showEnvironmentManager.value = true;
}
function handleEnvironmentSelect(key: string) {
  if (key === "manage") openEnvironmentManager();
  else if (key !== "divider") selectEnvironment(key);
}
function saveEnvironmentProfile() {
  const project = activeProject.value;
  const profile = environmentProfiles.value.find((item) => item.id === selectedEnvironmentId.value);
  if (!project || !profile) return;
  profile.name = environmentName.value.trim() || "未命名环境";
  const baseUrl = environmentBaseUrl.value.trim();
  if (!baseUrl) { message.warning("请输入前置 URL"); return; }
  if (!/^https?:\/\/\S+$/i.test(baseUrl)) { message.warning("前置 URL 必须以 http:// 或 https:// 开头"); return; }
  profile.baseUrl = baseUrl;
  profile.variables = environment.value;
  project.environment = environment.value;
  project.activeEnvironmentId = profile.id;
  showEnvironmentManager.value = false;
}
function createEnvironmentProfile() {
  const project = activeProject.value;
  if (!project) return;
  const profile = { id: makeId("http-env"), name: "新环境", baseUrl: "", variables: [] };
  project.environments.push(profile);
  selectedEnvironmentId.value = profile.id;
  environmentName.value = profile.name;
  selectEnvironment(profile.id);
  environmentBaseUrl.value = profile.baseUrl;
}
function editEnvironment(id: string) {
  selectEnvironment(id);
  selectedEnvironmentId.value = id;
  environmentName.value = environmentProfiles.value.find((item) => item.id === id)?.name || "未命名环境";
  environmentBaseUrl.value = environmentProfiles.value.find((item) => item.id === id)?.baseUrl || "";
}
const filteredInterfaces = computed(() => {
  const query = interfaceSearch.value.trim().toLowerCase();
  return (activeProject.value?.interfaces ?? []).filter((item) =>
    !query || item.name.toLowerCase().includes(query) || item.path.toLowerCase().includes(query),
  );
});
const interfaceGroups = computed(() => {
  const query = interfaceSearch.value.trim().toLowerCase();
  const project = activeProject.value;
  const folders = [...new Set([
    ...(project?.interfaceFolders ?? ["默认模块"]),
    ...(project?.interfaces ?? []).map((item) => item.folder || "默认模块"),
  ])];
  return folders
    .map((name) => ({
      name,
      items: filteredInterfaces.value.filter((item) => (item.folder || "默认模块") === name),
    }))
    .filter((group) => !query || group.items.length > 0 || group.name.toLowerCase().includes(query));
});
function isFolderExpanded(name: string) {
  return expandedFolders.value[name] !== false;
}
function toggleFolder(name: string) {
  expandedFolders.value[name] = !isFolderExpanded(name);
}
function openInterface(id: string) {
  if (!openInterfaceIds.value.includes(id)) openInterfaceIds.value.push(id);
  activeInterfaceId.value = id;
}
function createBlankInterface() {
  if (!activeProjectId.value) return;
  const item = createInterface(activeProjectId.value, "未命名接口", "GET", "/");
  if (item) {
    item.folder = "默认模块";
    expandedFolders.value["默认模块"] = true;
    openInterface(item.id);
  }
}
function openCreateFolder() {
  showCreateMenu.value = false;
  showTabCreateMenu.value = false;
  folderName.value = "";
  showCreateFolder.value = true;
}
function createInterfaceFolder() {
  const project = activeProject.value;
  const name = folderName.value.trim();
  if (!project || !name) { message.warning("请输入目录名称"); return; }
  if (!project.interfaceFolders.includes(name)) project.interfaceFolders.push(name);
  expandedFolders.value[name] = true;
  showCreateFolder.value = false;
  message.success("接口目录已创建");
}
function closeInterfaceTab(id: string) {
  const index = openInterfaceIds.value.indexOf(id);
  openInterfaceIds.value = openInterfaceIds.value.filter((item) => item !== id);
  if (activeInterfaceId.value !== id) return;
  activeInterfaceId.value = openInterfaceIds.value[Math.max(0, index - 1)] || null;
}
function removeInterface(id: string) {
  if (!activeProjectId.value) return;
  const item = activeProject.value?.interfaces.find((entry) => entry.id === id);
  pendingDeleteInterfaceId.value = id;
  pendingDeleteInterfaceName.value = item?.name || "未命名接口";
  showDeleteConfirm.value = true;
}
function confirmRemoveInterface() {
  if (!activeProjectId.value || !pendingDeleteInterfaceId.value) return;
  deleteInterface(activeProjectId.value, pendingDeleteInterfaceId.value);
  closeInterfaceTab(pendingDeleteInterfaceId.value);
  showDeleteConfirm.value = false;
  message.success("接口已删除");
}
function saveCurrentInterface() {
  const item = activeProject.value?.interfaces.find((entry) => entry.id === activeInterfaceId.value);
  if (!item) return;
  saveInterfaceName.value = item.name;
  saveInterfaceFolder.value = item.folder || "默认模块";
  showSaveInterface.value = true;
}
function confirmSaveInterface() {
  const item = activeProject.value?.interfaces.find((entry) => entry.id === activeInterfaceId.value);
  if (!item) return;
  item.name = saveInterfaceName.value.trim() || "未命名接口";
  item.folder = saveInterfaceFolder.value || "默认模块";
  showSaveInterface.value = false;
  message.success("接口信息已保存");
}
function submitProject() {
  const name = projectName.value.trim();
  if (!name) { message.warning("请输入项目名称"); return; }
  const project = createProject(name, projectDescription.value);
  projectName.value = "";
  projectDescription.value = "";
  showCreateProject.value = false;
  openProject(project.id);
  message.success("项目已创建");
}
function removeProject(id: string) {
  deleteProject(id);
  if (activeProjectId.value === id) {
    activeProjectId.value = null;
    showHome.value = true;
  }
}
</script>

<template>
  <section v-if="showHome" class="tool-panel http-project-home">
    <header class="project-home-head">
      <div>
        <span class="eyebrow">HTTP WORKSPACE</span>
        <h2>接口项目</h2>
        <p>按项目管理请求、环境变量和调试历史。</p>
      </div>
      <n-button type="primary" :render-icon="() => renderIcon(FolderPlus)" @click="showCreateProject = true">新建项目</n-button>
    </header>
    <div v-if="projects.length" class="project-grid">
      <article v-for="project in projects" :key="project.id" class="project-card" tabindex="0" @dblclick="openProject(project.id)" @keydown.enter="openProject(project.id)">
        <div class="project-card-icon"><Terminal :size="20" /></div>
        <div class="project-card-copy">
          <h3>{{ project.name }}</h3>
          <p>{{ project.description || "HTTP 接口调试项目" }}</p>
        </div>
        <div class="project-card-foot"><span>HTTP</span><button type="button" aria-label="删除项目" title="删除项目" @click.stop="removeProject(project.id)">×</button></div>
      </article>
    </div>
    <ToolState v-else title="还没有 HTTP 项目" detail="新建一个项目，开始管理接口请求" />
    <n-modal v-model:show="showCreateProject" preset="card" title="新建 HTTP 项目" class="nova-modal" style="width: 420px">
      <div class="project-form">
        <n-input v-model:value="projectName" autofocus placeholder="项目名称，例如 用户中心" @keyup.enter="submitProject" />
        <n-input v-model:value="projectDescription" type="textarea" :autosize="{ minRows: 2, maxRows: 4 }" placeholder="项目描述（可选）" />
      </div>
      <template #footer><n-space justify="end"><n-button @click="showCreateProject = false">取消</n-button><n-button type="primary" @click="submitProject">创建项目</n-button></n-space></template>
    </n-modal>
  </section>

  <n-modal v-model:show="showDeleteConfirm" preset="dialog" type="warning" title="删除接口" positive-text="删除" negative-text="取消" @positive-click="confirmRemoveInterface">
    确定删除“{{ pendingDeleteInterfaceName }}”吗？删除后无法恢复。
  </n-modal>
  <n-modal v-model:show="showSaveInterface" preset="card" title="保存接口" class="nova-modal" style="width: 420px">
    <div class="project-form">
      <n-input v-model:value="saveInterfaceName" autofocus placeholder="接口名称" @keyup.enter="confirmSaveInterface" />
      <n-select v-model:value="saveInterfaceFolder" :options="interfaceFolderOptions" placeholder="选择保存目录" />
    </div>
    <template #footer><n-space justify="end"><n-button @click="showSaveInterface = false">取消</n-button><n-button type="primary" @click="confirmSaveInterface">保存</n-button></n-space></template>
  </n-modal>

  <n-modal v-model:show="showCreateFolder" preset="card" title="新建接口目录" class="nova-modal" style="width: 360px">
    <n-input v-model:value="folderName" autofocus placeholder="目录名称，例如 用户管理" @keyup.enter="createInterfaceFolder" />
    <template #footer><n-space justify="end"><n-button @click="showCreateFolder = false">取消</n-button><n-button type="primary" @click="createInterfaceFolder">创建</n-button></n-space></template>
  </n-modal>

  <section v-if="!showHome" class="tool-panel http-client">
    <div class="project-workspace">
      <aside class="interface-sidebar">
        <header class="interface-sidebar-head">
          <div class="interface-sidebar-title"><n-button class="sidebar-back" size="tiny" quaternary aria-label="返回项目列表" title="返回项目列表" :render-icon="() => renderIcon(ArrowLeft)" @click="showHome = true" /><h2>接口管理</h2><span>{{ activeProject?.interfaces.length || 0 }} 个接口</span></div>
          <n-popover v-model:show="showCreateMenu" trigger="click" placement="bottom-end">
            <template #trigger><n-button size="tiny" type="primary" aria-label="新建" title="新建" :render-icon="() => renderIcon(Plus)" /></template>
            <div class="create-menu"><strong>新建</strong><button type="button" @click="showCreateMenu = false; createBlankInterface()"><span class="create-menu-icon interface">HTTP</span>接口</button><button type="button" @click="openCreateFolder"><span class="create-menu-icon folder">□</span>接口目录</button></div>
          </n-popover>
        </header>
        <n-input v-model:value="interfaceSearch" size="small" clearable placeholder="搜索接口" class="interface-search">
          <template #prefix><Search :size="14" /></template>
        </n-input>
        <div v-if="interfaceGroups.length" class="interface-tree">
          <section v-for="group in interfaceGroups" :key="group.name" class="interface-folder">
            <button type="button" class="interface-folder-row" @click="toggleFolder(group.name)">
              <ChevronDown v-if="isFolderExpanded(group.name)" :size="13" />
              <ChevronRight v-else :size="13" />
              <Folder :size="14" />
              <span>{{ group.name }}</span>
              <small>{{ group.items.length }}</small>
            </button>
            <div v-show="isFolderExpanded(group.name)" class="interface-list">
              <article v-for="item in group.items" :key="item.id" class="interface-row" :class="{ active: activeInterfaceId === item.id }" tabindex="0" @click="openInterface(item.id)" @keydown.enter="openInterface(item.id)">
                <span class="method-badge" :class="item.method.toLowerCase()">{{ item.method }}</span>
                <div><strong>{{ item.name }}</strong></div>
                <button type="button" aria-label="删除接口" title="删除接口" @click.stop="removeInterface(item.id)">×</button>
              </article>
            </div>
          </section>
        </div>
        <ToolState v-else title="暂无接口" detail="点击右上角新建" compact />
      </aside>
      <main class="interface-content">
        <div class="editor-tabbar workspace-tabbar">
          <button v-for="id in openInterfaceIds" :key="id" type="button" class="workspace-tab" :class="{ active: activeInterfaceId === id }" @click="openInterface(id)">
            <span class="method-text" :class="activeProject?.interfaces.find((item) => item.id === id)?.method.toLowerCase()">{{ activeProject?.interfaces.find((item) => item.id === id)?.method }}</span>
            <span>{{ activeProject?.interfaces.find((item) => item.id === id)?.name }}</span>
            <span class="workspace-tab-close" role="button" tabindex="0" aria-label="关闭接口标签" title="关闭接口标签" @click.stop="closeInterfaceTab(id)" @keydown.enter.stop="closeInterfaceTab(id)">×</span>
          </button>
          <n-popover v-model:show="showTabCreateMenu" trigger="click" placement="bottom-start">
            <template #trigger><n-button size="tiny" quaternary aria-label="新建" title="新建" :render-icon="() => renderIcon(Plus)" /></template>
            <div class="create-menu"><strong>新建</strong><button type="button" @click="showTabCreateMenu = false; createBlankInterface()"><span class="create-menu-icon interface">HTTP</span>接口</button><button type="button" @click="openCreateFolder"><span class="create-menu-icon folder">□</span>接口目录</button></div>
          </n-popover>
          <span class="tab-spacer"></span>
          <n-dropdown :options="environmentMenuOptions" trigger="click" @select="handleEnvironmentSelect">
            <n-button size="small" secondary :render-icon="() => renderIcon(SlidersHorizontal)">{{ activeEnvironment?.name || "环境" }}</n-button>
          </n-dropdown>
        </div>
        <div v-if="!activeInterfaceId" class="interface-empty">
          <div class="interface-empty-icon"><Terminal :size="24" /></div>
          <h2>新建 HTTP 接口</h2>
          <p>创建接口后，在这里配置请求参数、请求体和响应。</p>
          <n-button type="primary" :render-icon="() => renderIcon(Plus)" @click="createBlankInterface">新建 HTTP 接口</n-button>
        </div>
    <n-modal v-model:show="showEnvironmentManager" preset="card" title="环境管理" class="environment-manager-modal" style="width: 760px">
      <div class="environment-manager">
        <aside class="environment-manager-list">
          <div class="environment-manager-list-head"><strong>项目环境</strong><n-button size="tiny" quaternary :render-icon="() => renderIcon(Plus)" aria-label="新建环境" title="新建环境" @click="createEnvironmentProfile" /></div>
          <button v-for="item in environmentProfiles" :key="item.id" type="button" :class="{ active: selectedEnvironmentId === item.id }" @click="editEnvironment(item.id)">{{ item.name }}</button>
        </aside>
        <section v-if="selectedEnvironmentId" class="environment-manager-form">
          <div class="environment-manager-title"><strong>{{ environmentName }}</strong><span>项目级环境变量</span></div>
          <n-input v-model:value="environmentName" size="small" placeholder="环境名称，例如 开发环境" />
          <section class="environment-settings-section">
            <div class="environment-settings-head"><strong>前置 URL</strong><span class="required-mark">*</span></div>
            <div class="environment-url-row">
              <span>默认模块</span>
              <n-input v-model:value="environmentBaseUrl" size="small" required placeholder="http:// 或 https:// 起始的前置 URL" />
            </div>
          </section>
          <section class="environment-settings-section">
            <div class="environment-settings-head"><strong>环境变量</strong><span class="environment-hint">请求中的 &#123;&#123;NAME&#125;&#125; 会替换为变量值</span><n-button size="tiny" quaternary :render-icon="() => renderIcon(Plus)" aria-label="添加环境变量" title="添加环境变量" @click="addEnvironment" /></div>
          <div v-for="item in environment" :key="item.id" class="environment-row">
            <input v-model="item.enabled" type="checkbox" aria-label="启用环境变量" />
            <n-input v-model:value="item.key" size="small" placeholder="变量名，例如 BASE_URL" />
            <n-input v-model:value="item.value" size="small" placeholder="变量值" />
            <n-button size="tiny" quaternary aria-label="删除环境变量" title="删除环境变量" :render-icon="() => renderIcon(Trash2)" @click="removeRow(environment, item.id)" />
          </div>
          </section>
        </section>
      </div>
      <template #footer><n-space justify="end"><n-button @click="showEnvironmentManager = false">取消</n-button><n-button type="primary" @click="saveEnvironmentProfile">保存</n-button></n-space></template>
    </n-modal>
    <div v-if="activeInterfaceId" class="interface-editor">
      <nav class="editor-mode-tabs" aria-label="接口工作区">
        <button class="active" type="button">调试</button>
      </nav>
      <div class="interface-context"><strong>{{ activeProject?.interfaces.find((item) => item.id === activeInterfaceId)?.name }}</strong><span>{{ activeProject?.interfaces.find((item) => item.id === activeInterfaceId)?.path }}</span></div>
    <div class="request-bar">
      <n-select v-model:value="method" size="small" :options="methodOptions" :render-label="renderMethodLabel" :consistent-menu-width="false" class="method-select" />
      <div class="request-url">
        <n-input :value="requestBaseUrl || '未配置环境 URL'" size="small" readonly class="request-base-url" />
        <n-input v-model:value="requestPath" size="small" placeholder="/接口路径" class="url-input request-path" :disabled="!requestBaseUrl" @keyup.enter="send" />
      </div>
      <n-button size="small" type="primary" :loading="loading" :render-icon="() => renderIcon(Send)" @click="send">发送</n-button>
      <n-button size="small" secondary @click="saveCurrentInterface">保存</n-button>
    </div>

    <div class="template-bar">
      <n-select v-model:value="selectedTemplateId" size="small" clearable placeholder="请求模板" :options="templateOptions" class="template-select" @update:value="applyTemplate" />
      <n-input v-model:value="templateName" size="small" placeholder="模板名称" class="template-name" />
      <n-button size="small" secondary @click="saveTemplate">保存模板
      </n-button>
    </div>

    <n-alert v-if="hasSensitiveData" class="security-alert" type="warning" :show-icon="false">
      当前请求包含敏感字段。请求历史、模板和环境变量会保存在本机浏览器存储中，请勿在共享设备上保存凭据。
    </n-alert>

    <div class="session-auth-panel">
      <div class="section-head">
        <strong>会话认证</strong>
        <span class="environment-hint">登录响应后自动提取 Token，并注入后续请求</span>
        <n-switch v-model:value="sessionAuth.enabled" size="small" />
        <n-button v-if="sessionAuth.token" size="tiny" quaternary @click="sessionAuth.token = ''">清空 Token</n-button>
      </div>
      <div class="session-auth-fields">
        <n-input v-model:value="sessionAuth.responsePath" size="small" placeholder="响应路径，例如 $.tokenValue" />
        <n-input v-model:value="sessionAuth.headerName" size="small" placeholder="请求头名称，例如 Authorization" />
        <n-input v-model:value="sessionAuth.prefix" size="small" placeholder="前缀，例如 Bearer " />
        <n-input :value="sessionAuth.token" size="small" type="password" show-password-on="click" readonly :placeholder="sessionAuth.enabled ? '等待登录响应提取 Token' : '会话认证未启用'" />
      </div>
    </div>

    <div class="http-layout">
      <section class="request-panel">
        <div class="panel-tabs">
          <button :class="{ active: requestTab === 'params' }" type="button" @click="requestTab = 'params'">Params <b>{{ query.filter((item) => item.enabled && item.key).length }}</b></button>
          <button :class="{ active: requestTab === 'body' }" type="button" @click="requestTab = 'body'">Body</button>
          <button :class="{ active: requestTab === 'headers' }" type="button" @click="requestTab = 'headers'">Headers <b>{{ headers.filter((item) => item.enabled && item.key).length }}</b></button>
          <button :class="{ active: requestTab === 'cookies' }" type="button" @click="requestTab = 'cookies'">Cookies</button>
          <button :class="{ active: requestTab === 'auth' }" type="button" @click="requestTab = 'auth'">Auth</button>
          <span class="tab-spacer"></span><span>设置</span>
        </div>
        <div v-if="requestTab === 'params'" class="config-section">
          <div class="section-head"><strong>Query 参数</strong><n-button size="tiny" quaternary :render-icon="() => renderIcon(Plus)" aria-label="添加 Query 参数" title="添加 Query 参数" @click="addQuery" /></div>
          <div v-for="item in rowColumns(query)" :key="item.id" class="key-value-row">
            <input v-model="item.enabled" type="checkbox" aria-label="启用参数" />
            <n-input v-model:value="item.key" size="small" placeholder="参数名" />
            <n-input v-model:value="item.value" size="small" placeholder="参数值" />
            <n-button size="tiny" quaternary aria-label="删除参数" title="删除参数" :render-icon="() => renderIcon(Trash2)" @click="removeRow(query, item.id)" />
          </div>
        </div>
        <div v-if="requestTab === 'headers'" class="config-section">
          <div class="section-head"><strong>Headers</strong><n-button size="tiny" quaternary :render-icon="() => renderIcon(Plus)" aria-label="添加 Header" title="添加 Header" @click="addHeader" /></div>
          <div v-for="item in rowColumns(headers)" :key="item.id" class="key-value-row">
            <input v-model="item.enabled" type="checkbox" aria-label="启用 Header" />
            <n-input v-model:value="item.key" size="small" placeholder="Header 名称" />
            <n-input v-model:value="item.value" size="small" :type="isSensitiveKey(item.key) ? 'password' : 'text'" show-password-on="click" placeholder="Header 值" />
            <n-button size="tiny" quaternary aria-label="删除 Header" title="删除 Header" :render-icon="() => renderIcon(Trash2)" @click="removeRow(headers, item.id)" />
          </div>
        </div>
        <div v-if="requestTab === 'body'" class="body-section">
          <div class="body-section-head"><strong>请求 Body</strong><span class="required-mark">*</span></div>
          <div class="body-type-tabs" role="tablist" aria-label="Body 类型">
            <button v-for="option in bodyOptions" :key="option.value" type="button" role="tab" :aria-selected="bodyType === option.value" :class="{ active: bodyType === option.value }" @click="bodyType = option.value">{{ option.label }}</button>
          </div>
          <div v-if="bodyType === 'form-data' || bodyType === 'x-www-form-urlencoded'" class="body-fields">
            <div class="body-fields-head"><span></span><span>参数名</span><span>参数值</span><span>类型</span><span>说明</span><span></span></div>
            <div v-for="item in bodyFields" :key="item.id" class="body-field-row">
              <input v-model="item.enabled" type="checkbox" aria-label="启用 Body 参数" />
              <n-input v-model:value="item.key" size="small" placeholder="参数名" />
              <n-input v-model:value="item.value" size="small" placeholder="参数值" />
              <n-select value="string" size="small" :options="bodyFieldTypeOptions" />
              <n-input size="small" placeholder="说明" />
              <n-button size="tiny" quaternary aria-label="删除 Body 参数" title="删除 Body 参数" :render-icon="() => renderIcon(Trash2)" @click="removeRow(bodyFields, item.id)" />
            </div>
            <button type="button" class="body-add-row" @click="addBodyField">添加参数</button>
          </div>
          <CodeEditor v-else-if="bodyType !== 'none'" v-model="body" :language="bodyType === 'xml' ? 'xml' : 'json'" placeholder="输入请求 Body" />
          <div v-else class="body-empty">当前请求不包含 Body</div>
        </div>
        <div v-if="requestTab === 'auth'" class="auth-tab-panel">
          <div class="section-head"><strong>会话认证</strong><span class="environment-hint">从登录响应提取 Token，并自动注入后续请求</span><n-switch v-model:value="sessionAuth.enabled" size="small" /></div>
          <div class="auth-tab-fields">
            <n-input v-model:value="sessionAuth.responsePath" size="small" placeholder="响应路径，例如 $.tokenValue" />
            <n-input v-model:value="sessionAuth.headerName" size="small" placeholder="请求头名称，例如 Authorization" />
            <n-input v-model:value="sessionAuth.prefix" size="small" placeholder="前缀，例如 Bearer " />
            <n-input :value="sessionAuth.token" size="small" type="password" show-password-on="click" readonly :placeholder="sessionAuth.enabled ? '等待登录响应提取 Token' : '会话认证未启用'" />
          </div>
          <div class="auth-tab-footer">
            <span>{{ sessionAuth.token ? '当前会话已获取 Token' : '发送登录请求后可自动提取 Token' }}</span>
            <n-button v-if="sessionAuth.token" size="tiny" quaternary aria-label="清空 Token" title="清空 Token" :render-icon="() => renderIcon(Trash2)" @click="sessionAuth.token = ''" />
          </div>
        </div>
        <div v-if="requestTab === 'cookies'" class="empty-tab-panel"><strong>Cookies</strong><span>当前可在 Headers 中添加 Cookie 请求头。</span></div>
        <div v-if="requestTab === 'params'" class="request-options"><span>超时</span><n-input-number v-model:value="timeoutMs" size="small" :min="100" :max="120000" :step="1000" :show-button="false" class="timeout-input" /><span>ms</span></div>
      </section>

      <section class="response-panel">
        <header class="response-head"><div><h2>响应</h2><span v-if="response">{{ response.size }} bytes · {{ response.durationMs }} ms</span></div><n-space :size="5"><n-tag v-if="response" :type="response.status >= 400 ? 'error' : 'success'" :bordered="false" size="small">{{ response.status }} {{ response.statusText }}</n-tag><n-button size="tiny" secondary :disabled="!response" :render-icon="() => renderIcon(Copy)" @click="copyText(responseBody)">复制</n-button><n-button size="tiny" secondary :disabled="!response" @click="clearResponse">清空</n-button></n-space></header>
        <div v-if="error" class="response-error"><ToolState type="error" title="请求失败" :detail="error" compact /></div>
        <template v-else-if="response">
          <div class="response-meta"><span>Headers {{ responseHeaders.length }}</span><span>{{ response.truncated ? "响应已截断" : "完整响应" }}</span></div>
          <div class="response-headers"><div v-for="([key, value]) in responseHeaders" :key="key"><code>{{ key }}</code><span>{{ value }}</span></div></div>
          <CodeEditor :model-value="responseBody" language="json" readonly placeholder="空响应" />
        </template>
        <ToolState v-else title="暂无响应" detail="配置请求后点击发送" />
      </section>
    </div>
    </div>
      </main>
    </div>
  </section>
</template>

<style scoped src="../features/http-client/http-client.css"></style>
