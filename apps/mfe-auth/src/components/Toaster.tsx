import { useToastStore } from "../lib/use-toast";
import {
  ToastProvider,
  ToastViewport,
  Toast,
  ToastTitle,
  ToastDescription,
  ToastClose,
} from "./ui/toast";

export function Toaster() {
  const { toasts, removeToast } = useToastStore();

  return (
    <ToastProvider duration={4000}>
      {toasts.map((t) => (
        <Toast
          key={t.id}
          variant={t.variant}
          onOpenChange={(open) => {
            if (!open) removeToast(t.id);
          }}
        >
          <div className="flex-1">
            <ToastTitle>{t.title}</ToastTitle>
            {t.description && <ToastDescription>{t.description}</ToastDescription>}
          </div>
          <ToastClose />
        </Toast>
      ))}
      <ToastViewport />
    </ToastProvider>
  );
}
