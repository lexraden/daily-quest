import React, { Suspense, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { MessageCircle } from 'lucide-react';
import { api } from '@/api/client';
import { t } from '@/lib/i18n';
import { announceCoachChange } from '@/lib/coachEvents';

const CoachChat = React.lazy(() => import('@/components/daily/CoachChat.jsx'));

/**
 * The coach from History and Profile: a bubble above the tab bar, opening the
 * chat as a bottom sheet.
 *
 * The tracker has the coach in its own row and does not show this. Anything
 * applied from here is announced rather than applied locally, because the
 * tracker owns the quests, meals and XP the change touches.
 */
export default function CoachLauncher({ theme = 'dark' }) {
  const i = t();
  const [open, setOpen] = useState(false);
  // The chat names the quest a card would replace, so it needs the set.
  const [questData, setQuestData] = useState(null);

  const openChat = () => {
    setOpen(true);
    api.questData
      .get()
      .then((row) => setQuestData(row?.quest_data ?? null))
      .catch(() => setQuestData(null));
  };

  return (
    <>
      <button
        onClick={openChat}
        aria-label={i.coach?.title || 'Coach'}
        className="fixed right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-purple-600 to-blue-500 shadow-lg shadow-purple-900/40 transition-transform active:scale-95"
        style={{ bottom: 'calc(3.75rem + env(safe-area-inset-bottom, 0px))' }}
      >
        <MessageCircle className="h-6 w-6 text-white" />
      </button>

      <Suspense fallback={null}>
        <AnimatePresence>
          {open && (
            <CoachChat
              key="coach"
              open
              onClose={() => setOpen(false)}
              theme={theme}
              questData={questData}
              onApplied={(change) => {
                if (change.kind === 'quest') setQuestData(change.questData);
                announceCoachChange(change);
              }}
            />
          )}
        </AnimatePresence>
      </Suspense>
    </>
  );
}
