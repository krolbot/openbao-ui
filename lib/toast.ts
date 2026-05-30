// Tiny dependency-free toast bus. Lives outside React so non-component code
// (e.g. the TanStack MutationCache) can fire toasts too.
export type ToastKind = "success" | "error";
export type ToastItem = { id: number; kind: ToastKind; message: string };

type Listener = (t: ToastItem) => void;

let listeners: Listener[] = [];
let counter = 0;

function emit(kind: ToastKind, message: string) {
  const item: ToastItem = { id: ++counter, kind, message };
  listeners.forEach((l) => l(item));
}

export const toast = {
  success: (message: string) => emit("success", message),
  error: (message: string) => emit("error", message),
  subscribe(listener: Listener) {
    listeners.push(listener);
    return () => {
      listeners = listeners.filter((l) => l !== listener);
    };
  },
};
