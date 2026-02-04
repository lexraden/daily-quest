import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, Circle, Pencil, Check, X } from 'lucide-react';
import { Input } from '@/components/ui/input';

export default function SwipeableQuestCard({ 
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
  const [currentIndex, setCurrentIndex] = useState(0);
  const [direction, setDirection] = useState(0);
  const [isEditing, setIsEditing] = useState(false);
  const [editedEmoji, setEditedEmoji] = useState('');
  const [editedName, setEditedName] = useState('');

  const currentQuest = quests[currentIndex];
  const questKey = `${categoryKey}_${currentQuest.level}`;
  const isCompleted = completedToday[questKey];
  const isCelebrating = celebrationQuest === categoryKey;
  const Icon = categoryInfo.icon;

  const swipeConfidenceThreshold = 10000;
  const swipePower = (offset, velocity) => {
    return Math.abs(offset) * velocity;
  };

  const paginate = (newDirection) => {
    const newIndex = currentIndex + newDirection;
    if (newIndex >= 0 && newIndex < quests.length) {
      setDirection(newDirection);
      setCurrentIndex(newIndex);
    }
  };

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
    <div className="space-y-2">
      {/* Category Header */}
      <div className="flex items-center gap-2 px-1">
        <button
          onClick={onCategoryClick}
          className="flex items-center gap-2 hover:opacity-70 transition-opacity cursor-pointer"
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
          Lvl {categoryLevel || 1}
        </span>
      </div>

      {/* Swipeable Quest Card */}
      <div className="relative">
        <div className="overflow-hidden min-h-[88px]">
        <AnimatePresence initial={false} custom={direction} mode="wait">
          <motion.div
            key={currentIndex}
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
            onDragEnd={(e, { offset, velocity }) => {
              const swipe = swipePower(offset.x, velocity.x);

              if (swipe < -swipeConfidenceThreshold) {
                paginate(1);
              } else if (swipe > swipeConfidenceThreshold) {
                paginate(-1);
              }
            }}
            onClick={() => !isEditing && onToggleQuest(categoryKey, currentQuest.level)}
            className={`
              relative overflow-hidden rounded-2xl p-5 cursor-pointer
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
                  className={`
                    relative w-9 h-9 rounded-full flex items-center justify-center
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
                  <div className="flex items-center gap-2">
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
                      className={`
                        p-1.5 rounded-lg transition-all hover:scale-110 active:scale-95
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
                      className={`
                        p-1.5 rounded-lg transition-all hover:scale-110 active:scale-95
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
                      className={`
                        p-1.5 rounded-lg transition-all hover:scale-110 active:scale-95
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
        <div className="flex items-center justify-center gap-1.5 mt-3 h-4">
        {quests.length > 1 && (
          <>
            {quests.map((quest, idx) => {
              const questKey = `${categoryKey}_${quest.level}`;
              const isQuestCompleted = completedToday[questKey];
              
              return (
                <button
                  key={idx}
                  onClick={() => {
                    setDirection(idx > currentIndex ? 1 : -1);
                    setCurrentIndex(idx);
                  }}
                  className={`
                    transition-all duration-300
                    ${idx === currentIndex 
                      ? 'w-6 h-1.5 rounded-full' 
                      : 'w-1.5 h-1.5 rounded-full'
                    }
                  `}
                  style={{ 
                    backgroundColor: isQuestCompleted 
                      ? categoryInfo.color 
                      : theme === 'light' 
                        ? '#d1d5db' 
                        : 'rgba(255, 255, 255, 0.2)' 
                  }}
                />
              );
            })}
          </>
        )}
        </div>
      </div>
    </div>
  );
}