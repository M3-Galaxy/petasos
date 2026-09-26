/**
 * Petasos v2 - Local Storage & Sync Queue Engine (IndexedDB)
 * 企画書セクション3のデータ構造に準拠したローカル永続化＆同期待ちキュー
 */

const DB_NAME = "petasos_db";
const DB_VERSION = 1;
const STORE_NOTES = "notes";
const STORE_QUEUE = "sync_queue";

function parseDateSafe(val) {
  if (!val) return 0;
  const t = Date.parse(val);
  if (!isNaN(t)) return t;
  // "2026/09/25 09:30" 形式対応
  const normalized = String(val).replace(/\//g, "-");
  const t2 = Date.parse(normalized);
  return isNaN(t2) ? 0 : t2;
}

export class PetasosStorage {
  constructor() {
    this.db = null;
  }

  // ---------------------------------------------------------------------------
  // IndexedDBの初期化
  // ---------------------------------------------------------------------------
  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (e) => {
        const db = e.target.result;

        // 1. notes ストア（メモ本体）
        if (!db.objectStoreNames.contains(STORE_NOTES)) {
          const notesStore = db.createObjectStore(STORE_NOTES, { keyPath: "id" });
          notesStore.createIndex("updated_at", "updated_at", { unique: false });
          notesStore.createIndex("created_at", "created_at", { unique: false });
          notesStore.createIndex("category", "category", { unique: false });
          notesStore.createIndex("status", "status", { unique: false });
        }

        // 2. sync_queue ストア（ちょっとした変更を預かる待機キュー）
        if (!db.objectStoreNames.contains(STORE_QUEUE)) {
          const queueStore = db.createObjectStore(STORE_QUEUE, { 
            keyPath: "queue_id", 
            autoIncrement: true 
          });
          queueStore.createIndex("timestamp", "timestamp", { unique: false });
          queueStore.createIndex("status", "status", { unique: false });
        }
      };

      request.onsuccess = (e) => {
        this.db = e.target.result;
        resolve(this);
      };

      request.onerror = (e) => {
        console.error("IndexedDB open error:", e.target.error);
        reject(e.target.error);
      };
    });
  }

  // ---------------------------------------------------------------------------
  // メモ全件取得（降順：最新が先頭）
  // ---------------------------------------------------------------------------
  async getAllNotes(includeArchived = false) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction([STORE_NOTES], "readonly");
      const store = tx.objectStore(STORE_NOTES);
      const request = store.getAll();

      request.onsuccess = () => {
        let notes = request.result || [];
        if (!includeArchived) {
          notes = notes.filter((n) => n.status !== "archived");
        }
        // updated_at または created_at または date の降順で安全にソート
        notes.sort((a, b) => {
          const timeA = parseDateSafe(a.updated_at || a.created_at || a.date);
          const timeB = parseDateSafe(b.updated_at || b.created_at || b.date);
          return timeB - timeA;
        });
        resolve(notes);
      };

      request.onerror = (e) => reject(e.target.error);
    });
  }

  // ---------------------------------------------------------------------------
  // メモ単件保存 ＆ 同期キューへの追加
  // ---------------------------------------------------------------------------
  async saveNote(note, actionType = "update") {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction([STORE_NOTES, STORE_QUEUE], "readwrite");
      const notesStore = tx.objectStore(STORE_NOTES);
      const queueStore = tx.objectStore(STORE_QUEUE);

      // 1. notes ストアに保存
      notesStore.put(note);

      // 2. sync_queue ストアにキューアイテムを追加
      const queueItem = {
        action: actionType, // 'create' | 'update' | 'archive'
        note_id: note.id,
        title: note.title,
        timestamp: new Date().toISOString(),
        status: "pending" // 'pending' | 'synced'
      };
      queueStore.add(queueItem);

      tx.oncomplete = () => resolve(queueItem);
      tx.onerror = (e) => reject(e.target.error);
    });
  }

  // ---------------------------------------------------------------------------
  // 初回シード投入（IndexedDBが空の場合のみサンプルデータを書き込む）
  // ---------------------------------------------------------------------------
  async seedInitialDataIfEmpty(initialNotes) {
    const existing = await this.getAllNotes();
    if (existing && existing.length > 0) {
      return existing; // すでにデータがあればそのまま返す
    }

    // 空なら初期データを投入
    const tx = this.db.transaction([STORE_NOTES], "readwrite");
    const store = tx.objectStore(STORE_NOTES);
    for (const note of initialNotes) {
      const item = { ...note };
      if (!item.created_at) {
        const timeMs = parseDateSafe(item.date) || Date.now();
        item.created_at = new Date(timeMs).toISOString();
      }
      if (!item.updated_at) {
        item.updated_at = item.created_at;
      }
      store.put(item);
    }

    return new Promise((resolve, reject) => {
      tx.oncomplete = async () => {
        const seeded = await this.getAllNotes();
        resolve(seeded);
      };
      tx.onerror = (e) => reject(e.target.error);
    });
  }

  // ---------------------------------------------------------------------------
  // メモ単件取得（ID指定・アーカイブ問わず取得）
  // ---------------------------------------------------------------------------
  async getNote(id) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction([STORE_NOTES], "readonly");
      const store = tx.objectStore(STORE_NOTES);
      const request = store.get(id);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = (e) => reject(e.target.error);
    });
  }

  // ---------------------------------------------------------------------------
  // リモート（GitHub）からのメモ取り込み（同期キュー追加なしでIndexedDBのみ更新）
  // ---------------------------------------------------------------------------
  async upsertNoteFromRemote(note) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction([STORE_NOTES], "readwrite");
      const store = tx.objectStore(STORE_NOTES);
      store.put(note);

      tx.oncomplete = () => resolve(note);
      tx.onerror = (e) => reject(e.target.error);
    });
  }

  // ---------------------------------------------------------------------------
  // 同期キューの未処理件数を取得
  // ---------------------------------------------------------------------------
  async getPendingQueueCount() {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction([STORE_QUEUE], "readonly");
      const store = tx.objectStore(STORE_QUEUE);
      const request = store.count();

      request.onsuccess = () => resolve(request.result || 0);
      request.onerror = (e) => reject(e.target.error);
    });
  }

  // ---------------------------------------------------------------------------
  // 全未処理キューアイテムを取得（GitHubプッシュ同期用）
  // ---------------------------------------------------------------------------
  async getPendingQueueItems() {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction([STORE_QUEUE], "readonly");
      const store = tx.objectStore(STORE_QUEUE);
      const request = store.getAll();

      request.onsuccess = () => {
        const items = request.result || [];
        // 古い変更順（FIFO）でソート
        items.sort((a, b) => (a.queue_id || 0) - (b.queue_id || 0));
        resolve(items);
      };
      request.onerror = (e) => reject(e.target.error);
    });
  }

  // ---------------------------------------------------------------------------
  // 同期済みキューアイテムの単件削除
  // ---------------------------------------------------------------------------
  async deleteQueueItem(queueId) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction([STORE_QUEUE], "readwrite");
      const store = tx.objectStore(STORE_QUEUE);
      const request = store.delete(queueId);

      request.onsuccess = () => resolve(true);
      request.onerror = (e) => reject(e.target.error);
    });
  }

  // ---------------------------------------------------------------------------
  // 全同期キューアイテムを取得（デバッグ用）
  // ---------------------------------------------------------------------------
  async getAllQueueItems() {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction([STORE_QUEUE], "readonly");
      const store = tx.objectStore(STORE_QUEUE);
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result || []);
      request.onerror = (e) => reject(e.target.error);
    });
  }

  // ---------------------------------------------------------------------------
  // 同期キューのクリア（手動リセット用）
  // ---------------------------------------------------------------------------
  async clearQueue() {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction([STORE_QUEUE], "readwrite");
      const store = tx.objectStore(STORE_QUEUE);
      const request = store.clear();

      request.onsuccess = () => resolve(true);
      request.onerror = (e) => reject(e.target.error);
    });
  }

  // ---------------------------------------------------------------------------
  // 複数メモのアーカイブ（手放す）
  // ---------------------------------------------------------------------------
  async archiveNotes(noteIds) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction([STORE_NOTES, STORE_QUEUE], "readwrite");
      const notesStore = tx.objectStore(STORE_NOTES);
      const queueStore = tx.objectStore(STORE_QUEUE);
      const updatedNotes = [];

      let processed = 0;
      const ids = Array.from(noteIds);
      if (ids.length === 0) return resolve([]);

      ids.forEach((id) => {
        const req = notesStore.get(id);
        req.onsuccess = () => {
          const note = req.result;
          if (note) {
            note.status = "archived";
            note.updated_at = new Date().toISOString();
            notesStore.put(note);
            queueStore.add({
              action: "archive",
              note_id: note.id,
              title: note.title,
              timestamp: new Date().toISOString(),
              status: "pending"
            });
            updatedNotes.push(note);
          }
          processed++;
        };
      });

      tx.oncomplete = () => resolve(updatedNotes);
      tx.onerror = (e) => reject(e.target.error);
    });
  }

  // ---------------------------------------------------------------------------
  // 複数メモの復元（手放したメモのUndo用）
  // ---------------------------------------------------------------------------
  async restoreNotes(noteIds) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction([STORE_NOTES, STORE_QUEUE], "readwrite");
      const notesStore = tx.objectStore(STORE_NOTES);
      const queueStore = tx.objectStore(STORE_QUEUE);
      const restoredNotes = [];

      const ids = Array.from(noteIds);
      if (ids.length === 0) return resolve([]);

      ids.forEach((id) => {
        const req = notesStore.get(id);
        req.onsuccess = () => {
          const note = req.result;
          if (note) {
            note.status = "active";
            note.updated_at = new Date().toISOString();
            notesStore.put(note);
            queueStore.add({
              action: "update",
              note_id: note.id,
              title: note.title,
              timestamp: new Date().toISOString(),
              status: "pending"
            });
            restoredNotes.push(note);
          }
        };
      });

      tx.oncomplete = () => resolve(restoredNotes);
      tx.onerror = (e) => reject(e.target.error);
    });
  }

  // ---------------------------------------------------------------------------
  // 複数メモのカテゴリ一括更新（グループ化）
  // ---------------------------------------------------------------------------
  async updateNotesCategory(noteIds, category) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction([STORE_NOTES, STORE_QUEUE], "readwrite");
      const notesStore = tx.objectStore(STORE_NOTES);
      const queueStore = tx.objectStore(STORE_QUEUE);
      const updatedNotes = [];

      const ids = Array.from(noteIds);
      if (ids.length === 0) return resolve([]);

      ids.forEach((id) => {
        const req = notesStore.get(id);
        req.onsuccess = () => {
          const note = req.result;
          if (note) {
            note.category = category;
            note.updated_at = new Date().toISOString();
            notesStore.put(note);
            queueStore.add({
              action: "update",
              note_id: note.id,
              title: note.title,
              timestamp: new Date().toISOString(),
              status: "pending"
            });
            updatedNotes.push(note);
          }
        };
      });

      tx.oncomplete = () => resolve(updatedNotes);
      tx.onerror = (e) => reject(e.target.error);
    });
  }

  // ---------------------------------------------------------------------------
  // 複数メモの相互リンク（全結合）
  // ---------------------------------------------------------------------------
  async addMutualLinks(noteIds) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction([STORE_NOTES, STORE_QUEUE], "readwrite");
      const notesStore = tx.objectStore(STORE_NOTES);
      const queueStore = tx.objectStore(STORE_QUEUE);
      const updatedNotes = [];

      const ids = Array.from(noteIds);
      if (ids.length < 2) return resolve([]);

      ids.forEach((currentId) => {
        const req = notesStore.get(currentId);
        req.onsuccess = () => {
          const note = req.result;
          if (note) {
            const currentLinks = new Set(note.links || []);
            // 自分以外のIDをリンクに追加
            ids.forEach((otherId) => {
              if (otherId !== currentId) {
                currentLinks.add(otherId);
              }
            });
            note.links = Array.from(currentLinks);
            note.updated_at = new Date().toISOString();
            notesStore.put(note);
            queueStore.add({
              action: "update",
              note_id: note.id,
              title: note.title,
              timestamp: new Date().toISOString(),
              status: "pending"
            });
            updatedNotes.push(note);
          }
        };
      });

      tx.oncomplete = () => resolve(updatedNotes);
      tx.onerror = (e) => reject(e.target.error);
    });
  }

  // ---------------------------------------------------------------------------
  // 複数メモの結合（Join：新メモ作成 ＆ 元メモアーカイブ）
  // ---------------------------------------------------------------------------
  async joinNotes(newNote, originalNoteIds) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction([STORE_NOTES, STORE_QUEUE], "readwrite");
      const notesStore = tx.objectStore(STORE_NOTES);
      const queueStore = tx.objectStore(STORE_QUEUE);

      // 1. 新しい結合メモを追加
      notesStore.put(newNote);
      queueStore.add({
        action: "create",
        note_id: newNote.id,
        title: newNote.title,
        timestamp: new Date().toISOString(),
        status: "pending"
      });

      // 2. 元のメモをアーカイブ化
      originalNoteIds.forEach((id) => {
        const req = notesStore.get(id);
        req.onsuccess = () => {
          const note = req.result;
          if (note) {
            note.status = "archived";
            note.updated_at = new Date().toISOString();
            notesStore.put(note);
            queueStore.add({
              action: "archive",
              note_id: note.id,
              title: note.title,
              timestamp: new Date().toISOString(),
              status: "pending"
            });
          }
        };
      });

      tx.oncomplete = () => resolve(newNote);
      tx.onerror = (e) => reject(e.target.error);
    });
  }
}

