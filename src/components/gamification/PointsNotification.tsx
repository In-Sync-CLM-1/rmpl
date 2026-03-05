import { useEffect, useState, createContext, useContext, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Minus, Trophy, Star, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { fireConfetti } from './ConfettiCelebration';

interface PointsNotification {
  id: string;
  points: number;
  description: string;
  type: 'earn' | 'deduct' | 'tier-up' | 'winner';
}

interface PointsNotificationContextType {
  showNotification: (notification: Omit<PointsNotification, 'id'>) => void;
}

const PointsNotificationContext = createContext<PointsNotificationContextType | null>(null);

export function usePointsNotification() {
  const context = useContext(PointsNotificationContext);
  if (!context) {
    throw new Error('usePointsNotification must be used within PointsNotificationProvider');
  }
  return context;
}

export function PointsNotificationProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<PointsNotification[]>([]);

  const showNotification = useCallback((notification: Omit<PointsNotification, 'id'>) => {
    const id = Math.random().toString(36).substr(2, 9);
    const newNotification = { ...notification, id };
    
    setNotifications(prev => [...prev, newNotification]);

    // Fire confetti based on type
    if (notification.type === 'winner') {
      fireConfetti('winner');
    } else if (notification.type === 'tier-up') {
      fireConfetti('star-upgrade');
    } else if (notification.points > 0 && notification.points >= 5) {
      fireConfetti('achievement');
    } else if (notification.points > 0) {
      fireConfetti('points');
    }

    // Auto-remove after animation
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 3000);
  }, []);

  return (
    <PointsNotificationContext.Provider value={{ showNotification }}>
      {children}
      <PointsNotificationDisplay notifications={notifications} />
    </PointsNotificationContext.Provider>
  );
}

function PointsNotificationDisplay({ notifications }: { notifications: PointsNotification[] }) {
  return (
    <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2">
      <AnimatePresence>
        {notifications.map((notification) => (
          <motion.div
            key={notification.id}
            initial={{ opacity: 0, y: 50, scale: 0.3 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.5, transition: { duration: 0.2 } }}
            className={cn(
              "flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg backdrop-blur-sm",
              notification.type === 'earn' && "bg-success-green/90 text-white",
              notification.type === 'deduct' && "bg-destructive/90 text-white",
              notification.type === 'tier-up' && "bg-gradient-to-r from-yellow-500 to-amber-500 text-white",
              notification.type === 'winner' && "bg-gradient-to-r from-purple-600 to-pink-600 text-white",
            )}
          >
            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-white/20">
              {notification.type === 'earn' && <Plus className="w-6 h-6" />}
              {notification.type === 'deduct' && <Minus className="w-6 h-6" />}
              {notification.type === 'tier-up' && <Star className="w-6 h-6 fill-current" />}
              {notification.type === 'winner' && <Trophy className="w-6 h-6" />}
            </div>
            
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold">
                  {notification.points > 0 ? '+' : ''}{notification.points}
                </span>
                <span className="text-sm opacity-90">points</span>
                {notification.type === 'tier-up' && (
                  <Sparkles className="w-4 h-4 animate-pulse" />
                )}
              </div>
              <span className="text-xs opacity-80">{notification.description}</span>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
