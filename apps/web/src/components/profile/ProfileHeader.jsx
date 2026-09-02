import React, { useState, useRef } from 'react';
import { User, LogOut, Camera, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { api } from '@/api/client';
import { useAuth } from '@/lib/AuthContext';
import { toast } from 'sonner';
import { t } from '@/lib/i18n';

export default function ProfileHeader({ user, stats, levelProgress, theme, onUserUpdate }) {
  const i = t();
  const { logout } = useAuth();
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState(user?.full_name || '');
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const fileInputRef = useRef(null);

  // Keep editedName in sync when user data arrives
  React.useEffect(() => {
    if (user?.full_name && !isEditingName) {
      setEditedName(user.full_name);
    }
  }, [user?.full_name]);

  const handleSaveName = async () => {
    const name = editedName.trim();
    if (!name || isSaving) return;
    setIsSaving(true);
    try {
      await api.auth.updateMe({ full_name: name });
      setIsEditingName(false);
      onUserUpdate?.({ ...user, full_name: name });
      toast.success(i.profilePage.nameSaved);
    } catch (error) {
      console.error('Save name error:', error);
      toast.error(i.profilePage.nameError);
    } finally {
      setIsSaving(false);
    }
  };

  const handleAvatarClick = () => {
    if (isUploadingAvatar) return;
    fileInputRef.current?.click();
  };

  const handleAvatarChange = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error(i.common?.error || 'Error');
      return;
    }
    setIsUploadingAvatar(true);
    try {
      const { file_url } = await api.files.upload(file);
      await api.auth.updateMe({ avatar_url: file_url });
      onUserUpdate?.({ ...user, avatar_url: file_url });
      toast.success(i.profilePage.nameSaved);
    } catch (error) {
      console.error('Avatar upload error:', error);
      toast.error(i.profilePage.nameError);
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  return (
    <div className={`rounded-2xl p-4 border ${
      theme === 'light' ? 'bg-white border-gray-200' : 'bg-[#1e2836] border-white/10'
    }`}>
      <div className="flex items-center gap-3">
        {/* Avatar */}
        <button
          type="button"
          onClick={handleAvatarClick}
          aria-label="Change avatar"
          className={`relative w-14 h-14 rounded-full overflow-hidden flex-shrink-0 group ${
            theme === 'light' ? 'bg-gradient-to-br from-purple-100 to-cyan-100' : 'bg-gradient-to-br from-purple-500/20 to-cyan-500/20'
          }`}
        >
          {user?.avatar_url ? (
            <img src={user.avatar_url} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <User className={`w-7 h-7 ${theme === 'light' ? 'text-purple-600' : 'text-purple-400'}`} />
            </div>
          )}
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 group-active:opacity-100 transition-opacity flex items-center justify-center">
            {isUploadingAvatar ? (
              <Loader2 className="w-5 h-5 text-white animate-spin" />
            ) : (
              <Camera className="w-5 h-5 text-white" />
            )}
          </div>
          {isUploadingAvatar && (
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
              <Loader2 className="w-5 h-5 text-white animate-spin" />
            </div>
          )}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleAvatarChange}
          className="hidden"
        />

        {/* Name + Level */}
        <div className="flex-1 min-w-0">
          {isEditingName ? (
            <div className="flex gap-1.5 items-center">
              <input
                type="text"
                value={editedName}
                onChange={(e) => setEditedName(e.target.value)}
                className={`flex-1 min-w-0 px-2 h-9 rounded-lg text-sm font-bold ${
                  theme === 'light' ? 'bg-gray-50 border border-purple-300 text-gray-900' : 'bg-[#0f1419] border border-purple-500/50 text-white'
                }`}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveName();
                  if (e.key === 'Escape') { setIsEditingName(false); setEditedName(user?.full_name || ''); }
                }}
              />
              <Button onClick={handleSaveName} disabled={isSaving} size="icon" aria-label={i.profilePage.saveName} className="h-9 w-9 flex-shrink-0 bg-purple-600 hover:bg-purple-700 text-white text-sm">
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : '✓'}
              </Button>
              <Button onClick={() => { setIsEditingName(false); setEditedName(user?.full_name || ''); }} size="icon" variant="ghost" aria-label={i.profilePage.cancelEdit} className="h-9 w-9 flex-shrink-0 text-sm">✕</Button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <h2 className={`text-lg font-bold truncate ${theme === 'light' ? 'text-gray-900' : 'text-white'}`}>
                {user?.full_name || i.profilePage.user}
              </h2>
              <button onClick={() => setIsEditingName(true)} aria-label={i.profilePage.editName} className="text-sm opacity-50 hover:opacity-100 w-8 h-8 flex items-center justify-center flex-shrink-0">✏️</button>
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

        {/* Logout — hidden while editing name to avoid button stacking */}
        {!isEditingName && (
          <Button
            onClick={logout}
            variant="ghost"
            size="icon"
            aria-label={i.profilePage.logout}
            className={`h-11 w-11 flex-shrink-0 ${theme === 'light' ? 'hover:bg-black/5 text-gray-400' : 'hover:bg-white/10 text-gray-500'}`}
          >
            <LogOut className="w-4 h-4" />
          </Button>
        )}
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