import { linter } from "@codemirror/lint";
import { EditorView } from "@codemirror/view";
import type { Extension } from "@codemirror/state";
import { neowtextHighlight } from "./highlight";
import { lintNeowtext } from "./lint";
import { neowtextHover } from "./hover";

const neowtextLinter: Extension = linter((view) =>
	lintNeowtext(view.state.doc.toString()),
);

const neowtextTheme = EditorView.theme({
	".nt-var, .nt-fnc, .nt-fse, .nt-dir, .nt-err": {
		fontWeight: "600",
	},
	".nt-var": { color: "oklch(0.52 0.17 250)" },
	".nt-dot": { color: "oklch(0.50 0.07 250)" },
	".nt-fnc": { color: "oklch(0.50 0.16 148)" },
	".nt-fse": { color: "oklch(0.55 0.19 330)" },
	".nt-dir, .nt-dir *": { color: "oklch(0.55 0.22 55)" },
	".nt-err": { color: "oklch(0.55 0.20 25)" },
	".nt-pin": { color: "oklch(0.50 0.02 250 / 0.65)" },
	".nt-tip": {
		padding: ".4rem .55rem",
		maxWidth: "22rem",
		fontSize: ".7rem",
		lineHeight: "1.35",
		"& strong": {
			display: "block",
			fontFamily: "ui-monospace, monospace",
		},
		"& small": {
			display: "block",
			color: "oklch(0.50 0.02 250 / 0.75)",
			fontSize: ".65rem",
			margin: ".1rem 0 .25rem",
		},
		"& p, & code": {
			margin: "0 0 .35rem",
			whiteSpace: "pre-wrap",
		},
		"& code": { display: "block" },
		"& a": { color: "oklch(0.52 0.14 250)" },
	},
});

export const neowtextSupport: Extension = [
	neowtextTheme,
	neowtextHighlight,
	neowtextLinter,
	neowtextHover,
];
