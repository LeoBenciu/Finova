import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, Check, X } from 'lucide-react';

interface ConfirmModalProps {
  open: boolean;
  message: string;
  language: 'ro' | string;
  onCancel: () => void;
  onConfirm: () => Promise<void> | void;
}

const ConfirmModal: React.FC<ConfirmModalProps> = ({ open, message, language, onCancel, onConfirm }) => {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-[70] p-4"
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="bg-[var(--foreground)] rounded-2xl border border-[var(--text4)] shadow-2xl max-w-md w-full p-6"
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-red-500/10 rounded-xl flex items-center justify-center shrink-0">
                <AlertTriangle size={20} className="text-red-600" />
              </div>
              <div className="text-[var(--text1)]">
                <h4 className="font-semibold mb-1">{language === 'ro' ? 'Confirmare' : 'Confirm'}</h4>
                <p className="text-[var(--text2)]">{message}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 mt-6 pt-4 border-t border-[var(--text4)]">
              <button
                onClick={onCancel}
                className="flex-1 px-4 py-2 border bg-white border-[var(--text4)] text-[var(--text2)] rounded-xl hover:bg-[var(--text4)]/10 transition-colors flex items-center justify-center gap-2"
              >
                <X size={16} /> {language === 'ro' ? 'Anulează' : 'Cancel'}
              </button>
              <button
                onClick={async () => { await Promise.resolve(onConfirm()); }}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors flex items-center justify-center gap-2"
              >
                <Check size={16} /> {language === 'ro' ? 'Confirmă' : 'Confirm'}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ConfirmModal;
