import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, Circle } from 'lucide-react';

export default function SwipeableQuestCard({ 
  categoryKey, 
  categoryInfo, 
  quests, 
  completedToday, 
  onToggleQuest,
  celebrationQuest,
  completedText,
  pendingText,
  theme 
}) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [direction, setDirection] = useState(0);

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
        <div className={`p-1.5 rounded-lg ${categoryInfo.bgColor}`}>
          <Icon className={`w-4 h-4 ${categoryInfo.textColor}`} />
        </div>
        <span className={`text-sm font-medium ${categoryInfo.textColor}`}>
          {categoryInfo.name}
        </span>
        <div className="flex-1 h-px bg-white/5" />
        <span className="text-xs text-gray-500">
          Lvl {currentQuest.level}
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
              x: { type: "spring", stiffness: 200, damping: 25 },
              opacity: { duration: 0.3 }
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
            className={`
              relative overflow-hidden rounded-2xl p-5
              transition-all duration-300 ease-out border
              ${isCompleted 
                ? `${categoryInfo.bgColor} ${categoryInfo.borderColor}` 
                : theme === 'light'
                  ? 'bg-white border-gray-200'
                  : 'bg-[#1e2836] border-white/5'
              }
              ${isCelebrating ? 'scale-[1.02]' : 'scale-100'}
            `}
          >
            {isCelebrating && (
              <div className={`absolute inset-0 ${categoryInfo.bgColor} animate-pulse`} />
            )}
            
            <div className="relative flex items-center gap-4">
              {/* Checkbox */}
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
              
              {/* Quest Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2.5">
                  <span className="text-2xl">{currentQuest.emoji}</span>
                  <span className={`
                    text-base font-medium transition-all duration-300
                    ${isCompleted 
                      ? theme === 'light' ? 'text-gray-500 line-through' : 'text-gray-400 line-through'
                      : theme === 'light' ? 'text-gray-900' : 'text-white'
                    }
                  `}>
                    {currentQuest.name}
                  </span>
                </div>
              </div>
              
              {/* Status Badge */}
              <div className={`
                w-7 h-7 rounded-full flex items-center justify-center text-base font-medium flex-shrink-0
                transition-all duration-300
                ${isCompleted 
                  ? `${categoryInfo.bgColor} ${categoryInfo.textColor}` 
                  : theme === 'light'
                    ? 'bg-gray-100 text-gray-600'
                    : 'bg-white/5 text-gray-500'
                }
              `}>
                {isCompleted ? completedText : pendingText}
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
        </div>

        {/* Dots Indicator */}
        <div className="flex items-center justify-center gap-1.5 mt-3 h-4">
        {quests.length > 1 && (
          <>
            {quests.map((_, idx) => (
              <button
                key={idx}
                onClick={() => {
                  setDirection(idx > currentIndex ? 1 : -1);
                  setCurrentIndex(idx);
                }}
                className={`
                  transition-all duration-300
                  ${idx === currentIndex 
                    ? `w-6 h-1.5 rounded-full ${categoryInfo.textColor}` 
                    : theme === 'light'
                      ? 'w-1.5 h-1.5 rounded-full bg-gray-300'
                      : 'w-1.5 h-1.5 rounded-full bg-white/20'
                  }
                `}
                style={idx === currentIndex ? { backgroundColor: categoryInfo.color } : {}}
              />
            ))}
          </>
        )}
        </div>
      </div>
    </div>
  );
}