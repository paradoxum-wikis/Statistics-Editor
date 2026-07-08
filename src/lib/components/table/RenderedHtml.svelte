<script lang="ts">
  import type { Attachment } from "svelte/attachments";

  let { html, block = false }: { html: string; block?: boolean } = $props();

  const renderHtml: Attachment<HTMLElement> = (node) => {
    node.innerHTML = html;
  };
</script>

{#if block}
  <div {@attach renderHtml}></div>
{:else}
  <span {@attach renderHtml}></span>
{/if}
