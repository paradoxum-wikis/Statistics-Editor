import { toastStore } from "$lib/stores/toast.svelte";
import type { ToastColor } from "$lib/stores/toast.svelte";

export const toast = {
  show: (message: string, color: ToastColor = "info") =>
    toastStore.push(message, color),
  info: (message: string) => toastStore.push(message, "info"),
  success: (message: string) => toastStore.push(message, "success"),
  error: (message: string) => toastStore.push(message, "error"),
  warning: (message: string) => toastStore.push(message, "warning"),
};
