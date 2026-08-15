import {
  Decoration,
  MatchDecorator,
  ViewPlugin,
  type DecorationSet,
  type EditorView,
  type ViewUpdate,
} from "@codemirror/view";
import type { Extension, Text } from "@codemirror/state";
import { isKnownFn, parseRef, type DollarRef } from "./tokens";

function ignoredAt(doc: Text, pos: number): boolean {
  const from = Math.max(0, pos - 16000);
  const slice = doc.sliceString(from, pos);
  const cOpen = slice.lastIndexOf("<!--");
  if (cOpen >= 0 && slice.indexOf("-->", cOpen + 4) < 0) return true;
  const lower = slice.toLowerCase();
  const nOpen = lower.lastIndexOf("<nowiki");
  return nOpen >= 0 && !/<\/nowiki>/i.test(slice.slice(nOpen));
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
  return "nt-var";
}

const mark = (cls: string) => Decoration.mark({ class: cls });

const decorator = new MatchDecorator({
  regexp: /\$([^$\n]*)\$/g,
  decorate(add, from, to, match, view) {
    if (ignoredAt(view.state.doc, from)) return;
    const ref = parseRef(from, to, match[1]);
    add(from, to, mark(classFor(ref)));
    if (ref.pinLevel !== undefined) {
      add(from + 1 + ref.base.length, to - 1, mark("nt-pin"));
    }
  },
});

export const neowtextHighlight: Extension = ViewPlugin.fromClass(
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
