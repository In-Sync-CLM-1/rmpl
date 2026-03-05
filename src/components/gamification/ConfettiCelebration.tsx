import { useEffect, useCallback } from 'react';
import confetti from 'canvas-confetti';

interface ConfettiCelebrationProps {
  trigger: boolean;
  type?: 'points' | 'star-upgrade' | 'winner' | 'achievement';
  onComplete?: () => void;
}

export function ConfettiCelebration({ trigger, type = 'points', onComplete }: ConfettiCelebrationProps) {
  const fireConfetti = useCallback(() => {
    switch (type) {
      case 'winner':
        // Grand celebration for monthly winners
        const duration = 5 * 1000;
        const animationEnd = Date.now() + duration;
        const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 9999 };

        const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min;

        const interval = setInterval(() => {
          const timeLeft = animationEnd - Date.now();

          if (timeLeft <= 0) {
            clearInterval(interval);
            onComplete?.();
            return;
          }

          const particleCount = 50 * (timeLeft / duration);

          // Confetti from both sides
          confetti({
            ...defaults,
            particleCount,
            origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 },
            colors: ['#FFD700', '#FFA500', '#FF6347', '#9400D3', '#00CED1'],
          });
          confetti({
            ...defaults,
            particleCount,
            origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 },
            colors: ['#FFD700', '#FFA500', '#FF6347', '#9400D3', '#00CED1'],
          });
        }, 250);
        break;

      case 'star-upgrade':
        // Starburst effect for tier upgrades
        const count = 200;
        const starDefaults = {
          origin: { y: 0.7 },
          zIndex: 9999,
        };

        function fire(particleRatio: number, opts: confetti.Options) {
          confetti({
            ...starDefaults,
            ...opts,
            particleCount: Math.floor(count * particleRatio),
          });
        }

        fire(0.25, {
          spread: 26,
          startVelocity: 55,
          colors: ['#FFD700', '#FFA500'],
        });
        fire(0.2, {
          spread: 60,
          colors: ['#C0C0C0', '#FFD700'],
        });
        fire(0.35, {
          spread: 100,
          decay: 0.91,
          scalar: 0.8,
          colors: ['#9400D3', '#FFD700'],
        });
        fire(0.1, {
          spread: 120,
          startVelocity: 25,
          decay: 0.92,
          scalar: 1.2,
          colors: ['#00CED1', '#FFD700'],
        });
        fire(0.1, {
          spread: 120,
          startVelocity: 45,
          colors: ['#FFD700'],
        });

        setTimeout(() => onComplete?.(), 2000);
        break;

      case 'achievement':
        // Medium celebration for achievements
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#3B82F6', '#10B981', '#8B5CF6'],
          zIndex: 9999,
        });
        setTimeout(() => onComplete?.(), 1500);
        break;

      case 'points':
      default:
        // Quick burst for earning points
        confetti({
          particleCount: 30,
          spread: 50,
          origin: { y: 0.8, x: 0.9 },
          colors: ['#3B82F6', '#60A5FA', '#93C5FD'],
          zIndex: 9999,
          gravity: 1.2,
          scalar: 0.8,
        });
        setTimeout(() => onComplete?.(), 800);
        break;
    }
  }, [type, onComplete]);

  useEffect(() => {
    if (trigger) {
      fireConfetti();
    }
  }, [trigger, fireConfetti]);

  return null;
}

// Utility function to fire confetti from anywhere
export function fireConfetti(type: 'points' | 'star-upgrade' | 'winner' | 'achievement' = 'points') {
  switch (type) {
    case 'winner':
      const duration = 3 * 1000;
      const animationEnd = Date.now() + duration;
      const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 9999 };

      const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min;

      const interval = setInterval(() => {
        const timeLeft = animationEnd - Date.now();

        if (timeLeft <= 0) {
          clearInterval(interval);
          return;
        }

        const particleCount = 50 * (timeLeft / duration);

        confetti({
          ...defaults,
          particleCount,
          origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 },
          colors: ['#FFD700', '#FFA500', '#FF6347', '#9400D3', '#00CED1'],
        });
        confetti({
          ...defaults,
          particleCount,
          origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 },
          colors: ['#FFD700', '#FFA500', '#FF6347', '#9400D3', '#00CED1'],
        });
      }, 250);
      break;

    case 'star-upgrade':
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#FFD700', '#FFA500', '#C0C0C0'],
        zIndex: 9999,
      });
      break;

    case 'achievement':
      confetti({
        particleCount: 80,
        spread: 60,
        origin: { y: 0.6 },
        colors: ['#3B82F6', '#10B981', '#8B5CF6'],
        zIndex: 9999,
      });
      break;

    case 'points':
    default:
      confetti({
        particleCount: 25,
        spread: 45,
        origin: { y: 0.8, x: 0.9 },
        colors: ['#3B82F6', '#60A5FA'],
        zIndex: 9999,
        gravity: 1.2,
        scalar: 0.8,
      });
      break;
  }
}
