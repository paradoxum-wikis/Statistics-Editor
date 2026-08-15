import {
  Decoration,
  MatchDecorator,
  ViewPlugin,
  type DecorationSet,
  type EditorView,
  type ViewUpdate,
} from "@codemirror/view";
import type { Extension, Text } from "@codemirror/state";
import {
  DIR_RE,
  DOT_RE,
  imageCol,
  isKnownFn,
  parseRef,
  type DollarRef,
} from "./tokens";

function ignoredAt(doc: Text, pos: number): boolean {
  const slice = doc.sliceString(0, pos);
  const cOpen = slice.lastIndexOf("<!--");
  if (cOpen >= 0 && slice.indexOf("-->", cOpen + 4) < 0) return true;
  const nOpen = slice.toLowerCase().lastIndexOf("<nowiki");
  return nOpen >= 0 && !/<\/nowiki>/i.test(slice.slice(nOpen));
}

function inDollar(doc: Text, pos: number): boolean {
  const line = doc.lineAt(pos);
  const t = line.text;
  const local = pos - line.from;
  let i = 0;
  while (i < t.length) {
    if (t[i] !== "$") {
      i++;
      continue;
    }
    const close = t.indexOf("$", i + 1);
    if (close < 0) return local >= i;
    if (local >= i && local <= close) return true;
    i = close + 1;
  }
  return false;
}

function classFor(ref: DollarRef): string {
  if (
    (ref.kind === "fnc" || ref.kind === "fse") &&
    !isKnownFn(ref.prefix!, ref.name!)
  ) {
    return "nt-err";
  }
  if (ref.kind === "fnc") return "nt-fnc";
  if (ref.kind === "fse") return "nt-fse";
  if (ref.base.includes(".")) return "nt-dot";
  return "nt-var";
}

const mark = (cls: string) => Decoration.mark({ class: cls });

const dollarDecorator = new MatchDecorator({
  regexp: /\$([^$\n]*)\$/g,
  decorate(add, from, to, match, view) {
    if (ignoredAt(view.state.doc, from)) return;
    const ref = parseRef(from, to, match[1]);
    add(from, to, mark(classFor(ref)));
    const i = ref.base.indexOf(".");
    if (i >= 0) add(from + 1 + i, from + 2 + i, mark("nt-pin"));
    if (ref.pinLevel !== undefined) {
      add(from + 1 + ref.base.length, to - 1, mark("nt-pin"));
    }
  },
});

const dotDecorator = new MatchDecorator({
  regexp: new RegExp(DOT_RE.source, "g"),
  decorate(add, from, to, match, view) {
    if (
      imageCol(match[2]) ||
      ignoredAt(view.state.doc, from) ||
      inDollar(view.state.doc, from)
    ) {
      return;
    }
    add(from, to, mark("nt-dot"));
    const dot = from + match[1].length;
    add(dot, dot + 1, mark("nt-pin"));
  },
});

const dirDecorator = new MatchDecorator({
  regexp: new RegExp(DIR_RE.source, "gi"),
  decoration: Decoration.mark({ class: "nt-dir" }),
});

function decoPlugin(decorator: MatchDecorator): Extension {
  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;

      constructor(view: EditorView) {
        this.decorations = decorator.createDeco(view);
      }

      update(update: ViewUpdate) {
        this.decorations = decorator.updateDeco(update, this.decorations);
      }
    },
    { decorations: (v) => v.decorations },
  );
}

export const neowtextHighlight: Extension = [
  decoPlugin(dollarDecorator),
  decoPlugin(dotDecorator),
  decoPlugin(dirDecorator),
];
