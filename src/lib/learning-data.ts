import type { VocabCard } from "./store";
import type { StudySession } from "./study-store";

export type LearningData = {
  version: 1;
  cards: VocabCard[];
  progress: {
    streak: number; lastStudyDate: string | null; totalReviews: number; xp: number;
    level: number; dailyGoal: number; lastDailyGen: string | null;
  };
  session: StudySession | null;
  read: string[];
};

export function isLearningData(value: unknown): value is LearningData {
  if (!value || typeof value !== "object") return false;
  const data = value as LearningData;
  const validCard = (card: VocabCard) => !!card && typeof card.id === "string" &&
    typeof card.front === "string" && typeof card.back === "string" && typeof card.level === "string" &&
    typeof card.createdAt === "string" && Number.isFinite(new Date(card.createdAt).getTime()) &&
    card.due != null && Number.isFinite(new Date(card.due).getTime()) &&
    Number.isInteger(card.leitnerStage) && card.leitnerStage >= 0 && card.leitnerStage <= 6 &&
    Array.isArray(card.tags) && card.tags.every(tag => typeof tag === "string");
  const strings = (values: unknown): values is string[] => Array.isArray(values) && values.every(item => typeof item === "string");
  const session = data.session;
  return data.version === 1 && Array.isArray(data.cards) && data.cards.every(validCard) &&
    !!data.progress && [data.progress.xp, data.progress.totalReviews, data.progress.streak,
      data.progress.level, data.progress.dailyGoal].every(value => typeof value === "number" && Number.isFinite(value)) &&
    strings(data.read) &&
    (session === null || (!!session && typeof session.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(session.date) &&
      Number.isInteger(session.step) && session.step >= 0 && session.step <= 3 && typeof session.completed === "boolean" &&
      Array.isArray(session.questions) && session.questions.every(question => question && typeof question.id === "string" &&
        typeof question.cardId === "string" && ["cloze", "listen", "reverse"].includes(question.kind)) &&
      Array.isArray(session.reviewCards) && session.reviewCards.every(validCard) &&
      Array.isArray(session.newCards) && session.newCards.every(validCard) &&
      strings(session.reviewed) && strings(session.learned) && Array.isArray(session.answers) &&
      session.answers.every(answer => answer && typeof answer.id === "string" && typeof answer.correct === "boolean") &&
      Array.isArray(session.elapsed) && session.elapsed.length === 4 && session.elapsed.every(value => Number.isFinite(value) && value >= 0) &&
      strings(session.sentences) && session.sentences.length === 3));
}

// First sign-in only: import guest vocabulary without adding duplicate words.
// Cloud IDs stay stable so the existing cloud study session keeps its references.
export function importGuestData(cloud: LearningData, guest: LearningData): LearningData {
  const cards = [...cloud.cards];
  const words = new Set(cards.map(card => card.front.trim().toLowerCase()));
  const ids = new Set(cards.map(card => card.id));
  const remap = new Map<string, string>();
  for (const card of guest.cards) {
    const existing = cards.find(value => value.front.trim().toLowerCase() === card.front.trim().toLowerCase());
    if (existing) {
      remap.set(card.id, existing.id);
      if (card.last_review && (!existing.last_review || new Date(card.last_review) > new Date(existing.last_review))) {
        cards[cards.indexOf(existing)] = { ...existing, ...card, id: existing.id };
      }
      continue;
    }
    if (!words.has(card.front.trim().toLowerCase())) {
      const id = ids.has(card.id) ? crypto.randomUUID() : card.id;
      remap.set(card.id, id);
      cards.push({ ...card, id }); ids.add(id); words.add(card.front.trim().toLowerCase());
    }
  }
  const useGuestSession = guest.session && (!cloud.session || guest.session.date > cloud.session.date);
  let session = cloud.session;
  if (useGuestSession && guest.session) {
    const id = (value: string) => remap.get(value) || value;
    session = { ...guest.session,
      reviewCards: guest.session.reviewCards.map(card => ({ ...card, id: id(card.id) })),
      newCards: guest.session.newCards.map(card => ({ ...card, id: id(card.id) })),
      reviewed: guest.session.reviewed.map(id), learned: guest.session.learned.map(id),
      questions: guest.session.questions.map(question => ({ ...question, cardId: id(question.cardId) })),
    };
  }
  const xp = Math.max(cloud.progress.xp, guest.progress.xp);
  return { version: 1, cards, session, read: [...new Set([...cloud.read, ...guest.read])],
    progress: { ...cloud.progress, xp, level: Math.floor(xp / 100) + 1,
      totalReviews: Math.max(cloud.progress.totalReviews, guest.progress.totalReviews),
      streak: Math.max(cloud.progress.streak, guest.progress.streak),
      lastStudyDate: [cloud.progress.lastStudyDate, guest.progress.lastStudyDate].filter(Boolean).sort().at(-1) || null,
      lastDailyGen: [cloud.progress.lastDailyGen, guest.progress.lastDailyGen].filter(Boolean).sort().at(-1) || null,
    } };
}
