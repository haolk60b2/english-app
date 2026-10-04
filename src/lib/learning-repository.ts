"use client";
import { supabase } from "./supabase";
import { isLearningData, type LearningData } from "./learning-data";
import type { VocabCard } from "./store";
import type { StudySession } from "./study-store";

export type SessionRecord = Omit<StudySession, "reviewCards" | "newCards"> & { reviewIds: string[]; newIds: string[] };
export type LearningChanges = {
  cards: VocabCard[]; deletedCardIds: string[];
  progress?: LearningData["progress"]; session?: SessionRecord | null;
  lessons: { id: string; read: boolean }[];
};
export type CloudDelta = { revision: number; updated_at: string; current_session_date: string | null;
  cards: Record<string, unknown>[]; progress: Record<string, unknown> | null;
  session: SessionRecord | null; lessons: { lesson_id: string; is_read: boolean }[] };

function stable(value: unknown): string {
  return JSON.stringify(value, (_, item) => item && typeof item === "object" && !Array.isArray(item)
    ? Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]])) : item);
}
export function sessionRecord(session: StudySession | null): SessionRecord | null {
  if (!session) return null;
  const { reviewCards, newCards, ...rest } = session;
  return { ...rest, reviewIds: reviewCards.map(card => card.id), newIds: newCards.map(card => card.id) };
}
export function sameLearningData(a: LearningData | null, b: LearningData | null): boolean {
  const comparable = (data: LearningData | null) => data && { ...data,
    cards: [...data.cards].sort((a, b) => a.id.localeCompare(b.id)),
    read: [...data.read].sort(), session: sessionRecord(data.session) };
  return stable(comparable(a)) === stable(comparable(b));
}
export function buildLearningChanges(base: LearningData | null, next: LearningData): LearningChanges {
  const oldCards = new Map(base?.cards.map(card => [card.id, card]));
  const currentIds = new Set(next.cards.map(card => card.id));
  const oldRead = new Set(base?.read), currentRead = new Set(next.read);
  const changes: LearningChanges = {
    cards: next.cards.filter(card => stable(card) !== stable(oldCards.get(card.id))),
    deletedCardIds: (base?.cards || []).filter(card => !currentIds.has(card.id)).map(card => card.id),
    lessons: [...new Set([...oldRead, ...currentRead])].filter(id => oldRead.has(id) !== currentRead.has(id))
      .map(id => ({ id, read: currentRead.has(id) })),
  };
  if (!base || stable(base.progress) !== stable(next.progress)) changes.progress = next.progress;
  if (!base || stable(sessionRecord(base.session)) !== stable(sessionRecord(next.session))) changes.session = sessionRecord(next.session);
  return changes;
}
export function hasLearningChanges(changes: LearningChanges): boolean {
  return !!(changes.cards.length || changes.deletedCardIds.length || changes.lessons.length ||
    changes.progress !== undefined || changes.session !== undefined);
}
function fromCard(row: Record<string, unknown>): VocabCard {
  const date = (value: unknown) => new Date(String(value)).toISOString();
  // JSON round-trip matches the existing persisted store, omitting null optional fields.
  return JSON.parse(JSON.stringify({
    id: row.client_id, front: row.front, back: row.back,
    backEn: row.back_en ?? undefined, backVi: row.back_vi ?? undefined,
    example: row.example ?? undefined, phonetic: row.phonetic ?? undefined, exampleVi: row.example_vi ?? undefined,
    level: row.level, tags: row.tags, leitnerStage: row.leitner_stage, createdAt: date(row.created_at),
    due: date(row.due), last_review: row.last_review ? date(row.last_review) : undefined,
    state: row.state, stability: row.stability, difficulty: row.difficulty, reps: row.reps, lapses: row.lapses,
    elapsed_days: row.elapsed_days, scheduled_days: row.scheduled_days, learning_steps: row.learning_steps,
  }));
}
function fromProgress(row: Record<string, unknown>): LearningData["progress"] {
  return { streak: Number(row.streak), lastStudyDate: row.last_study_date as string | null,
    totalReviews: Number(row.total_reviews), xp: Number(row.xp), level: Number(row.level),
    dailyGoal: Number(row.daily_goal), lastDailyGen: row.last_daily_gen as string | null };
}
export function applyCloudDelta(base: LearningData, delta: CloudDelta): LearningData {
  const cards = new Map(base.cards.map(card => [card.id, card]));
  for (const row of delta.cards) {
    if (row.deleted_at) cards.delete(String(row.client_id));
    else { const card = fromCard(row); cards.set(card.id, card); }
  }
  const read = new Set(base.read);
  for (const lesson of delta.lessons) { if (lesson.is_read) read.add(lesson.lesson_id); else read.delete(lesson.lesson_id); }
  let session = base.session;
  if (!delta.current_session_date) session = null;
  else if (delta.session) {
    const { reviewIds, newIds, ...metadata } = delta.session;
    const available = (ids: string[]) => ids.flatMap(id => cards.has(id) ? [cards.get(id)!] : []);
    const sessionIds = new Set([...reviewIds, ...newIds].filter(id => cards.has(id)));
    const questions = metadata.questions.filter(question => sessionIds.has(question.cardId));
    session = { ...metadata, reviewCards: available(reviewIds), newCards: available(newIds), questions,
      reviewed: metadata.reviewed.filter(id => sessionIds.has(id)), learned: metadata.learned.filter(id => sessionIds.has(id)),
      answers: metadata.answers.filter(answer => questions.some(question => question.id === answer.id)) };
  }
  const result: LearningData = { version: 1, cards: [...cards.values()], progress: delta.progress ? fromProgress(delta.progress) : base.progress,
    session, read: [...read] };
  if (!isLearningData(result)) throw new Error("Dữ liệu Supabase không đúng định dạng. Bản trên máy vẫn được giữ.");
  return result;
}
export async function readLearningData(base: LearningData, revision: number) {
  if (!supabase) throw new Error("Chưa cấu hình Supabase");
  const { data, error } = await supabase.rpc("get_learning_changes", { p_since_revision: revision });
  if (error) throw new Error(error.message);
  const delta = data as CloudDelta;
  if (!delta || !Number.isSafeInteger(delta.revision) || !Array.isArray(delta.cards) || !Array.isArray(delta.lessons))
    throw new Error("Phản hồi đồng bộ Supabase không hợp lệ");
  if (delta.revision < revision) throw new Error("Supabase đã được khôi phục về bản cũ. Tải bản sao dữ liệu trước khi đăng nhập lại.");
  return { payload: applyCloudDelta(base, delta), revision: delta.revision, updated_at: delta.updated_at };
}
export async function writeLearningChanges(base: LearningData, next: LearningData, revision: number) {
  if (!supabase) throw new Error("Chưa cấu hình Supabase");
  const changes = buildLearningChanges(base, next);
  if (!hasLearningChanges(changes)) return { conflict: false, revision, updated_at: null };
  const { data, error } = await supabase.rpc("save_learning_changes", { p_expected_revision: revision, p_changes: changes });
  if (error) throw new Error(error.message);
  if (!data || typeof data.conflict !== "boolean" || !Number.isSafeInteger(data.revision)) throw new Error("Phản hồi lưu Supabase không hợp lệ");
  return data as { conflict: boolean; revision: number; updated_at: string | null };
}
