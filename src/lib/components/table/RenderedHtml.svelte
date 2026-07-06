<script lang="ts">
  import type { Attachment } from "svelte/attachments";

  let { html }: { html: string } = $props();

  const renderHtml: Attachment<HTMLElement> = (node) => {
    node.innerHTML = html;
  };
</script>

<span {@attach renderHtml}></span>
