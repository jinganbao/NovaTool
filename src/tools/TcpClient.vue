<script setup lang="ts">
import { NButton, NInput, NSelect, NSpace, NTag } from "naive-ui";
import {
  BookmarkPlus,
  ChevronDown,
  ChevronRight,
  Copy,
  Link,
  Play,
  Plus,
  Save,
  Trash2,
  Unlink,
  Wand2,
} from "lucide-vue-next";
import CodeEditor from "@/components/editor/CodeEditor.vue";
import { useTcpClient } from "@/features/tcp-client/useTcpClient";
import { renderIcon } from "@/utils/render";

const {
  connId,
  connecting,
  disconnecting,
  host,
  port,
  connectionName,
  mode,
  timeoutMs,
  selectedConnectionId,
  connectionOptions,
  payload,
  sending,
  selectedPayloadId,
  payloadName,
  payloadOptions,
  showTemplate,
  templateFields,
  templateSuffix,
  templateResult,
  receiveMode,
  receiveLog,
  receiveRef,
  copyText,
  connect,
  disconnect,
  applyConnection,
  saveConnection,
  deleteConnection,
  applySavedPayload,
  savePayload,
  deletePayload,
  addTemplateField,
  removeTemplateField,
  fillTemplateToPayload,
  sendPayload,
} = useTcpClient();
</script>


<template>
  <section class="tool-panel tcp-client">
    <!-- ========== 顶部：连接配置 ========== -->
    <div class="conn-bar">
      <div class="conn-form">
        <div class="field field-wide">
          <span class="field-label">常用连接</span>
          <n-select
            v-model:value="selectedConnectionId"
            size="small"
            clearable
            placeholder="选择常用连接"
            :options="connectionOptions"
            class="conn-select"
            @update:value="applyConnection"
          />
        </div>
        <label class="field">
          <span class="field-label">名称</span>
          <n-input v-model:value="connectionName" size="small" />
        </label>
        <label class="field">
          <span class="field-label">Host</span>
          <n-input v-model:value="host" size="small" />
        </label>
        <label class="field">
          <span class="field-label">Port</span>
          <n-input v-model:value="port" size="small" @keyup.enter="sendPayload" />
        </label>
        <label class="field">
          <span class="field-label">编码</span>
          <n-select
            v-model:value="mode"
            size="small"
            :options="[
              { label: 'UTF-8', value: 'utf8' },
              { label: 'HEX', value: 'hex' },
            ]"
          />
        </label>
        <label class="field field-tight">
          <span class="field-label">超时(ms)</span>
          <n-input v-model:value="timeoutMs" size="small" />
        </label>
      </div>

      <div class="conn-actions">
        <n-space :size="6">
          <n-button size="tiny" secondary :render-icon="() => renderIcon(Save)" @click="saveConnection"
            >保存</n-button
          >
          <n-button
            size="tiny"
            quaternary
            :render-icon="() => renderIcon(Trash2)"
            @click="deleteConnection"
          />
        </n-space>
        <n-space :size="6">
          <n-button
            v-if="!connId"
            size="tiny"
            type="primary"
            :loading="connecting"
            :render-icon="() => renderIcon(Link)"
            @click="connect"
            >连接</n-button
          >
          <n-button
            v-else
            size="tiny"
            type="warning"
            :loading="disconnecting"
            :render-icon="() => renderIcon(Unlink)"
            @click="disconnect"
            >断开</n-button
          >
          <n-tag v-if="connId" type="success" :bordered="false" size="small">
            <template #icon>
              <span class="conn-status-dot"></span>
            </template>
            已连接
          </n-tag>
        </n-space>
      </div>
    </div>

    <!-- ========== 中部：发送区 ========== -->
    <div class="send-section">
      <div class="section-head">
        <span class="section-title">发送内容</span>
        <div class="section-actions">
          <n-input
            v-model:value="payloadName"
            size="small"
            placeholder="输入名称"
            class="payload-name"
          />
          <n-select
            v-model:value="selectedPayloadId"
            size="small"
            clearable
            placeholder="常用输入"
            :options="payloadOptions"
            class="payload-select"
            @update:value="applySavedPayload"
          />
          <n-button
            size="tiny"
            secondary
            :render-icon="() => renderIcon(BookmarkPlus)"
            @click="savePayload"
            >保存</n-button
          >
          <n-button
            size="tiny"
            quaternary
            :render-icon="() => renderIcon(Trash2)"
            @click="deletePayload"
          />
          <div class="action-divider"></div>
          <!-- 模板折叠按钮 -->
          <n-button
            size="tiny"
            secondary
            :render-icon="() => renderIcon(showTemplate ? ChevronDown : ChevronRight)"
            @click="showTemplate = !showTemplate"
            >模板</n-button
          >
          <n-button
            size="tiny"
            type="primary"
            :loading="sending"
            :render-icon="() => renderIcon(Play)"
            @click="sendPayload"
            >{{ connId ? '发送(长连接)' : '发送' }}</n-button
          >
        </div>
      </div>

      <!-- 模板展开区 -->
      <div v-if="showTemplate" class="template-panel">
        <div class="template-fields">
          <div v-for="field in templateFields" :key="field.id" class="template-row">
            <n-input v-model:value="field.key" size="small" placeholder="字段名" />
            <n-input
              v-model:value="field.value"
              size="small"
              placeholder="字段值"
              @keyup.enter="fillTemplateToPayload"
            />
            <n-button
              size="tiny"
              quaternary
              :render-icon="() => renderIcon(Trash2)"
              @click="removeTemplateField(field.id)"
            />
          </div>
        </div>
        <div class="template-actions">
          <button class="add-row" type="button" @click="addTemplateField">
            <Plus :size="13" />
            添加字段
          </button>
          <label class="template-suffix-label"
            >后缀
            <n-input
              v-model:value="templateSuffix"
              size="small"
              class="template-suffix-input"
              @keyup.enter="fillTemplateToPayload"
            />
          </label>
          <code class="template-preview">{{ templateResult }}</code>
          <n-button
            size="tiny"
            type="primary"
            :render-icon="() => renderIcon(Wand2)"
            @click="fillTemplateToPayload"
            >填充到编辑器</n-button
          >
        </div>
      </div>

      <CodeEditor v-model="payload" language="plain" placeholder="输入 TCP 发送内容..." />
    </div>

    <!-- ========== 底部：接收区 ========== -->
    <div class="receive-section">
      <div class="section-head">
        <span class="section-title">接收内容</span>
        <div class="section-actions">
          <n-select
            v-model:value="receiveMode"
            size="small"
            :options="[
              { label: '文本', value: 'text' },
              { label: 'HEX', value: 'hex' },
            ]"
            class="receive-mode"
          />
          <n-button
            size="tiny"
            secondary
            :render-icon="() => renderIcon(Copy)"
            @click="copyText(receiveLog)"
            >复制</n-button
          >
          <n-button size="tiny" secondary @click="receiveLog = ''">清空</n-button>
        </div>
      </div>
      <pre ref="receiveRef" class="receive-log">{{ receiveLog || "等待接收数据..." }}</pre>
    </div>
  </section>
</template>

<style scoped src="../features/tcp-client/tcp-client.css"></style>
