/**
 * Petasos v2 - Main Application Orchestrator
 * ピュア Vanilla ES Modules（No-Build）による司令塔
 */

import { SAMPLE_NOTES } from "./constants.js";
import { DeckState } from "./state.js";
import { PetasosStorage } from "./storage.js";
import { GitHubClient } from "./github.js";

// 機能別サブモジュール
import { DeckController } from "./modules/deck-controller.js";
import { NoteModal } from "./modules/note-modal.js";
import { SelectionManager } from "./modules/selection.js";
import { GridView } from "./modules/grid-view.js";
import { SettingsView } from "./modules/settings-view.js";
import { SyncManager } from "./modules/sync-manager.js";
import { PwaManager } from "./modules/pwa-manager.js";

class PhysicalCardDeckApp {
  constructor() {
    this.storage = new PetasosStorage();
    this.github = new GitHubClient();
    this.state = new DeckState(SAMPLE_NOTES);

    // 共通UI要素（ステージ・新規作成・トースト）
    this.stage = document.getElementById("card-stage");
    this.btnNewNote = document.getElementById("btn-new-note");
    this.commitToast = document.getElementById("commit-toast");
    this.toastIcon = document.getElementById("toast-icon");
    this.toastMessageText = document.getElementById("toast-message-text");
    this.btnToastUndo = document.getElementById("btn-toast-undo");
    this.toastTimer = null;
    this.undoCallback = null;

    // 各機能サブモジュールの初期化
    this.deck = new DeckController(this);
    this.modal = new NoteModal(this);
    this.selection = new SelectionManager(this);
    this.grid = new GridView(this);
    this.settings = new SettingsView(this);
    this.sync = new SyncManager(this);
    this.pwa = new PwaManager(this);

    this.init();
  }

  async init() {
    // 1. IndexedDB初期化 ＆ 初回データ読み込み（最優先）
    try {
      await this.storage.init();
      const notes = await this.storage.seedInitialDataIfEmpty(SAMPLE_NOTES);
      this.state = new DeckState(notes);
    } catch (err) {
      console.warn("Storage init failed, falling back to in-memory:", err);
      this.state = new DeckState(SAMPLE_NOTES);
    }

    // 2. 各サブモジュールの初期化（DB準備完了後）
    this.deck.init();
    this.modal.init();
    this.selection.init();
    this.grid.init();
    this.settings.init();
    this.sync.init();
    this.pwa.init();

    // 3. グローバルイベント（ショートカット等）登録
    this.bindEvents();

    // 4. 初回描画
    this.renderCards();
    this.updateStatus();
    await this.updateSyncIndicator();

    // 5. バックグラウンド自動同期
    const token = localStorage.getItem("petasos_github_token");
    const repo = localStorage.getItem("petasos_github_repo");
    if (token && repo) {
      this.syncAll({ isManual: false });
    }
  }

  bindEvents() {
    // ＋ 新規メモ作成ボタン
    if (this.btnNewNote) {
      this.btnNewNote.addEventListener("click", () => this.openEditor("create"));
    }

    // トースト Undo
    if (this.btnToastUndo) {
      this.btnToastUndo.addEventListener("click", () => this.triggerUndo());
    }

    // 🐞 デバッグ：スクロール原点リセット＆画面診断
    const btnDebugScroll = document.getElementById("btn-debug-scroll");
    if (btnDebugScroll) {
      btnDebugScroll.addEventListener("click", () => {
        const bY = window.scrollY;
        const bDoc = document.documentElement ? document.documentElement.scrollTop : 0;
        const bBody = document.body ? document.body.scrollTop : 0;
        const vH = window.visualViewport ? window.visualViewport.height : "N/A";
        const vTop = window.visualViewport ? window.visualViewport.offsetTop : "N/A";
        const inH = window.innerHeight;
        const clH = document.documentElement ? document.documentElement.clientHeight : 0;
        const scH = window.screen ? window.screen.height : "N/A";

        // スクロール原点リセットを実行
        window.scrollTo(0, 0);
        if (document.documentElement) document.documentElement.scrollTop = 0;
        if (document.body) document.body.scrollTop = 0;

        const aY = window.scrollY;
        const aDoc = document.documentElement ? document.documentElement.scrollTop : 0;

        const report = `【デバッグ診断結果】\n` +
          `■ スクロール(Y):\n` +
          `  実行前: window=${bY}, doc=${bDoc}, body=${bBody}\n` +
          `  実行後: window=${aY}, doc=${aDoc}\n` +
          `■ ビューポート高さ:\n` +
          `  innerHeight: ${inH}px\n` +
          `  visualViewport: ${vH}px (top: ${vTop})\n` +
          `  doc.clientHeight: ${clH}px\n` +
          `  screen.height: ${scH}px\n\n` +
          `※ OKを押した後、画面下端のズレが直るかご確認ください。`;

        console.log(report);
        alert(report);
      });
    }

    // グローバルキーボードショートカット
    window.addEventListener("keydown", (e) => {
      if (this.deck.isWarping) return;

      if (e.key === "Escape") {
        if (this.selection.groupModal && this.selection.groupModal.classList.contains("is-active")) {
          this.selection.closeGroupModal();
        } else if (this.state.isGridView) {
          this.closeGridSheet();
        } else if (this.state.isSelectMode) {
          this.exitSelectMode();
        } else if (this.settings.settingsModal && this.settings.settingsModal.classList.contains("is-active")) {
          this.closeSettings();
        } else if (this.modal.noteModal && this.modal.noteModal.classList.contains("is-active")) {
          this.closeModal();
        }
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        this.triggerCardSwitch("down");
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        this.triggerCardSwitch("up");
      } else if (e.key === "ArrowRight" && this.deck.rightCard) {
        e.preventDefault();
        this.triggerCardSwitch("right");
      } else if (e.key === "ArrowLeft" && this.deck.leftCard) {
        e.preventDefault();
        this.triggerCardSwitch("left");
      }
    });
  }

