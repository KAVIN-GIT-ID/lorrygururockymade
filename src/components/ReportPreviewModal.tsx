import React, { useRef } from 'react';
import { X, Printer, Download } from 'lucide-react';

interface ReportPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  htmlContent: string;
  title: string;
}

export default function ReportPreviewModal({
  isOpen,
  onClose,
  htmlContent,
  title
}: ReportPreviewModalProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  if (!isOpen) return null;

  const handlePrint = () => {
    const isCapacitor = typeof window !== 'undefined' && (window.location.protocol === 'capacitor:' || !!(window as any).Capacitor);
    if (isCapacitor) {
      import('@capgo/capacitor-printer').then(({ Printer }) => {
        Printer.printHtml({ name: title, html: htmlContent }).catch(err => {
          console.error("Native print failed:", err);
        });
      }).catch(err => {
        console.error("Failed to load printer plugin:", err);
      });
    } else {
      if (iframeRef.current && iframeRef.current.contentWindow) {
        iframeRef.current.contentWindow.focus();
        iframeRef.current.contentWindow.print();
      }
    }
  };

  return (
    <div className="fixed inset-0 z-250 flex items-center justify-center p-0 md:p-6 bg-slate-950/65 backdrop-blur-md animate-fade-in font-sans">
      <div className="bg-white dark:bg-slate-900 w-full h-full md:max-w-4xl md:h-[90vh] md:rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-slate-200 dark:border-slate-800 animate-scale-up">
        {/* Header Bar */}
        <div className="bg-slate-50 dark:bg-slate-950/40 border-b border-slate-200 dark:border-slate-800 px-6 py-4 flex items-center justify-between shrink-0">
          <div>
            <h3 className="font-extrabold text-slate-900 dark:text-white text-sm">
              Document Print Preview
            </h3>
            <p className="text-[10px] text-slate-500 font-semibold truncate max-w-xs md:max-w-md">
              {title}
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            <button
              onClick={handlePrint}
              className="flex items-center justify-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 active:scale-98 text-white text-xs font-extrabold rounded-xl shadow-md transition cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Print / Save</span>
            </button>
            
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-250 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs hover:bg-slate-50 dark:hover:bg-slate-850 transition cursor-pointer"
              title="Close Preview"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Preview Frame */}
        <div className="flex-1 bg-slate-100 dark:bg-slate-950 p-2 md:p-4 overflow-hidden relative">
          <iframe
            ref={iframeRef}
            srcDoc={htmlContent}
            title={title}
            className="w-full h-full border-0 bg-white shadow-sm rounded-xl md:rounded-2xl"
          />
        </div>
      </div>
    </div>
  );
}
