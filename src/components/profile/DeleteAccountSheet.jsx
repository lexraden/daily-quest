import React, { useState } from 'react';
import { Trash2, AlertTriangle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { motion, AnimatePresence } from 'framer-motion';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { invalidateCache } from '@/components/UserDataCache';

export default function DeleteAccountSheet({ open, onClose, user, theme = 'light' }) {
  const [step, setStep] = useState(1); // 1 = info, 2 = confirm
  const [confirmText, setConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const CONFIRM_WORD = 'УДАЛИТЬ';

  const handleClose = () => {
    setStep(1);
    setConfirmText('');
    setIsDeleting(false);
    onClose();
  };

  const handleDelete = async () => {
    if (confirmText !== CONFIRM_WORD) return;
    setIsDeleting(true);
    try {
      const userDataList = await base44.entities.UserQuestData.filter({ created_by: user?.email });
      for (const ud of userDataList) {
        await base44.entities.UserQuestData.delete(ud.id);
      }
      invalidateCache();
      toast.success('Аккаунт удалён');
      base44.auth.logout('/');
    } catch (error) {
      console.error('Error deleting account:', error);
      toast.error('Ошибка при удалении');
      setIsDeleting(false);
    }
  };

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50"
        onClick={handleClose}
      >
        <motion.div
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 30, stiffness: 300 }}
          onClick={e => e.stopPropagation()}
          className={`w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl overflow-hidden ${
            theme === 'light' ? 'bg-white' : 'bg-[#1e2836]'
          }`}
          style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 16px)' }}
        >
          {/* Drag handle */}
          <div className="flex justify-center pt-3 pb-1 sm:hidden">
            <div className={`w-10 h-1 rounded-full ${theme === 'light' ? 'bg-gray-300' : 'bg-white/20'}`} />
          </div>

          {/* Header */}
          <div className="flex items-center justify-between px-5 pt-3 pb-2">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-full ${theme === 'light' ? 'bg-red-100' : 'bg-red-500/20'}`}>
                <AlertTriangle className="w-5 h-5 text-red-500" />
              </div>
              <h2 className={`text-lg font-bold ${theme === 'light' ? 'text-gray-900' : 'text-white'}`}>
                Удаление аккаунта
              </h2>
            </div>
            <Button
              onClick={handleClose}
              variant="ghost"
              size="icon"
              aria-label="Закрыть"
              className={`h-11 w-11 rounded-full ${theme === 'light' ? 'hover:bg-black/5' : 'hover:bg-white/10'}`}
            >
              <X className="w-5 h-5" />
            </Button>
          </div>

          <div className="px-5 pb-5 space-y-4">
            {step === 1 && (
              <>
                <div className={`rounded-xl p-4 ${theme === 'light' ? 'bg-red-50 border border-red-200' : 'bg-red-500/10 border border-red-500/20'}`}>
                  <p className={`text-sm font-medium mb-2 ${theme === 'light' ? 'text-red-800' : 'text-red-300'}`}>
                    Это действие необратимо. Будут удалены:
                  </p>
                  <ul className={`text-sm space-y-1.5 ${theme === 'light' ? 'text-red-700' : 'text-red-400'}`}>
                    <li>• Все квесты и настройки</li>
                    <li>• История выполнения</li>
                    <li>• Серия дней и прогресс</li>
                    <li>• Записи журнала и питания</li>

                  </ul>
                </div>
                <div className="flex gap-3">
                  <Button
                    onClick={handleClose}
                    variant="outline"
                    aria-label="Отмена"
                    className={`flex-1 min-h-[44px] ${theme === 'light' ? 'border-gray-300' : 'border-white/10'}`}
                  >
                    Отмена
                  </Button>
                  <Button
                    onClick={() => setStep(2)}
                    aria-label="Продолжить удаление"
                    className="flex-1 min-h-[44px] bg-red-500 hover:bg-red-600 text-white"
                  >
                    Продолжить
                  </Button>
                </div>
              </>
            )}

            {step === 2 && (
              <>
                <p className={`text-sm ${theme === 'light' ? 'text-gray-600' : 'text-gray-400'}`}>
                  Введите <span className="font-bold text-red-500">{CONFIRM_WORD}</span> для подтверждения:
                </p>
                <Input
                  value={confirmText}
                  onChange={e => setConfirmText(e.target.value)}
                  placeholder={CONFIRM_WORD}
                  autoFocus
                  className={`min-h-[44px] text-center text-base font-mono ${
                    theme === 'light' ? 'bg-gray-50 border-gray-200' : 'bg-white/5 border-white/10 text-white'
                  }`}
                />
                <div className="flex gap-3">
                  <Button
                    onClick={() => { setStep(1); setConfirmText(''); }}
                    variant="outline"
                    aria-label="Назад"
                    className={`flex-1 min-h-[44px] ${theme === 'light' ? 'border-gray-300' : 'border-white/10'}`}
                  >
                    Назад
                  </Button>
                  <Button
                    onClick={handleDelete}
                    disabled={confirmText !== CONFIRM_WORD || isDeleting}
                    aria-label="Удалить аккаунт навсегда"
                    className="flex-1 min-h-[44px] bg-red-500 hover:bg-red-600 text-white disabled:opacity-40"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    {isDeleting ? 'Удаление...' : 'Удалить навсегда'}
                  </Button>
                </div>
              </>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}