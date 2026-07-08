<script lang="ts">
  import Card from "./Card.svelte";

  let {
    message,
    class: className = "",
  }: {
    message: string;
    class?: string;
  } = $props();
</script>

<Card class="p-8 text-center {className}">
  <p class="animate-pulse text-body">{message}</p>
</Card>
