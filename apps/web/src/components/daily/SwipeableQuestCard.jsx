import React, { useState, useMemo, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, Circle, Pencil, Check, X, Check as CheckIcon } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { t } from '@/lib/i18n';

const SwipeableQuestCard = React.memo(function SwipeableQuestCard({ 
  categoryKey, 
  categoryInfo, 
  quests, 
  completedToday, 
  onToggleQuest,
  celebrationQuest,
  completedText,
  pendingText,
  theme,
  categoryLevel,
  onCategoryClick,
  onSaveQuest 
}) {
  const [currentLevel, setCurrentLevel] = useState(null);
  const [direction, setDirection] = useState(0);
  const [isEditing, setIsEditing] = useState(false);
  const [editedEmoji, setEditedEmoji] = useState('');
  const [editedName, setEditedName] = useState('');

  // Sort quests: uncompleted first
  const sortedQuests = useMemo(() => {
    return [...quests].sort((a, b) => {
      const aCompleted = completedToday[`${categoryKey}_${a.level}`];
      const bCompleted = completedToday[`${categoryKey}_${b.level}`];
      if (!aCompleted && bCompleted) return -1;
      if (aCompleted && !bCompleted) return 1;
      return 0;
    });
  }, [quests, completedToday, categoryKey]);

  // Current quest is tracked by level (stable across re-sorts when a quest
  // becomes completed and moves to the end of sortedQuests), with a fallback
  // to the first uncompleted quest. This prevents the card from silently
  // switching to an already-completed level after a tap or re-order.
  const currentQuest =
    quests.find((q) => q.level === currentLevel) ||
    sortedQuests.find((q) => !completedToday[`${categoryKey}_${q.level}`]) ||
    sortedQuests[0];
  const activeLevel = currentQuest ? currentQuest.level : null;
  if (activeLevel !== null && currentLevel !== activeLevel) {
    setCurrentLevel(activeLevel);
  }
  const questKey = `${categoryKey}_${currentQuest.level}`;
  const isCompleted = completedToday[questKey];
  const isCelebrating = celebrationQuest === categoryKey;
  const i = t();
  const qe = i.questEdit;
  const Icon = categoryInfo.icon;

  /**
   * A quest that has just been completed makes way for the next one.
   *
   * Tracking the card by level (above) stopped it jumping to a different quest
   * when the list re-sorted — but it also pinned it: complete the quest on
   * screen and the card went on showing that quest, ticked, with the next one
   * hidden behind a dot. Before the level tracking, the re-sort itself did the
   * advancing, and people relied on it.
   *
   * Only a completion advances it, never arriving at a completed quest.
   * Swiping or tapping a dot onto a finished quest is a deliberate look at it,
   * and moving away from under the user would make those quests impossible to
   * see — so the check is that this is the same level as last time and that it
   * has gone from open to done.
   *
   * The pause is so the tick and the celebration are seen before the card
   * slides on; switching instantly cut them off mid-animation.
   */
  const lastSeen = useRef({ level: activeLevel, completed: isCompleted });
  useEffect(() => {
    const last = lastSeen.current;
    lastSeen.current = { level: activeLevel, completed: isCompleted };

    if (last.level !== activeLevel || last.completed || !isCompleted) return undefined;

    const next = sortedQuests.find(
      (q) => q.level !== activeLevel && !completedToday[`${categoryKey}_${q.level}`],
    );
    if (!next) return undefined; // everything here is done; stay on it

    const timer = setTimeout(() => {
      setDirection(1);
      setCurrentLevel(next.level);
    }, 700);
    return () => clearTimeout(timer);
  }, [activeLevel, isCompleted, sortedQuests, completedToday, categoryKey]);

  /**
   * Swiping between quests, back again.
   *
   * It was removed because swiping onto a completed quest and tapping it
   * un-completed it and took the XP away. That tap is inert now, so the reason
   * went with it, and without swiping the only way to another quest was a dot
   * a few pixels wide. It moves through the same order the dots show.
   */
  const position = sortedQuests.findIndex((q) => q.level === activeLevel);
  const paginate = (step) => {
    const target = sortedQuests[position + step];
    if (!target) return;
    setDirection(step);
    setCurrentLevel(target.level);
  };
  const SWIPE_THRESHOLD = 10000;
  const swipePower = (offset, velocity) => Math.abs(offset) * velocity;

  /**
   * A swipe is not a tap, and the browser does not know that.
   *
   * The card is both draggable and clickable, and a drag ends in a pointerup
   * on the same element it began on — which the browser reports as a click. So
   * a swipe away from a quest also completed it: verified by swiping from one
   * quest to the next and watching the server record the first. Now that a
   * completed quest cannot be un-ticked from the card, that was a completion
   * with no way back.
   *
   * framer-motion reports a drag only once the pointer has moved past its
   * threshold, so a tap with a little jitter in it is still a tap.
   */
  const dragged = useRef(false);

  const handleStartEdit = () => {
    setIsEditing(true);
    setEditedEmoji(currentQuest.emoji);
    setEditedName(currentQuest.name);
  };

  const handleSaveEdit = () => {
    onSaveQuest(categoryKey, currentQuest.level, {
      emoji: editedEmoji,
      name: editedName
    });
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditedEmoji('');
    setEditedName('');
  };

  const variants = {
    enter: (direction) => ({
      x: direction > 0 ? 300 : -300,
      opacity: 0
    }),
    center: {
      x: 0,
      opacity: 1
    },
    exit: (direction) => ({
      x: direction < 0 ? 300 : -300,
      opacity: 0
    })
  };

  return (
    <div className="space-y-0">
      {/* Category Header */}
      <div className="flex items-center gap-2 px-1">
        <button
          onClick={() => onCategoryClick(categoryKey)}
          aria-label={`${categoryInfo.name} ${qe.categoryProgress}`}
          className="flex items-center gap-2 hover:opacity-70 transition-opacity cursor-pointer min-h-[44px]"
        >
          <div className={`p-1.5 rounded-lg ${categoryInfo.bgColor}`}>
            <Icon className={`w-4 h-4 ${categoryInfo.textColor}`} />
          </div>
          <span className={`text-sm font-medium ${categoryInfo.textColor}`}>
            {categoryInfo.name}
          </span>
        </button>
        <div className="flex-1 h-px bg-white/5" />
        <span className={`text-xs font-semibold ${categoryInfo.textColor}`}>
          Lvl {currentQuest.level || 1}
        </span>
      </div>

      {/* Swipeable Quest Card */}
      <div className="relative">
        <div className="overflow-hidden min-h-[88px]">
        <AnimatePresence initial={false} custom={direction} mode="wait">
          <motion.div
            key={questKey}
            custom={direction}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{
              x: { type: "spring", stiffness: 350, damping: 35 },
              opacity: { duration: 0.1 }
            }}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={1}
            onPointerDown={() => { dragged.current = false; }}
            onDragStart={() => { dragged.current = true; }}
            onDragEnd={(e, { offset, velocity }) => {
              const swipe = swipePower(offset.x, velocity.x);
              if (swipe < -SWIPE_THRESHOLD) paginate(1);
              else if (swipe > SWIPE_THRESHOLD) paginate(-1);
            }}
            onClick={(e) => {
              if (dragged.current) {
                dragged.current = false;
                return;
              }
              if (!isEditing && !e.target.closest('button')) {
                onToggleQuest(categoryKey, currentQuest.level);
              }
            }}
            className={`
              relative overflow-hidden rounded-2xl px-4 py-5 cursor-pointer
              transition-all duration-300 ease-out border
              ${isCompleted 
                ? `${categoryInfo.bgColor} ${categoryInfo.borderColor}` 
                : theme === 'light'
                  ? 'bg-white border-gray-200 hover:bg-gray-50'
                  : 'bg-[#1e2836] border-white/5 hover:bg-[#242f3d]'
              }
              ${isCelebrating ? 'scale-[1.02]' : 'scale-100'}
            `}
          >
            {isCelebrating && (
              <div className={`absolute inset-0 ${categoryInfo.bgColor} animate-pulse`} />
            )}
            
            <div className="relative flex items-center gap-4">
              {/* Checkbox */}
              {!isEditing && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleQuest(categoryKey, currentQuest.level);
                  }}
                  aria-label={isCompleted ? qe.uncheckQuest : qe.completeQuest}
                  className={`
                    relative w-11 h-11 rounded-full flex items-center justify-center
                    transition-all duration-300 flex-shrink-0 cursor-pointer
                    hover:scale-110 active:scale-95
                    ${isCompleted 
                      ? categoryInfo.bgColor
                      : theme === 'light'
                        ? 'bg-gray-100 border-2 border-gray-200'
                        : 'bg-white/5 border-2 border-white/10'
                    }
                  `}
                >
                  {isCompleted ? (
                    <CheckCircle2 className={`w-6 h-6 ${categoryInfo.textColor}`} />
                  ) : (
                    <Circle className="w-6 h-6 text-transparent" />
                  )}
                </button>
              )}

              {/* Quest Info */}
              <div className="flex-1 min-w-0">
                {isEditing ? (
                  <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    <Input
                      value={editedEmoji}
                      onChange={(e) => setEditedEmoji(e.target.value)}
                      className={`w-10 text-center text-lg p-1 ${
                        theme === 'light' 
                          ? 'bg-gray-100 border-gray-300 text-gray-900' 
                          : 'bg-white/5 border-white/10 text-white'
                      }`}
                      maxLength={2}
                      onClick={(e) => e.stopPropagation()}
                    />
                    <Input
                      value={editedName}
                      onChange={(e) => setEditedName(e.target.value)}
                      className={`flex-1 ${
                        theme === 'light' 
                          ? 'bg-gray-100 border-gray-300 text-gray-900' 
                          : 'bg-white/5 border-white/10 text-white'
                      }`}
                      onClick={(e) => e.stopPropagation()}
                    />
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSaveEdit();
                      }}
                      aria-label={qe.saveQuest}
                      className={`
                        p-2.5 rounded-lg transition-all hover:scale-110 active:scale-95 flex-shrink-0 min-w-[44px] min-h-[44px] flex items-center justify-center
                        ${theme === 'light' 
                          ? 'hover:bg-green-100' 
                          : 'hover:bg-green-500/20'
                        }
                      `}
                    >
                      <Check className="w-4 h-4 text-green-500" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCancelEdit();
                      }}
                      aria-label={qe.cancelEdit}
                      className={`
                        p-2.5 rounded-lg transition-all hover:scale-110 active:scale-95 flex-shrink-0 min-w-[44px] min-h-[44px] flex items-center justify-center
                        ${theme === 'light' 
                          ? 'hover:bg-red-100' 
                          : 'hover:bg-red-500/20'
                        }
                      `}
                    >
                      <X className="w-4 h-4 text-red-500" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2.5">
                    <span className="text-2xl">{currentQuest.emoji}</span>
                    <span className={`
                      text-base font-medium transition-all duration-300 flex-1
                      ${isCompleted 
                        ? theme === 'light' ? 'text-gray-500 line-through' : 'text-gray-400 line-through'
                        : theme === 'light' ? 'text-gray-900' : 'text-white'
                      }
                    `}>
                      {currentQuest.name}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleStartEdit();
                      }}
                      aria-label={qe.editQuest}
                      className={`
                        p-2.5 rounded-lg transition-all hover:scale-110 active:scale-95 min-w-[44px] min-h-[44px] flex items-center justify-center
                        ${theme === 'light' 
                          ? 'hover:bg-gray-100' 
                          : 'hover:bg-white/10'
                        }
                      `}
                    >
                      <Pencil className={`w-4 h-4 ${
                        theme === 'light' ? 'text-gray-400' : 'text-gray-500'
                      }`} />
                    </button>
                  </div>
                )}
              </div>
              

            </div>
          </motion.div>
        </AnimatePresence>
        </div>

        {/* Dots Indicator */}
        <div className="flex items-center justify-center mt-1 -mb-2">
        {sortedQuests.length > 1 && (
          <>
            {sortedQuests.map((quest, idx) => {
              const questKey = `${categoryKey}_${quest.level}`;
              const isQuestCompleted = completedToday[questKey];
              const isSelected = quest.level === activeLevel;
              
              return (
                <button
                key={quest.level}
                onClick={() => {
                  setDirection(idx > position ? 1 : -1);
                  setCurrentLevel(quest.level);
                }}
                aria-label={`Квест ${idx + 1}`}
                className="flex items-center justify-center px-1 py-1 min-w-[28px] min-h-[36px]"
                >
                  <span
                    className={`block transition-all duration-300 ${
                      isQuestCompleted 
                        ? 'w-4 h-4' 
                        : isSelected ? 'w-2 h-2 rounded-full' : 'w-1.5 h-1.5 rounded-full'
                    }`}
                    style={isQuestCompleted ? {} : { 
                      backgroundColor: theme === 'light' 
                        ? (isSelected ? '#9ca3af' : '#d1d5db')
                        : (isSelected ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.15)'),
                    }}
                  >
                    {isQuestCompleted && (
                      <CheckIcon className="w-4 h-4" style={{ color: categoryInfo.color }} strokeWidth={3} />
                    )}
                  </span>
                </button>
              );
            })}
          </>
        )}
        </div>
      </div>
    </div>
  );
});

export default SwipeableQuestCard;