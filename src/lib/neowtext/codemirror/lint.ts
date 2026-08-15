import { linter, type Diagnostic } from "@codemirror/lint";
import type { Extension } from "@codemirror/state";
import {
  deprecatedFn,
  isKnownFn,
  scanDollarRefs,
  scanUnclosedDollars,
  scanVarTags,
} from "./tokens";

export function lintNeowtext(text: string): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  for (const { from, to } of scanUnclosedDollars(text)) {
    diagnostics.push({
      from,
      to,
      severity: "error",
      source: "neowtext",
      message: "Unclosed $...$.",
    });
  }

  for (const ref of scanDollarRefs(text)) {
    if (ref.empty) {
      diagnostics.push({
        from: ref.from,
        to: ref.to,
        severity: "error",
        source: "neowtext",
        message: "Empty $...$.",
      });
      continue;
    }
    if (ref.pinError) {
      diagnostics.push({
        from: ref.from,
        to: ref.to,
        severity: "error",
        source: "neowtext",
        message: ref.pinError,
      });
    }
    if (
      (ref.kind === "fnc" || ref.kind === "fse") &&
      !isKnownFn(ref.prefix!, ref.name!)
    ) {
      diagnostics.push({
        from: ref.from,
        to: ref.to,
        severity: "error",
        source: "neowtext",
        message: `Unknown ${ref.prefix} "${ref.name}".`,
      });
    } else {
      const deprecated = deprecatedFn(ref);
      if (deprecated) {
        diagnostics.push({
          from: ref.from,
          to: ref.to,
          severity: "warning",
          source: "neowtext",
          message: deprecated,
        });
      }
    }
  }

  const tags = scanVarTags(text);
  let depth = 0;
  let lastOpen = -1;
  for (const tag of tags) {
    if (tag.open) {
      depth++;
      lastOpen = tag.from;
    } else if (depth === 0) {
      diagnostics.push({
        from: tag.from,
        to: tag.to,
        severity: "error",
        source: "neowtext",
        message: "Unexpected </var> with no open <var>.",
      });
    } else {
      depth--;
    }
  }
  if (depth > 0 && lastOpen >= 0) {
    diagnostics.push({
      from: lastOpen,
      to: lastOpen + 5,
      severity: "error",
      source: "neowtext",
      message: "Unclosed <var> block.",
    });
  }

  return diagnostics;
}

export const neowtextLinter: Extension = linter((view) =>
  lintNeowtext(view.state.doc.toString()),
);
