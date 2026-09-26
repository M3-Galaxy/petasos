/**
 * Petasos v2 - デッキ状態管理モデル（DeckState）
 * 十字移動（上下の時間軸、左右の関連リンク）およびワープジャンプのロジックをカプセル化
 */

import { normalizeCategory } from "./utils.js";

export class DeckState {
  constructor(notes = []) {
    this.notes = notes;
    const hasInboxNotes = notes.some(n => normalizeCategory(n.category) === "" && n.status !== "archived");
    this.activeDeck = hasInboxNotes ? "inbox" : "all";
    this.currentIndex = 0; // 0 = 最新
    this.activeHorizontalIndex = 0; // 横スワイプ（関連リンク）のインデックス

    // 複数選択モードの状態管理
    this.isSelectMode = false;
    this.selectedNoteIds = new Set();
    this.isGridView = false; // グリッド一覧シートの開閉
  }

  // 現在のアクティブデッキに応じたメモ一覧を取得
  getFilteredNotes() {
    return this.notes.filter(note => {
      if (note.status === "archived") return false;
      const cat = normalizeCategory(note.category);
      if (this.activeDeck === "inbox") {
        return cat === "";
      }
      if (this.activeDeck === "all") {
        return true;
      }
      return cat === this.activeDeck;
    });
  }

  // デッキの切り替え
  setDeck(deckName) {
    this.activeDeck = deckName;
    this.currentIndex = 0;
    this.activeHorizontalIndex = 0;
  }

  // 各デッキの件数を集計（ピッカー表示用）
  getDeckCategoriesWithCounts() {
    const activeNotes = this.notes.filter(n => n.status !== "archived");
    let inboxCount = 0;
    const catMap = new Map();

    activeNotes.forEach(note => {
      const cat = normalizeCategory(note.category);
      if (!cat) {
        inboxCount++;
      } else {
        catMap.set(cat, (catMap.get(cat) || 0) + 1);
      }
    });

    const categories = Array.from(catMap.entries()).map(([name, count]) => ({
      name,
      count
    }));

    return {
      inbox: inboxCount,
      all: activeNotes.length,
      categories
    };
  }

  getCurrentNote() {
    const filtered = this.getFilteredNotes();
    return filtered[this.currentIndex] || null;
  }

  getTopNote() {
    const filtered = this.getFilteredNotes();
    // 上：より新しいメモ（currentIndex - 1）
    return this.currentIndex > 0 ? filtered[this.currentIndex - 1] : null;
  }

  getBottomNote() {
    const filtered = this.getFilteredNotes();
    // 下：より古いメモ（currentIndex + 1）
    return this.currentIndex < filtered.length - 1 ? filtered[this.currentIndex + 1] : null;
  }

  getLinkedNotes() {
    const current = this.getCurrentNote();
    if (!current || !current.links || current.links.length === 0) return [];
    // 関連リンクはデッキの垣根を越えて（全ノートから）探せる
    return current.links
      .map(id => this.notes.find(n => n.id === id && n.status !== "archived"))
      .filter(Boolean);
  }

  // 上下移動（時間の地層を行き来）
  moveUp() {
    if (this.currentIndex > 0) {
      this.currentIndex--;
      this.activeHorizontalIndex = 0;
      return true;
    }
    return false;
  }

  moveDown() {
    const filtered = this.getFilteredNotes();
    if (this.currentIndex < filtered.length - 1) {
      this.currentIndex++;
      this.activeHorizontalIndex = 0;
      return true;
    }
    return false;
  }

  // 任意の位置へジャンプ（ロケットランダムワープ等）
  jumpTo(index) {
    const filtered = this.getFilteredNotes();
    if (index >= 0 && index < filtered.length) {
      this.currentIndex = index;
      this.activeHorizontalIndex = 0;
      return true;
    }
    return false;
  }

  // ノートIDを指定して直接ジャンプ（リンク先が別カテゴリ・デッキでも自動追従）
  jumpToNote(noteId) {
    const targetNote = this.notes.find(n => n.id === noteId && n.status !== "archived");
    if (!targetNote) return false;

    // 1. 現在のアクティブデッキに対象ノートが含まれているか確認
    let filtered = this.getFilteredNotes();
    let idx = filtered.findIndex(n => n.id === noteId);

    // 2. 含まれていなければ、リンク先を表示するために「すべて」デッキに切り替える
    if (idx === -1) {
      this.activeDeck = "all";
      filtered = this.getFilteredNotes();
      idx = filtered.findIndex(n => n.id === noteId);
    }

    if (idx !== -1) {
      this.currentIndex = idx;
      this.activeHorizontalIndex = 0;
      return true;
    }
    return false;
  }

  // ---------------------------------------------------------------------------
  // 複数選択モード用ステート操作
  // ---------------------------------------------------------------------------
  enterSelectMode(initialNoteId = null) {
    this.isSelectMode = true;
    if (initialNoteId) {
      this.selectedNoteIds.add(initialNoteId);
    }
  }

  exitSelectMode() {
    this.isSelectMode = false;
    this.selectedNoteIds.clear();
    this.isGridView = false;
  }

  toggleSelection(noteId) {
    if (this.selectedNoteIds.has(noteId)) {
      this.selectedNoteIds.delete(noteId);
    } else {
      this.selectedNoteIds.add(noteId);
    }
  }

  isSelected(noteId) {
    return this.selectedNoteIds.has(noteId);
  }

  selectAll() {
    const filtered = this.getFilteredNotes();
    filtered.forEach(note => {
      this.selectedNoteIds.add(note.id);
    });
  }

  clearSelection() {
    this.selectedNoteIds.clear();
  }

  getSelectedCount() {
    return this.selectedNoteIds.size;
  }

  getSelectedNotes() {
    return this.notes.filter(n => this.selectedNoteIds.has(n.id));
  }
}

