import React from 'react';
import { AlertCircle } from 'lucide-react';

export interface ConfirmModalState {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
}

interface ConfirmationModalProps {
  modal?: ConfirmModalState | null;
  modalState?: ConfirmModalState | null;
  onClose: () => void;
}

export const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  modal,
  modalState,
  onClose
}) => {
  const activeModal = modal || modalState;
  if (!activeModal || !activeModal.isOpen) return null;

  return (
    <div className="fixed inset-0 z-100 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs font-sans">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 border border-slate-200 shadow-2xl animate-fade-in text-left">
        <div className="flex items-start gap-3.5">
          <div className="w-10 h-10 rounded-full bg-rose-50 flex items-center justify-center text-rose-600 shrink-0">
            <AlertCircle className="w-5 h-5 animate-pulse" />
          </div>
          <div className="space-y-1.5 flex-1">
            <h3 className="font-bold text-slate-900 text-base">{activeModal.title}</h3>
            <p className="text-slate-600 text-xs leading-relaxed font-medium">{activeModal.message}</p>
          </div>
        </div>
        <div className="mt-5.5 flex justify-end gap-2.5 select-none">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg transition-all cursor-pointer border border-slate-200/40"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              activeModal.onConfirm();
              onClose();
            }}
            className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-lg transition-all shadow-md shadow-rose-600/10 hover:shadow-rose-600/20 cursor-pointer"
          >
            Confirm Action
          </button>
        </div>
      </div>
    </div>
  );
};
