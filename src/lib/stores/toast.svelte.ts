export type ToastColor = "info" | "success" | "error" | "warning";

export type ToastAction = {
  label: string;
  onClick: () => void;
};

export type ToastOptions = {
  description?: string;
  action?: ToastAction;
  duration?: number;
  onDismiss?: () => void;
};

export type ToastItem = {
  id: number;
  message: string;
  color: ToastColor;
  description?: string;
  action?: ToastAction;
  onDismiss?: () => void;
};

const MAX_TOASTS = 4;
const DEFAULT_DURATION = 3777;

class ToastStore {
  items = $state<ToastItem[]>([]);
  private nextId = 0;
  private timers = new Map<number, ReturnType<typeof setTimeout>>();

  push(message: string, color: ToastColor = "info", options?: ToastOptions) {
    const id = ++this.nextId;
    const item: ToastItem = {
      id,
      message,
      color,
      description: options?.description,
      action: options?.action,
      onDismiss: options?.onDismiss,
    };

    const next = [...this.items, item];
    if (next.length > MAX_TOASTS) {
      for (const dropped of next.slice(0, next.length - MAX_TOASTS)) {
        this.clearTimer(dropped.id);
      }
    }
    this.items = next.slice(-MAX_TOASTS);

    const duration = options?.duration ?? DEFAULT_DURATION;
    if (duration > 0) {
      this.timers.set(
        id,
        setTimeout(() => this.dismiss(id), duration),
      );
    }

    return id;
  }

  dismiss(id: number) {
    this.clearTimer(id);
    const item = this.items.find((t) => t.id === id);
    if (!item) return;
    this.items = this.items.filter((t) => t.id !== id);
    item.onDismiss?.();
  }

  private clearTimer(id: number) {
    const timer = this.timers.get(id);
    if (!timer) return;
    clearTimeout(timer);
    this.timers.delete(id);
  }
}

export const toastStore = new ToastStore();
