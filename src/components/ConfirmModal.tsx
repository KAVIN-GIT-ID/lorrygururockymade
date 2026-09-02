import { createSignal, createEffect, Component } from 'solid-js';

import { AlertCircle } from 'lucide-solid';
import { useLanguage } from '../context/LanguageContext';

interface ConfirmModalProps {
  confirmModal: {
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  } | null;
  onClose: () => void;
}

export const ConfirmModal: Component<ConfirmModalProps> = (props) => {
  const { t } = useLanguage();
  if (!props.confirmModal || !props.confirmModal.isOpen) return null;

  return (
    <div class="fixed inset-0 z-100 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs font-sans animate-fade-in">
      <div class="bg-white rounded-2xl max-w-md w-full p-6 border border-slate-200 shadow-2xl animate-fade-in text-left">
        <div class="flex items-start gap-3.5">
          <div class="w-10 h-10 rounded-full bg-rose-50 flex items-center justify-center text-rose-600 shrink-0">
            <AlertCircle class="w-5 h-5 animate-pulse" />
          </div>
          <div class="space-y-1.5 flex-1">
            <h3 class="font-bold text-slate-900 text-base">{props.confirmModal.title}</h3>
            <p class="text-slate-600 text-xs leading-relaxed font-medium">{props.confirmModal.message}</p>
          </div>
        </div>
        <div class="mt-5.5 flex justify-end gap-2.5 select-none">
          <button
            type="button"
            onClick={props.onClose}
            class="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg transition-all cursor-pointer border border-slate-200/40"
          >
            {t('btn.cancel', 'Cancel')}
          </button>
          <button
            type="button"
            onClick={props.confirmModal.onConfirm}
            class="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-lg transition-all shadow-md shadow-rose-600/10 hover:shadow-rose-600/20 cursor-pointer"
          >
            {t('btn.save', 'Confirm Action')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmModal;
