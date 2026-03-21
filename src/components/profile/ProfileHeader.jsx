import React, { useState } from 'react';
import { User, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { t } from '@/lib/i18n';

export default function ProfileHeader({ user, stats, levelProgress, theme }) {
  const i = t();
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState(user?.full_name || '');

  // Keep editedName in sync when user data arrives
  React.useEffect(() => {
    if (user?.full_name && !isEditingName) {
      setEditedName(user.full_name);
    }
  }, [user?.full_name]);

  const handleSaveName = async () => {
    if (!editedName.trim()) return;
    try {
      await base44.auth.updateMe({ full_name: editedName.trim() });
      setIsEditingName(false);
      toast.success(i.profilePage.nameSaved);
      window.location.reload();
    } catch (error) {
      toast.error(i.profilePage.nameError);
    }
  };

  return (
    <div className={`rounded-2xl p-4 border ${
      theme === 'light' ? 'bg-white border-gray-200' : 'bg-[#1e2836] border-white/10'
    }`}>
      <div className="flex items-center gap-3">
        {/* Avatar */}
        <div className={`w-14 h-14 rounded-full overflow-hidden flex-shrink-0 ${
          theme === 'light' ? 'bg-gradient-to-br from-purple-100 to-cyan-100' : 'bg-gradient-to-br from-purple-500/20 to-cyan-500/20'
        }`}>
          <div className="w-full h-full flex items-center justify-center">
            <User className={`w-7 h-7 ${theme === 'light' ? 'text-purple-600' : 'text-purple-400'}`} />
          </div>
        </div>

        {/* Name + Level */}
        <div className="flex-1 min-w-0">
          {isEditingName ? (
            <div className="flex gap-2">
              <input
                type="text"
                value={editedName}
                onChange={(e) => setEditedName(e.target.value)}
                className={`flex-1 px-2 py-1 rounded-lg text-sm font-bold ${
                  theme === 'light' ? 'bg-gray-50 border border-purple-300 text-gray-900' : 'bg-[#0f1419] border border-purple-500/50 text-white'
                }`}
                autoFocus
                onKeyDown={(e) => e.key === 'Enter' && handleSaveName()}
              />
              <Button onClick={handleSaveName} size="sm" aria-label={i.profilePage.saveName} className="bg-purple-600 hover:bg-purple-700 text-xs px-2 min-w-[44px] min-h-[44px]">✓</Button>
              <Button onClick={() => { setIsEditingName(false); setEditedName(user?.full_name || ''); }} size="sm" variant="ghost" aria-label={i.profilePage.cancelEdit} className="text-xs px-2 min-w-[44px] min-h-[44px]">✕</Button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <h2 className={`text-lg font-bold truncate ${theme === 'light' ? 'text-gray-900' : 'text-white'}`}>
                {user?.full_name || i.profilePage.user}
              </h2>
              <button onClick={() => setIsEditingName(true)} aria-label={i.profilePage.editName} className="text-sm opacity-50 hover:opacity-100 min-w-[44px] min-h-[44px] flex items-center justify-center">✏️</button>
            </div>
          )}
          <div className="flex items-center gap-2 mt-1">
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold ${
              theme === 'light' ? 'bg-purple-100 text-purple-700' : 'bg-purple-500/20 text-purple-300'
            }`}>
              {stats.currentLevel.icon} {stats.currentLevel.name}
            </span>
            <span className={`text-xs ${theme === 'light' ? 'text-gray-500' : 'text-gray-500'}`}>
              {stats.totalCompleted} XP
            </span>
          </div>
        </div>

        {/* Logout */}
        <Button
          onClick={() => base44.auth.logout()}
          variant="ghost"
          size="icon"
          aria-label={i.profilePage.logout}
          className={`h-11 w-11 flex-shrink-0 ${theme === 'light' ? 'hover:bg-black/5 text-gray-400' : 'hover:bg-white/10 text-gray-500'}`}
        >
          <LogOut className="w-4 h-4" />
        </Button>
      </div>

      {/* Level Progress Bar */}
      <div className="mt-3">
        <div className="flex items-center justify-between text-xs mb-1">
          <span className={`font-semibold ${theme === 'light' ? 'text-purple-600' : 'text-purple-400'}`}>
            Level {stats.currentLevel.level}
          </span>
          {levelProgress.nextLevel && (
            <span className={theme === 'light' ? 'text-gray-500' : 'text-gray-500'}>
              {levelProgress.remaining} {i.profilePage.toLevel} {levelProgress.nextLevel.level}
            </span>
          )}
        </div>
        <div className={`h-2 rounded-full overflow-hidden ${theme === 'light' ? 'bg-gray-200' : 'bg-white/10'}`}>
          <div
            className="h-full bg-gradient-to-r from-purple-600 to-cyan-500 transition-all duration-700"
            style={{ width: `${levelProgress.progress}%` }}
          />
        </div>
      </div>
    </div>
  );
}