<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { json } from "@codemirror/lang-json";
import { xml } from "@codemirror/lang-xml";
import { oneDark } from "@codemirror/theme-one-dark";
import { Decoration, DecorationSet, EditorView, keymap } from "@codemirror/view";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { bracketMatching, foldGutter, indentOnInput, syntaxHighlighting, defaultHighlightStyle } from "@codemirror/language";
import { highlightActiveLine, highlightActiveLineGutter, lineNumbers } from "@codemirror/view";
import { EditorState, StateEffect, StateField } from "@codemirror/state";
import { Codemirror } from "vue-codemirror-next";
import { useConfig } from "@/composables/useConfig";

type CodeLanguage = "json" | "xml" | "plain";

export interface LineDecoration {
  from: number;  // 1-based line number
  to: number;    // 1-based line number (inclusive)
  class: string; // CSS class
}

const props = withDefaults(defineProps<{
  modelValue: string;
  language?: CodeLanguage;
  readonly?: boolean;
  placeholder?: string;
  lineDecorations?: LineDecoration[];
}>(), {
  language: "plain",
  readonly: false,
  placeholder: "",
  lineDecorations: () => [],
});

const emit = defineEmits<{ "update:modelValue": [value: string] }>();
const config = useConfig();

/* ---- 拿到底层 EditorView，外部程序化修改 modelValue 时直接 dispatch 同步 ---- */
const editorView = ref<EditorView | null>(null);

function onReady(payload: { view: EditorView }) {
  editorView.value = payload.view;
  // 若挂载前 lineDecorations 已设置，立即应用
  if (props.lineDecorations.length > 0) {
    payload.view.dispatch({
      effects: setLineDecos.of(buildLineDecorations(props.lineDecorations)),
    });
  }
}

watch(
  () => props.modelValue,
  (newValue) => {
    const view = editorView.value;
    if (!view) return;
    const current = view.state.doc.toString();
    if (newValue !== current) {
      view.dispatch({
        changes: { from: 0, to: current.length, insert: newValue },
      });
    }
  },
  { flush: "sync" },
);

/* ---- 行装饰 ---- */
const setLineDecos = StateEffect.define<DecorationSet>();

const lineDecoField = StateField.define<DecorationSet>({
  create() {
    return Decoration.none;
  },
  update(decos, tr) {
    for (const e of tr.effects) {
      if (e.is(setLineDecos)) return e.value;
    }
    return decos.map(tr.changes);
  },
  provide: (f) => EditorView.decorations.from(f),
});

function buildLineDecorations(decos: LineDecoration[]): DecorationSet {
  const state = editorView.value?.state;
  if (!state) return Decoration.none;
  const marks: any[] = [];
  const doc = state.doc;
  for (const d of decos) {
    for (let lineNum = d.from; lineNum <= d.to; lineNum++) {
      if (lineNum < 1 || lineNum > doc.lines) continue;
      const line = doc.line(lineNum);
      marks.push(Decoration.line({ attributes: { class: d.class } }).range(line.from));
    }
  }
  return Decoration.set(marks, true);
}

watch(
  () => props.lineDecorations,
  (decos) => {
    const view = editorView.value;
    if (!view) return;
    view.dispatch({
      effects: setLineDecos.of(buildLineDecorations(decos ?? [])),
    });
  },
  { deep: true },
);

/* ---- 用户输入时通知父组件 ---- */
function onUpdate(value: string) {
  emit("update:modelValue", value);
}

/* ---- CodeMirror 扩展 ---- */
const extensions = computed(() => {
  const languageExtension = props.language === "json" ? json() : props.language === "xml" ? xml() : [];
  return [
    lineNumbers(),
    foldGutter(),
    highlightActiveLineGutter(),
    highlightActiveLine(),
    history(),
    indentOnInput(),
    bracketMatching(),
    syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
    keymap.of([...defaultKeymap, ...historyKeymap]),
    EditorView.lineWrapping,
    EditorState.readOnly.of(props.readonly),
    EditorView.editable.of(!props.readonly),
    lineDecoField,
    ...(config.themeMode === "dark" ? [oneDark] : []),
    languageExtension,
  ];
});
</script>

<template>
  <div class="code-editor" :class="{ readonly }">
    <Codemirror
      :modelValue="modelValue"
      :extensions="extensions"
      :placeholder="placeholder"
      :disabled="readonly"
      class="cm-host"
      @update:modelValue="onUpdate"
      @ready="onReady"
    />
  </div>
</template>

<style scoped>
.code-editor {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  border: 1px solid var(--border-subtle);
  border-radius: 6px;
  background: var(--bg-input);
}

.cm-host {
  height: 100%;
}

.code-editor :deep(.cm-editor) {
  height: 100%;
  background: var(--bg-input);
  color: var(--text-primary);
  font-size: 12px;
  line-height: 1.55;
  outline: none;
}

.code-editor :deep(.cm-scroller) {
  font-family: "SFMono-Regular", Consolas, "Liberation Mono", monospace;
}

.code-editor :deep(.cm-gutters) {
  background: var(--bg-panel-hover);
  border-right: 1px solid var(--border-subtle);
  color: var(--text-muted);
}

.code-editor :deep(.cm-activeLine),
.code-editor :deep(.cm-activeLineGutter) {
  background: rgba(61, 214, 198, 0.06);
}

.code-editor :deep(.cm-focused) {
  outline: 1px solid rgba(61, 214, 198, 0.7);
}

.code-editor.readonly :deep(.cm-cursor) {
  display: none;
}
</style>
