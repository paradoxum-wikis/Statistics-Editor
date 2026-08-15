import { EditorView } from "@codemirror/view";
import type { Extension } from "@codemirror/state";
import { neowtextHighlight } from "./highlight";
import { neowtextLinter } from "./lint";
import { neowtextHover } from "./hover";

const neowtextTheme = EditorView.theme({
  ".nt-var, .nt-fnc, .nt-fse, .nt-err": {
    fontWeight: "600",
  },
  ".nt-var": { color: "oklch(0.52 0.17 250)" },
  ".nt-fnc": { color: "oklch(0.50 0.16 148)" },
  ".nt-fse": { color: "oklch(0.55 0.19 330)" },
  ".nt-err": { color: "oklch(0.55 0.20 25)" },
  ".nt-pin": { color: "oklch(0.50 0.02 250 / 0.65)" },
  ".cm-tooltip-neowtext": {
    padding: ".4rem .55rem",
    maxWidth: "22rem",
    fontSize: ".7rem",
    lineHeight: "1.35",
  },
  ".cm-tooltip-neowtext strong": {
    display: "block",
    fontFamily: "ui-monospace, monospace",
  },
  ".cm-tooltip-neowtext small": {
    display: "block",
    color: "var(--muted-foreground)",
    fontSize: ".65rem",
    margin: ".1rem 0 .25rem",
  },
  ".cm-tooltip-neowtext p": {
    margin: "0 0 .35rem",
    whiteSpace: "pre-wrap",
  },
  ".cm-tooltip-neowtext p.value": {
    fontFamily: "ui-monospace, monospace",
  },
  ".cm-tooltip-neowtext a": { color: "var(--link)" },
});

export const neowtextSupport: Extension = [
  neowtextTheme,
  neowtextHighlight,
  neowtextLinter,
  neowtextHover,
];
