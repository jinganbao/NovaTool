<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { json } from "@codemirror/lang-json";
import { xml } from "@codemirror/lang-xml";
import { oneDark } from "@codemirror/theme-one-dark";
import { Decoration, DecorationSet, EditorView, keymap } from "@codemirror/view";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { bracketMatching, foldEffect, foldGutter, foldable, indentOnInput, syntaxHighlighting, defaultHighlightStyle, unfoldAll, unfoldCode } from "@codemirror/language";
import { highlightActiveLine, highlightActiveLineGutter, lineNumbers } from "@codemirror/view";
import { EditorState, StateEffect, StateField } from "@codemirror/state";
import { Codemirror } from "vue-codemirror";
import { useConfig, resolvedThemeMode } from "@/composables/useConfig";

type CodeLanguage = "json" | "xml" | "plain";

export interface LineDecoration {
  from: number;  // 1-based line number
  to: number;    // 1-based line number (inclusive)
  class: string; // CSS class
}

export interface InlineMark {
  line: number;      // 1-based line number
  from: number;      // 0-based char offset within the line
  to: number;        // 0-based char offset within the line (exclusive)
  class: string;     // CSS class
}

const props = withDefaults(defineProps<{
  modelValue: string;
  language?: CodeLanguage;
  readonly?: boolean;
  placeholder?: string;
  lineDecorations?: LineDecoration[];
  inlineMarks?: InlineMark[];
  searchQuery?: string;
}>(), {
  language: "plain",
  readonly: false,
  placeholder: "",
  lineDecorations: () => [],
  inlineMarks: () => [],
  searchQuery: "",
});

const emit = defineEmits<{
  "update:modelValue": [value: string];
  "search-change": [{ count: number; index: number }];
  shortcut: [action: "clear" | "execute"];
}>();
const config = useConfig();

/* ---- 拿到底层 EditorView，外部程序化修改 modelValue 时直接 dispatch 同步 ---- */
const editorView = ref<EditorView | null>(null);

function onReady(payload: { view: EditorView }) {
  editorView.value = payload.view;
  // 若挂载前装饰已设置，立即应用
  if (props.lineDecorations.length > 0) {
    payload.view.dispatch({
      effects: setLineDecos.of(buildLineDecorations(props.lineDecorations)),
    });
  }
  if (props.inlineMarks.length > 0) {
    payload.view.dispatch({
      effects: setInlineDecos.of(buildInlineDecorations(props.inlineMarks)),
    });
  }
  applySearch(0);
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
      applySearch(searchIndex.value);
    }
  },
  { flush: "sync" },
);

/* ---- 搜索高亮与定位 ---- */
type SearchState = { query: string; selected: number };
const setSearch = StateEffect.define<SearchState>();
const searchIndex = ref(0);
let searchTimer: ReturnType<typeof setTimeout> | null = null;

const searchDecoField = StateField.define<DecorationSet>({
  create() {
    return Decoration.none;
  },
  update(decos, tr) {
    for (const effect of tr.effects) {
      if (effect.is(setSearch)) return buildSearchDecorations(tr.state.doc, effect.value);
    }
    return decos.map(tr.changes);
  },
  provide: (field) => EditorView.decorations.from(field),
});

function searchMatches(view: EditorView, query: string): Array<{ from: number; to: number }> {
  const normalized = query.trim().toLocaleLowerCase();
  if (!normalized) return [];

  const source = view.state.doc.toString().toLocaleLowerCase();
  const matches: Array<{ from: number; to: number }> = [];
  let from = 0;
  while (from < source.length) {
    const index = source.indexOf(normalized, from);
    if (index < 0) break;
    matches.push({ from: index, to: index + normalized.length });
    from = index + normalized.length;
  }
  return matches;
}

function buildSearchDecorations(doc: EditorState["doc"], state: SearchState): DecorationSet {
  const query = state.query.trim().toLocaleLowerCase();
  if (!query) return Decoration.none;

  const source = doc.toString().toLocaleLowerCase();
  const marks = [];
  let from = 0;
  let matchIndex = 0;
  while (from < source.length) {
    const index = source.indexOf(query, from);
    if (index < 0) break;
    marks.push(
      Decoration.mark({ class: matchIndex === state.selected ? "cm-searchMatch-selected" : "cm-searchMatch" }).range(
        index,
        index + query.length,
      ),
    );
    matchIndex += 1;
    from = index + query.length;
  }
  return Decoration.set(marks, true);
}

function applySearch(index: number) {
  const view = editorView.value as EditorView | null;
  if (!view) return;
  const matches = searchMatches(view, props.searchQuery);
  if (matches.length === 0) {
    searchIndex.value = 0;
    view.dispatch({ effects: setSearch.of({ query: props.searchQuery, selected: 0 }) });
    emit("search-change", { count: 0, index: 0 });
    return;
  }

  searchIndex.value = (index + matches.length) % matches.length;
  const match = matches[searchIndex.value];
  // 搜索命中折叠内容时，只展开命中位置的祖先层级，保留其他节点的折叠状态。
  const previousSelection = view.state.selection;
  view.dispatch({ selection: { anchor: match.from } });
  for (let depth = 0; depth < 32 && unfoldCode(view); depth += 1) {
    // 一个位置可能嵌套在多层折叠范围内，逐层展开直到命中内容可见。
  }
  view.dispatch({ selection: previousSelection });
  view.dispatch({
    effects: [
      setSearch.of({ query: props.searchQuery, selected: searchIndex.value }),
      EditorView.scrollIntoView(match.from, { y: "center" }),
    ],
  });
  emit("search-change", { count: matches.length, index: searchIndex.value });
}

