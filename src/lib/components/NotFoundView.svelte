<script lang="ts">
  import ForOhFor from "$lib/assets/404.png";

  let {
    onHome,
    kind = "page",
  }: {
    onHome: () => void;
    kind?: "page" | "tower";
  } = $props();

  const code = $derived(kind === "tower" ? "200" : "404");
  const quote = $derived(
    kind === "tower"
      ? "Stuck in some idea dump that the writer scrapped."
      : "Hello? Communicator's acting up... This doesn't feel right. Can you hea-RRrR",
  );
  const message = $derived(
    kind === "tower"
      ? "This tower doesn't exist, or at least, it used to, but is unfortunately no longer."
      : "Sorry, the page you're looking for doesn't exist. It's either been moved or deleted.",
  );
</script>

<div
  class="flex min-h-full flex-col items-center justify-center gap-4 py-8 text-center"
>
  <div class="flex items-center justify-center gap-4 sm:gap-6">
    <img
      src={ForOhFor}
      alt=""
      class="w-[min(22vw,11rem)] shrink-0 select-none"
    />
    <p
      class="unisans text-[min(22vw,11rem)] leading-none font-black text-destructive"
    >
      {code}
    </p>
  </div>

  <p class="max-w-3xl text-base text-muted-foreground italic sm:text-lg">
    "{quote}"
  </p>

  <p class="max-w-md text-sm sm:text-base">
    {message}
  </p>

  <button type="button" class="btn btn-primary" onclick={onHome}>
    Back to Home
  </button>
</div>
