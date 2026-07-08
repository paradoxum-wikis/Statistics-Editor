import { toastStore } from "$lib/stores/toast.svelte";
import type { ToastColor } from "$lib/stores/toast.svelte";

function push(message: string, color: ToastColor, duration?: number) {
  return toastStore.push(message, color, duration);
}

export const toast = {
  show: (message: string, color: ToastColor = "info", duration?: number) =>
    push(message, color, duration),
  info: (message: string, duration?: number) => push(message, "info", duration),
  success: (message: string, duration?: number) =>
    push(message, "success", duration),
  error: (message: string, duration?: number) =>
    push(message, "error", duration ?? 4000),
  warning: (message: string, duration?: number) =>
    push(message, "warning", duration),
};
