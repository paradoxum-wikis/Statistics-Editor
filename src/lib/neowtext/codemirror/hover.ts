import { hoverTooltip } from "@codemirror/view";
import type { Extension } from "@codemirror/state";
import {
  describeDirective,
  describeRef,
  directiveHelpHash,
  helpHash,
  helpLink,
  kindLabel,
} from "./docs";
import { directiveAt, dotAt, isVarDeclaration, refAt, varBinding } from "./tokens";

function tooltip(
  from: number,
  to: number,
  name: string,
  kind: string,
  body: string,
  hash: string,
  value = false,
) {
  return {
    pos: from,
    end: to,
    above: true,
    create() {
      const dom = document.createElement("div");
      dom.className = "nt-tip";
      const title = document.createElement("strong");
      title.textContent = name;
      const k = document.createElement("small");
      k.textContent = kind;
      const summary = document.createElement(value ? "code" : "p");
      summary.textContent = body;
      const link = document.createElement("a");
      link.href = helpLink(hash);
      link.target = "_blank";
      link.rel = "noopener";
      link.textContent = `Help:Neowtext#${hash}`;
      dom.append(title, k, summary, link);
      return { dom };
    },
  };
}

export const neowtextHover: Extension = hoverTooltip((view, pos) => {
  const doc = view.state.doc.toString();
  const dir = directiveAt(doc, pos);
  if (dir) {
    return tooltip(
      dir.from,
      dir.to,
      dir.raw,
      "Directive",
      describeDirective(dir),
      directiveHelpHash(dir),
    );
  }
  const ref = refAt(doc, pos) ?? dotAt(doc, pos);
  if (!ref) return null;
  const held =
    ref.kind === "var" && !isVarDeclaration(doc, ref)
      ? varBinding(doc, ref.inner)
      : undefined;
  return tooltip(
    ref.from,
    ref.to,
    doc[ref.from] === "$" ? `$${ref.inner}$` : ref.base,
    kindLabel(ref),
    held !== undefined ? held : describeRef(ref),
    helpHash(ref),
    held !== undefined,
  );
});
