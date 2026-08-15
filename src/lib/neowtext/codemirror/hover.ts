import { hoverTooltip } from "@codemirror/view";
import type { Extension } from "@codemirror/state";
import { describeRef, helpHash, helpUrl, kindLabel } from "./docs";
import { isVarDeclaration, refAt, varBinding } from "./tokens";

export const neowtextHover: Extension = hoverTooltip((view, pos) => {
  const doc = view.state.doc.toString();
  const ref = refAt(doc, pos);
  if (!ref) return null;
  const held =
    ref.kind === "var" && !isVarDeclaration(doc, ref)
      ? varBinding(doc, ref.inner)
      : undefined;
  return {
    pos: ref.from,
    end: ref.to,
    above: true,
    create() {
      const dom = document.createElement("div");
      dom.className = "cm-tooltip-neowtext";
      const name = document.createElement("strong");
      name.textContent = `$${ref.inner}$`;
      const kind = document.createElement("small");
      kind.textContent = kindLabel(ref);
      const summary = document.createElement("p");
      if (held !== undefined) {
        summary.className = "value";
        summary.textContent = held;
      } else {
        summary.textContent = describeRef(ref);
      }
      const link = document.createElement("a");
      link.href = helpUrl(ref);
      link.target = "_blank";
      link.rel = "noopener";
      link.textContent = `Help:Neowtext#${helpHash(ref)}`;
      dom.append(name, kind, summary, link);
      return { dom };
    },
  };
});
