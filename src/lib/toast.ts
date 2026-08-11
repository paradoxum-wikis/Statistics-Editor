import { toastStore } from "$lib/stores/toast.svelte";
import type { ToastColor, ToastOptions } from "$lib/stores/toast.svelte";

export const toast = {
  show: (
    message: string,
    color: ToastColor = "info",
    options?: ToastOptions,
  ) => toastStore.push(message, color, options),
  info: (message: string, options?: ToastOptions) =>
    toastStore.push(message, "info", options),
  success: (message: string, options?: ToastOptions) =>
    toastStore.push(message, "success", options),
  error: (message: string, options?: ToastOptions) =>
    toastStore.push(message, "error", options),
  warning: (message: string, options?: ToastOptions) =>
    toastStore.push(message, "warning", options),
};
