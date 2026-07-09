<script lang="ts">
  import { Switch as SwitchPrimitive } from "bits-ui";

  type SwitchSize = "default" | "sm";

  let {
    checked = $bindable(false),
    size = "default",
    class: className = "",
    ...restProps
  }: {
    checked?: boolean;
    size?: SwitchSize;
    class?: string;
    [key: string]: unknown;
  } = $props();
</script>

<SwitchPrimitive.Root
  bind:checked
  class="switch {size === 'sm' ? 'switch-sm' : ''} {className}"
  {...restProps}
>
  <SwitchPrimitive.Thumb class="switch-thumb" />
</SwitchPrimitive.Root>

<style>
  :global(.switch) {
    display: inline-flex;
    height: 1.5rem;
    width: 2.75rem;
    flex-shrink: 0;
    cursor: pointer;
    align-items: center;
    border-radius: 9999px;
    border: 2px solid transparent;
    transition: background-color 0.15s;

    &:focus-visible {
      outline: 2px solid var(--ring);
      outline-offset: 2px;
    }

    &:disabled {
      cursor: not-allowed;
      opacity: 0.5;
    }

    &[data-state="checked"] {
      background: var(--primary);
    }

    &[data-state="unchecked"] {
      background: var(--muted);
    }
  }

  :global(.switch-sm) {
    height: 1.25rem;
    width: 2.25rem;
  }

  :global(.switch-thumb) {
    pointer-events: none;
    display: block;
    height: 1.25rem;
    width: 1.25rem;
    border-radius: 9999px;
    background: white;
    box-shadow:
      0 10px 15px -3px oklch(0 0 0 / 0.1),
      0 4px 6px -4px oklch(0 0 0 / 0.1);
    transition: transform 0.15s;
  }

  :global(.switch[data-state="checked"] .switch-thumb) {
    transform: translateX(1.25rem);
  }

  :global(.switch[data-state="unchecked"] .switch-thumb) {
    transform: translateX(0);
  }

  :global(.switch-sm .switch-thumb) {
    height: 1rem;
    width: 1rem;
  }

  :global(.switch-sm[data-state="checked"] .switch-thumb) {
    transform: translateX(1rem);
  }
</style>
