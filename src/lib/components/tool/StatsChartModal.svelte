<script lang="ts">
  import Modal from "$lib/components/smol/Modal.svelte";
  import StatsChartPanel from "./StatsChartPanel.svelte";

  let { open = $bindable(false) } = $props();
</script>

<Modal bind:open class="sm:max-w-2xl">
  <StatsChartPanel />
</Modal>
