// FSRS wrapper - dùng ts-fsrs, fallback SM-2 đơn giản nếu chưa có card history
import { fsrs, FSRS, Card, Rating, createEmptyCard } from "ts-fsrs";

const f: FSRS = fsrs();

export type SRCard = Card & {
  front: string;
  back: string;
  example?: string;
  level?: string; // CEFR A1-C2
};

export function createNewCard(front: string, back: string, example?: string): SRCard {
  return {
    ...createEmptyCard(new Date()),
    front,
    back,
    example,
  };
}

export function reviewCard(card: Card, rating: Rating): { card: Card; log: unknown } {
  const now = new Date();
  const result: any = f.repeat(card, now);
  const updated = result[rating].card;
  return { card: updated, log: result[rating].log };
}

export { Rating };

// Helper: lấy card đến hạn
export function isDue(card: Card): boolean {
  return new Date(card.due) <= new Date();
}

// SM-2 fallback cho demo không dùng fsrs
export function sm2(current: { interval: number; ease: number; reps: number }, quality: number) {
  let { interval, ease, reps } = current;
  if (quality < 3) {
    reps = 0;
    interval = 1;
  } else {
    if (reps === 0) interval = 1;
    else if (reps === 1) interval = 6;
    else interval = Math.round(interval * ease);
    ease = Math.max(1.3, ease + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)));
    reps++;
  }
  return { interval, ease, reps };
}
