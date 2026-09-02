import { createSignal } from 'solid-js';

export function useConfirmAction() {
  const [confirmModal, setConfirmModal] = createSignal<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);

  const confirmAction = (message: string, onConfirm: () => void, title = 'Confirm Action') => {
    setConfirmModal({
      isOpen: true,
      title,
      message,
      onConfirm: () => {
        onConfirm();
        setConfirmModal(null);
      }
    });
  };

  return {
    confirmModal,
    setConfirmModal,
    confirmAction
  };
}
