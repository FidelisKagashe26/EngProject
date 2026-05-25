export type TopToastTone = "success" | "error" | "info";

export interface TopToastPayload {
  tone: TopToastTone;
  title: string;
  message: string;
  durationMs?: number;
}

type TopToastListener = (payload: TopToastPayload) => void;

const topToastListeners = new Set<TopToastListener>();

export const pushTopToast = (payload: TopToastPayload): void => {
  const message = payload.message.trim();
  if (message.length === 0) {
    return;
  }

  topToastListeners.forEach((listener) => {
    listener({ ...payload, message });
  });
};

export const subscribeTopToast = (listener: TopToastListener): (() => void) => {
  topToastListeners.add(listener);
  return () => {
    topToastListeners.delete(listener);
  };
};
