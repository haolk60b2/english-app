import OpenAI from "openai";

export const DEFAULT_BASE_URL = "https://api.openai.com/v1";
export const SHOPAIKEY_BASE_URL = "https://api.shopaikey.com/v1";
export const SHOPAIKEY_DIRECT_URL = "https://direct.shopaikey.com/v1";

// Lấy baseURL từ header (client) hoặc ENV
export function getBaseURL(reqHeaders?: Headers): string | undefined {
  const headerUrl = reqHeaders?.get("x-openai-base-url")?.trim();
  if (headerUrl) return headerUrl;
  const envUrl = process.env.OPENAI_BASE_URL?.trim();
  if (envUrl) return envUrl;
  return undefined; // để OpenAI SDK dùng default
}

// Hỗ trợ 2 nguồn key: ENV (server) hoặc header x-openai-key (khi user nhập ở UI)
export function getOpenAIClient(reqHeaders?: Headers): OpenAI | null {
  const headerKey = reqHeaders?.get("x-openai-key")?.trim();
  const envKey = process.env.OPENAI_API_KEY?.trim();
  const key = headerKey || envKey;
  if (!key) return null;
  const baseURL = getBaseURL(reqHeaders);
  return new OpenAI({ apiKey: key, ...(baseURL ? { baseURL } : {}) });
}

export function requireOpenAI(reqHeaders?: Headers) {
  const client = getOpenAIClient(reqHeaders);
  if (!client) {
    throw new Error("Thiếu OPENAI_API_KEY. Thêm vào .env.local hoặc nhập ở trang Cài đặt.");
  }
  return client;
}

export function getKeySource(reqHeaders?: Headers): "header" | "env" | "none" {
  if (reqHeaders?.get("x-openai-key")?.trim()) return "header";
  if (process.env.OPENAI_API_KEY?.trim()) return "env";
  return "none";
}

export function getBaseURLSource(reqHeaders?: Headers): string {
  return getBaseURL(reqHeaders) || DEFAULT_BASE_URL;
}

export const DEFAULT_CHAT_MODEL = "gpt-4.1-mini";
export function getChatModel(reqHeaders?: Headers): string {
  const headerModel = reqHeaders?.get("x-openai-model")?.trim();
  if (headerModel) return headerModel;
  const envModel = process.env.OPENAI_MODEL?.trim();
  if (envModel) return envModel;
  return DEFAULT_CHAT_MODEL;
}

// Fallback chain khi ShopAikey báo 429 model_not_found / upstream saturated
// Ưu tiên model rẻ và có trong Cheap API (đã verify: gpt-5-mini, gpt-4o-2024-08-06 có trong list)
export const FALLBACK_MODELS = [
  "gpt-5-mini",
  "gpt-4o-2024-08-06",
  "gpt-4o",
  "gpt-4.1-mini",
  "gpt-4o-mini",
  "gpt-3.5-turbo",
  "gpt-4",
];

function isRetriableModelError(msg: string, status?: number): boolean {
  const m = msg.toLowerCase();
  return (
    status === 429 ||
    status === 503 ||
    m.includes("model_not_found") ||
    m.includes("không có model") ||
    m.includes("负载已饱和") ||
    m.includes("upstream") ||
    m.includes("no such model") ||
    m.includes("does not exist") ||
    m.includes("not found")
  );
}

export async function chatWithFallback(
  client: OpenAI,
  primaryModel: string,
  params: Omit<Parameters<OpenAI["chat"]["completions"]["create"]>[0], "model">,
  reqHeaders?: Headers
): Promise<{ completion: any; modelUsed: string; tried: string[] }> {
  // Thử cả 2 baseURL nếu là ShopAikey (api ↔ direct) vì upstream saturated có thể chỉ ở 1 cụm
  const primaryBase = getBaseURL(reqHeaders);
  const bases: (string | undefined)[] = [primaryBase];
  if (primaryBase?.includes("api.shopaikey.com")) bases.push("https://direct.shopaikey.com/v1");
  else if (primaryBase?.includes("direct.shopaikey.com")) bases.push("https://api.shopaikey.com/v1");
  const uniqueBases = [...new Set(bases)];

  const candidates = [primaryModel, ...FALLBACK_MODELS.filter(m => m !== primaryModel)];
  let lastError: unknown = null;
  const tried: string[] = [];

  for (const base of uniqueBases) {
    const tryClient = base ? new OpenAI({ apiKey: (client as any).apiKey || (reqHeaders?.get("x-openai-key") || process.env.OPENAI_API_KEY)!, baseURL: base }) : client;
    // trick: OpenAI client stores apiKey differently; fallback lấy từ headers/env
    const apiKey = (tryClient as any).apiKey || reqHeaders?.get("x-openai-key") || process.env.OPENAI_API_KEY;
    const c = apiKey ? new OpenAI({ apiKey, ...(base ? { baseURL: base } : {}) }) : tryClient;

    for (const model of candidates) {
      const label = `${model}@${base || "default"}`;
      tried.push(label);
      try {
        const completion: any = await (c.chat.completions.create as any)({ ...params, model });
        if (label !== `${primaryModel}@${primaryBase || "default"}`) console.warn(`[openai fallback] ${primaryModel} failed, succeeded with ${label}`);
        return { completion, modelUsed: model, tried };
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        const status = (e as any)?.status || (e as any)?.statusCode;
        lastError = e;
        const isLast = base === uniqueBases[uniqueBases.length - 1] && model === candidates[candidates.length - 1];
        if (isRetriableModelError(msg, status) && !isLast) {
          console.warn(`[openai fallback] ${label} failed (${status||""} ${msg.slice(0,140)}), trying next...`);
          if (status === 429) await new Promise(r => setTimeout(r, 1200));
          else if (status === 503) await new Promise(r => setTimeout(r, 600));
          continue;
        }
        if (!isRetriableModelError(msg, status)) throw e;
      }
    }
  }
  throw lastError;
}
