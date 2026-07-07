<script lang="ts">
  let { text }: { text: string } = $props();
</script>

<div class="w-full min-w-0 overflow-hidden text-xs text-muted-foreground">
  <div class="marquee-track">
    <span>{text}</span>
    <span aria-hidden="true">{text}</span>
  </div>
</div>

<style>
  .marquee-track {
    display: flex;
    width: max-content;
    gap: 1.5rem;
    white-space: nowrap;
    animation: marquee 15s linear infinite;
  }

  @keyframes marquee {
    to {
      transform: translateX(calc(-50% - 0.75rem));
    }
  }
</style>
