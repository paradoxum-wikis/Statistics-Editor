import {
  Decoration,
  MatchDecorator,
  ViewPlugin,
  type DecorationSet,
  type EditorView,
  type ViewUpdate,
} from "@codemirror/view";
import type { Extension, Text } from "@codemirror/state";
import { DIR_RE, isKnownFn, parseRef, type DollarRef } from "./tokens";

function ignoredAt(doc: Text, pos: number): boolean {
  const slice = doc.sliceString(0, pos);
  const cOpen = slice.lastIndexOf("<!--");
  if (cOpen >= 0 && slice.indexOf("-->", cOpen + 4) < 0) return true;
  const nOpen = slice.toLowerCase().lastIndexOf("<nowiki");
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

const dollarDecorator = new MatchDecorator({
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
  decoPlugin(dirDecorator),
];
