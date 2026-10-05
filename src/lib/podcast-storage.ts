import type { PracticeMaterial } from "./practice-materials";
export type SavedPodcast = { key: string; owner: string; material: PracticeMaterial; audio?: Blob; audioName?: string; createdAt: string };
async function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("english-app-podcasts", 1);
    request.onupgradeneeded = () => { const store = request.result.createObjectStore("lessons", { keyPath: "key" }); store.createIndex("owner", "owner"); };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error("Không mở được kho podcast trên trình duyệt."));
  });
}
async function operation<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("lessons", mode);
    const request = run(transaction.objectStore("lessons"));
    transaction.oncomplete = () => { db.close(); resolve(request.result); };
    transaction.onabort = transaction.onerror = () => { db.close(); reject(new Error("Chưa lưu được podcast. Kho lưu trữ trình duyệt có thể đã đầy.")); };
  });
}
export async function listPodcasts(owner: string): Promise<SavedPodcast[]> { return operation("readonly", store => store.index("owner").getAll(owner)); }
export async function savePodcast(podcast: SavedPodcast) { await operation("readwrite", store => store.put(podcast)); }
export async function deletePodcast(owner: string, id: string) { await operation("readwrite", store => store.delete(`${owner}:${id}`)); }
