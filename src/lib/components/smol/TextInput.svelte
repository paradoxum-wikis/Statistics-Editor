<script lang="ts">
  let {
    class: className = "",
    value = $bindable(""),
    ...restProps
  }: {
    class?: string;
    value?: string;
    [key: string]: unknown;
  } = $props();
</script>

<input class="input {className}" bind:value {...restProps} />
