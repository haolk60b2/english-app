"use client";

export const LS_KEY = "openai_api_key";
export const LS_BASE_URL = "openai_base_url";
export const LS_MODEL = "openai_model";

export function getClientKey(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(LS_KEY);
}
export function setClientKey(key: string) {
  if (!key.trim()) localStorage.removeItem(LS_KEY);
  else localStorage.setItem(LS_KEY, key.trim());
}

export function getClientBaseURL(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(LS_BASE_URL);
}
export function setClientBaseURL(url: string) {
  if (!url.trim()) localStorage.removeItem(LS_BASE_URL);
  else localStorage.setItem(LS_BASE_URL, url.trim());
}
export function getClientModel(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(LS_MODEL);
}
export function setClientModel(m: string) {
  if (!m.trim()) localStorage.removeItem(LS_MODEL);
  else localStorage.setItem(LS_MODEL, m.trim());
}

export function withKeyHeaders(init?: RequestInit): RequestInit {
  const key = getClientKey();
  const baseUrl = getClientBaseURL();
  const model = getClientModel();
  const headers: Record<string, string> = {
    ...(init?.headers as Record<string, string> | undefined),
  };
  if (key) headers["x-openai-key"] = key;
  if (baseUrl) headers["x-openai-base-url"] = baseUrl;
  if (model) headers["x-openai-model"] = model;
  return { ...init, headers };
}

// helper cũ cho các page đang dùng trực tiếp
export function getAuthHeaders(): Record<string, string> {
  const h: Record<string, string> = {};
  const k = getClientKey();
  const b = getClientBaseURL();
  const m = getClientModel();
  if (k) h["x-openai-key"] = k;
  if (b) h["x-openai-base-url"] = b;
  if (m) h["x-openai-model"] = m;
  return h;
}
