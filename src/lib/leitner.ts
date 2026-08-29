// Lịch ôn theo ảnh: Lần 1 sau 1 ngày, lần 2 sau 3 ngày, 3 sau 7 ngày, 4 sau 14 ngày, 5 sau 30 ngày, 6+ sau 60 ngày
// Tổng thời gian tính từ lúc học: Ngày 1,4,11,25,55, 4-6 tháng+
export const INTERVALS_DAYS = [1, 3, 7, 14, 30, 60]; // index 0 = lần 1, 5 = lần 6+
export const CUMULATIVE_DAYS = [1, 4, 11, 25, 55, 115]; // 115 ~ 4 tháng

export type LeitnerStage = 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0 = new chưa học, 1-6 = đã qua các lần

export function nextStage(current: LeitnerStage, correct: boolean): LeitnerStage {
  if (!correct) return 0; // trả về học lại từ đầu (hoặc có thể giữ nguyên tùy chính sách, ở đây reset để đảm bảo thuộc)
  // hoặc nếu muốn nhẹ hơn: max(0, current-1)
  if (current >= 6) return 6; // đã master, giữ 60 ngày
  return (current + 1) as LeitnerStage;
}

export function intervalForStage(stage: LeitnerStage): number {
  if (stage === 0) return 0; // due ngay
  const idx = Math.min(stage - 1, INTERVALS_DAYS.length - 1);
  return INTERVALS_DAYS[idx];
}

export function dueDateForStage(stage: LeitnerStage, from: Date = new Date()): Date {
  const days = intervalForStage(stage);
  const d = new Date(from);
  d.setDate(d.getDate() + days);
  // reset giờ để so sánh theo ngày
  d.setHours(0, 0, 0, 0);
  return d;
}

export function stageLabel(stage: LeitnerStage): string {
  const labels: Record<LeitnerStage, string> = {
    0: "Mới",
    1: "Ngày 1",
    2: "Ngày 4",
    3: "Ngày 11",
    4: "Ngày 25",
    5: "Ngày 55",
    6: "Master 60+",
  };
  return labels[stage];
}

export function stageColor(stage: LeitnerStage): string {
  const colors: Record<LeitnerStage, string> = {
    0: "bg-zinc-100 text-zinc-600",
    1: "bg-amber-100 text-amber-800",
    2: "bg-orange-100 text-orange-800",
    3: "bg-rose-100 text-rose-800",
    4: "bg-violet-100 text-violet-800",
    5: "bg-emerald-100 text-emerald-800",
    6: "bg-gradient-to-r from-amber-400 to-pink-500 text-white",
  };
  return colors[stage];
}

// Helper tính xem card có đến hạn hôm nay chưa (so theo ngày)
export function isDueToday(due: Date | string): boolean {
  const d = new Date(due);
  d.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return d.getTime() <= today.getTime();
}
