import React, { useCallback, useEffect, useState } from "react";

let toastId = 0;

export function useToast() {
  const [toasts, setToasts] = useState([]);

  const pushToast = useCallback((message, variant = "info") => {
    const id = ++toastId;
    setToasts((t) => [...t, { id, message, variant }]);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);

  return { toasts, pushToast, removeToast };
}

export function ToastStack({ toasts, onDismiss }) {
  return (
    <div className="toast-stack" aria-live="polite">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

function ToastItem({ toast, onDismiss }) {
  useEffect(() => {
    const timer = setTimeout(() => onDismiss(toast.id), 3000);
    return () => clearTimeout(timer);
  }, [toast.id, onDismiss]);

  return (
    <div className={`toast toast--${toast.variant}`} role="status">
      <div className="toast__row">
        <span className="toast__msg">{toast.message}</span>
        <button type="button" className="toast__close" onClick={() => onDismiss(toast.id)} aria-label="Dismiss">
          ×
        </button>
      </div>
      <div className="toast__progress" />
    </div>
  );
}