function nextSearch() {
  applySearch(searchIndex.value + 1);
}

function previousSearch() {
  applySearch(searchIndex.value - 1);
}

function foldAllLevels(view: EditorView): boolean {
  const effects = [];
  const ranges = new Set<string>();
  const doc = view.state.doc;

  // CodeMirror's built-in foldAll intentionally folds only top-level ranges.
  // Scan every line so nested JSON objects and arrays are folded as well.
  for (let pos = 0; pos < doc.length;) {
    const line = doc.lineAt(pos);
    const range = foldable(view.state, line.from, line.to);
    if (range) {
      const key = `${range.from}:${range.to}`;
      if (!ranges.has(key)) {
        ranges.add(key);
        effects.push(foldEffect.of(range));
      }
    }
    pos = line.to + 1;
  }

  if (effects.length === 0) return false;
  view.dispatch({ effects });
  return true;
}

watch(
  () => props.searchQuery,
  () => {
    if (searchTimer) clearTimeout(searchTimer);
    searchTimer = setTimeout(() => applySearch(0), 180);
  },
);

onBeforeUnmount(() => {
  if (searchTimer) clearTimeout(searchTimer);
});

defineExpose({
  nextSearch,
  previousSearch,
  foldAll: () => editorView.value && foldAllLevels(editorView.value as EditorView),
  unfoldAll: () => editorView.value && unfoldAll(editorView.value as EditorView),
});

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

/* ---- 行内字符标记装饰 ---- */
const setInlineDecos = StateEffect.define<DecorationSet>();

const inlineDecoField = StateField.define<DecorationSet>({
  create() {
    return Decoration.none;
  },
  update(decos, tr) {
    for (const e of tr.effects) {
      if (e.is(setInlineDecos)) return e.value;
    }
    return decos.map(tr.changes);
  },
  provide: (f) => EditorView.decorations.from(f),
});

function buildInlineDecorations(marks: InlineMark[]): DecorationSet {
  const state = editorView.value?.state;
  if (!state) return Decoration.none;
   
  const result: any[] = [];
  const doc = state.doc;
  for (const mark of marks) {
    if (mark.line < 1 || mark.line > doc.lines) continue;
    const line = doc.line(mark.line);
    const from = Math.min(line.from + mark.from, line.to);
    const to = Math.min(line.from + mark.to, line.to);
    if (from < to) {
      result.push(Decoration.mark({ class: mark.class }).range(from, to));
    }
  }
  return Decoration.set(result, true);
}

watch(
  () => props.inlineMarks,
  (marks) => {
    const view = editorView.value;
    if (!view) return;
    view.dispatch({
      effects: setInlineDecos.of(buildInlineDecorations(marks ?? [])),
    });
  },
  { deep: true },
);

/* ---- 用户输入时通知父组件 ---- */
function onUpdate(value: string) {
  emit("update:modelValue", value);
}

function clearEditor(view: EditorView): boolean {
  if (props.readonly) return false;
  view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: "" } });
  emit("update:modelValue", "");
  emit("shortcut", "clear");
  return true;
}

function executeEditor(): boolean {
  emit("shortcut", "execute");
  return true;
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
    keymap.of([
      { key: "Mod-l", run: clearEditor },
      { key: "Mod-Enter", run: executeEditor },
      ...defaultKeymap,
      ...historyKeymap,
    ]),
    EditorView.lineWrapping,
    EditorState.readOnly.of(props.readonly),
    EditorView.editable.of(!props.readonly),
    lineDecoField,
    inlineDecoField,
    searchDecoField,
    ...(resolvedThemeMode.value === "dark" ? [oneDark] : []),
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
      @update:model-value="onUpdate"
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
  font-size: v-bind(config.editorFontSize + "px");
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
  background: var(--brand-soft, rgba(61, 214, 198, 0.06));
}

.code-editor :deep(.cm-focused) {
  outline: 1px solid var(--brand, rgba(61, 214, 198, 0.7));
}

.code-editor :deep(.cm-selectionBackground),
.code-editor :deep(.cm-content ::selection) {
  background: color-mix(in srgb, var(--brand, #3dd6c6) 20%, transparent) !important;
}

.code-editor :deep(.cm-searchMatch) {
  background: color-mix(in srgb, var(--brand, #3dd6c6) 26%, transparent);
  border-radius: 2px;
}

.code-editor :deep(.cm-searchMatch-selected) {
  background: color-mix(in srgb, var(--brand, #3dd6c6) 58%, transparent);
  color: var(--text-primary);
  border-radius: 2px;
  outline: 1px solid color-mix(in srgb, var(--brand, #3dd6c6) 78%, transparent);
}

.code-editor.readonly :deep(.cm-cursor) {
  display: none;
}
</style>
