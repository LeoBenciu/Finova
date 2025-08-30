import React from 'react';

export type ToastItem = {
  id: string | number;
  type: 'success' | 'error' | 'info' | string;
  message: string;
};

interface ToastPortalProps {
  toasts: ToastItem[];
}

const ToastPortal: React.FC<ToastPortalProps> = ({ toasts }) => {
  if (!Array.isArray(toasts) || toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-[60] space-y-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`min-w-[260px] max-w-sm px-4 py-3 rounded-xl shadow-lg border text-sm bg-white ${
            t.type === 'success'
              ? 'border-emerald-200 text-emerald-700'
              : t.type === 'error'
              ? 'border-red-200 text-red-700'
              : 'border-blue-200 text-blue-700'
          }`}
        >
          {t.message}
        </div>
      ))}
    </div>
  );
};

export default ToastPortal;
