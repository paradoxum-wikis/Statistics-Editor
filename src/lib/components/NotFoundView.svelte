<script lang="ts">
  let {
    onHome,
    tower = false,
    code = 404,
  }: {
    onHome: () => void;
    tower?: boolean;
    code?: 403 | 404;
  } = $props();
</script>

<div
  class="flex min-h-full flex-col items-center justify-center gap-4 py-8 text-center"
>
  <div class="flex items-center justify-center gap-4 sm:gap-6">
    <enhanced:img
      src="$lib/assets/404.png"
      alt=""
      class="w-[min(22vw,11rem)] shrink-0 select-none"
    />
    <p
      class="unisans text-[min(22vw,11rem)] leading-none font-black text-destructive"
    >
      {code}
    </p>
  </div>

  {#if code === 403}
    <p class="max-w-3xl text-base text-muted-foreground italic sm:text-lg">
      "Hah. You carry the will of a fool."
    </p>
    <p class="max-w-md text-sm sm:text-base">
      Forbidden. You don't have permission to view this page.
    </p>
  {:else}
    <p class="max-w-3xl text-base text-muted-foreground italic sm:text-lg">
      "{tower
        ? "Stuck in some idea dump that the writer scrapped."
        : "Hello? Communicator's acting up... This doesn't feel right. Can you hea-RRrR"}"
    </p>
    <p class="max-w-md text-sm sm:text-base">
      {tower
        ? "This tower doesn't exist, or at least, it used to, but is unfortunately no longer."
        : "Sorry, the page you're looking for doesn't exist. It's either been moved or deleted."}
    </p>
  {/if}

  <button type="button" class="btn btn-primary" onclick={onHome}>
    Back to Home
  </button>
</div>
