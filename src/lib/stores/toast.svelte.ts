export type ToastColor = "info" | "success" | "error" | "warning";

export type ToastItem = {
  id: number;
  message: string;
  color: ToastColor;
};

const MAX_TOASTS = 4;
const DURATION = 3777;

class ToastStore {
  items = $state<ToastItem[]>([]);
  private nextId = 0;
  private timers = new Map<number, ReturnType<typeof setTimeout>>();

  push(message: string, color: ToastColor = "info") {
    const id = ++this.nextId;
    this.items = [...this.items, { id, message, color }].slice(-MAX_TOASTS);

    const timer = setTimeout(() => this.dismiss(id), DURATION);
    this.timers.set(id, timer);

    return id;
  }

  dismiss(id: number) {
    const timer = this.timers.get(id);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(id);
    }
    this.items = this.items.filter((item) => item.id !== id);
  }
}

export const toastStore = new ToastStore();