  // ---------------------------------------------------------------------------
  // トースト表示（Undo機能付き）
  // ---------------------------------------------------------------------------
  showToast(message, onUndo = null) {
    if (!this.commitToast) return;
    if (this.toastMessageText) {
      this.toastMessageText.textContent = message;
    } else {
      const msgEl = this.commitToast.querySelector(".toast-message");
      if (msgEl) msgEl.textContent = message;
    }

    this.undoCallback = onUndo;
    if (this.btnToastUndo) {
      this.btnToastUndo.style.display = onUndo ? "inline-block" : "none";
    }

    this.commitToast.classList.add("is-active");

    if (this.toastTimer) clearTimeout(this.toastTimer);
    const duration = onUndo ? 7500 : 2400;
    this.toastTimer = setTimeout(() => {
      this.commitToast.classList.remove("is-active");
      this.toastTimer = null;
      this.undoCallback = null;
      if (this.btnToastUndo) this.btnToastUndo.style.display = "none";
    }, duration);
  }

  triggerUndo() {
    if (this.undoCallback) {
      const cb = this.undoCallback;
      this.undoCallback = null;
      if (this.btnToastUndo) this.btnToastUndo.style.display = "none";
      cb();
    }
  }

  // ---------------------------------------------------------------------------
  // サブモジュールへの委譲（Delegate）メソッド群
  // ---------------------------------------------------------------------------
  // 🃏 デッキ制御
  renderCards() { return this.deck.renderCards(); }
  updateStatus() { return this.deck.updateStatus(); }
  triggerCardSwitch(dir) { return this.deck.triggerCardSwitch(dir); }
  triggerRocketWarp() { return this.deck.triggerRocketWarp(); }

  // 📖 ノート詳細モーダル
  openReader() { return this.modal.openReader(); }
  openEditor(mode, initialValues) { return this.modal.openEditor(mode, initialValues); }
  closeModal() { return this.modal.closeModal(); }
  toggleTodoItem(lineIndex) { return this.modal.toggleTodoItem(lineIndex); }

  // 📑 複数選択モード
  enterSelectMode(noteId) { return this.selection.enterSelectMode(noteId); }
  exitSelectMode() { return this.selection.exitSelectMode(); }
  toggleNoteSelection(noteId) { return this.selection.toggleNoteSelection(noteId); }
  updateCardSelectionVisuals() { return this.selection.updateCardSelectionVisuals(); }

  // ⊞ グリッドビュー
  openGridSheet() { return this.grid.openGridSheet(); }
  closeGridSheet() { return this.grid.closeGridSheet(); }
  toggleGridView() { return this.grid.toggleGridView(); }
  renderGridTiles() { return this.grid.renderGridTiles(); }

  // ⚙️ 設定
  openSettings(tab) { return this.settings.openSettings(tab); }
  closeSettings() { return this.settings.closeSettings(); }

  // ☁️ GitHub同期
  syncAll(options) { return this.sync.syncAll(options); }
  syncPushQueue(options) { return this.sync.syncPushQueue(options); }
  syncPullNotes(options) { return this.sync.syncPullNotes(options); }
  updateSyncIndicator(state) { return this.sync.updateSyncIndicator(state); }

  // 📱 PWA
  installPwa() { return this.pwa.installPwa(); }
}

// アプリケーション起動
window.addEventListener("DOMContentLoaded", () => {
  window.app = new PhysicalCardDeckApp();
});
