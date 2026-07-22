<script lang="ts">
  import Modal from "$lib/components/smol/Modal.svelte";
  import StatsChartPanel from "./StatsChartPanel.svelte";

  let { open = $bindable(false) } = $props();
</script>

<Modal bind:open class="max-h-[85dvh] overflow-y-auto sm:max-w-2xl">
  <StatsChartPanel />
</Modal>
