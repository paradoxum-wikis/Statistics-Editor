<script lang="ts">
  import { renderCellHtml } from "$lib/neowtext/render";
  import { stripRefs } from "$lib/utils/format";
  import Tip from "../smol/Tip.svelte";
  import RenderedHtml from "./RenderedHtml.svelte";

  type Part =
    | { kind: "text"; text: string }
    | { kind: "ref"; content: string; name: string | null };

  let {
    value,
    readOnly,
    tokens = {},
    getRefNum,
  }: {
    value: string | number | null | undefined;
    readOnly: boolean;
    tokens?: Record<string, string>;
    getRefNum: (content: string, name?: string | null) => number;
  } = $props();

  function refMeta(
    tok: string,
  ): { content: string; name: string | null } | null {
    const def = tokens[tok];
    if (typeof def !== "string") return null;
    if (!/<ref\b/i.test(def) || stripRefs(def).trim()) return null;
    const m = def.trim().match(/^<ref\s*([^>]*)>([\s\S]*?)<\/ref>\s*$/i);
    if (!m) return null;
    const name = m[1].match(/name\s*=\s*["']?([^"'\s>]+)/i)?.[1] ?? null;
    return { content: m[2], name };
  }

  function splitParts(val: string | number | null | undefined): Part[] {
    if (val === undefined || val === null) return [];
    if (typeof val === "number") return [{ kind: "text", text: String(val) }];

    const s = String(val);
    const re =
      /<ref\b([^>]*)>([\s\S]*?)<\/ref>|<ref\b([^>]*)\/>|\$([A-Z0-9_-]+)\$/gi;
    const out: Part[] = [];
    let last = 0;
    let m: RegExpExecArray | null;

    while ((m = re.exec(s)) !== null) {
      if (m.index > last) {
        out.push({ kind: "text", text: s.slice(last, m.index) });
      }

      if (m[0].startsWith("$")) {
        const meta = refMeta(m[0]);
        if (meta)
          out.push({ kind: "ref", content: meta.content, name: meta.name });
        else out.push({ kind: "text", text: m[0] });
      } else if (m[2] !== undefined) {
        const name =
          (m[1] || "").match(/name\s*=\s*["']?([^"'\s>]+)/i)?.[1] ?? null;
        out.push({ kind: "ref", content: m[2], name });
      } else {
        const name =
          (m[3] || "").match(/name\s*=\s*["']?([^"'\s>]+)/i)?.[1] ?? null;
        out.push({ kind: "ref", content: "", name });
      }

      last = m.index + m[0].length;
    }

    if (last < s.length) out.push({ kind: "text", text: s.slice(last) });
    if (!out.length) out.push({ kind: "text", text: s });
    return out;
  }

  const parts = $derived(splitParts(value));
</script>

{#each parts as part, i (`${i}:${part.kind}`)}
  {#if part.kind === "text"}
    {#if part.text}
      <RenderedHtml html={renderCellHtml(part.text, readOnly)} />
    {/if}
  {:else}
    {@const n = getRefNum(part.content, part.name)}
    <Tip class="max-w-72!" sideOffset={4}>
      {#snippet content()}
        <RenderedHtml html={renderCellHtml(part.content, true)} />
      {/snippet}
      {#snippet children({ props })}
        <sup class="ref-sup" {...props}>[{n}]</sup>
      {/snippet}
    </Tip>
  {/if}
{/each}

<style>
  .ref-sup {
    font-size: 0.6em;
    line-height: 1;
    vertical-align: super;
    padding-inline: 0.08em;
    color: var(--muted-foreground);
    cursor: help;
    user-select: none;
    font-weight: 500;

    &:hover {
      color: var(--foreground);
    }
  }
</style>
