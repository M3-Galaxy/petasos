/**
 * Petasos v2 - Physical Card Deck Engine
 * 身体性を伴うカードデッキ閲覧 ＆ ロケットランダムワープ プロトタイプ
 */

import { SAMPLE_NOTES } from "./constants.js";
import { DeckState } from "./state.js";
import { ICONS } from "./icons.js";
import { formatCurrentDate, escapeHtml, generateNoteId } from "./utils.js";
import { PetasosStorage } from "./storage.js";
import { GitHubClient } from "./github.js";

// =============================================================================
// UIレンダラー & ジェスチャー制御
// =============================================================================
class PhysicalCardDeckApp {
  constructor() {
    this.storage = new PetasosStorage();
    this.github = new GitHubClient();
    this.state = new DeckState(SAMPLE_NOTES); // 初期フォールバック
    
    // DOM参照
    this.stage = document.getElementById("card-stage");
    this.viewport = document.getElementById("deck-viewport");
    this.deckStatus = document.getElementById("deck-status");
    this.deckNameBadge = document.getElementById("deck-name-badge");
    this.deckPickerPopover = document.getElementById("deck-picker-popover");
    this.deckPickerList = document.getElementById("deck-picker-list");
    this.indexBadge = document.getElementById("current-index-badge");
    this.timeBadge = document.getElementById("time-distance-badge");
    this.btnReturnLatest = document.getElementById("btn-return-latest");
    this.btnRocket = document.getElementById("btn-rocket-warp");
    this.gestureHint = document.getElementById("gesture-hint");
    this.warpOverlay = document.getElementById("warp-overlay");

    // 🏷️ 整理（複数選択モード）ナビDOM
    this.normalHeaderPill = document.getElementById("normal-header-pill");
    this.selectHeaderPill = document.getElementById("select-header-pill");
    this.btnStartSelect = document.getElementById("btn-start-select");
    this.btnCancelSelect = document.getElementById("btn-cancel-select");
    this.selectCountNum = document.getElementById("select-count-num");
    this.btnSelectAllToggle = document.getElementById("btn-select-all-toggle");
    this.selectAllLabel = document.getElementById("select-all-label");

    // 🛠️ 選択モード用フローティング・アクションバーDOM
    this.selectActionBar = document.getElementById("select-action-bar");
    this.btnActionLink = document.getElementById("btn-action-link");
    this.btnActionGroup = document.getElementById("btn-action-group");
    this.btnActionJoin = document.getElementById("btn-action-join");
    this.btnActionExport = document.getElementById("btn-action-export");
    this.btnActionArchive = document.getElementById("btn-action-archive");
    this.btnToggleGrid = document.getElementById("btn-toggle-grid");
    this.gridToggleText = document.getElementById("grid-toggle-text");

    // ⊞ グリッド一覧シートDOM
    this.gridViewSheet = document.getElementById("grid-view-sheet");
    this.btnCloseGridSheet = document.getElementById("btn-close-grid-sheet");
    this.gridTilesStage = document.getElementById("grid-tiles-stage");
    this.gridSelectedCountBadge = document.getElementById("grid-selected-count-badge");

    // 🏷️ グループ化モーダルDOM
    this.groupModal = document.getElementById("group-modal");
    this.btnCloseGroupModal = document.getElementById("btn-close-group-modal");
    this.btnCancelGroup = document.getElementById("btn-cancel-group");
    this.btnApplyGroup = document.getElementById("btn-apply-group");
    this.inputGroupCategory = document.getElementById("input-group-category");
    this.groupTargetCount = document.getElementById("group-target-count");
    this.existingCategoryChips = document.getElementById("existing-category-chips");

    // ⚙️ 設定モーダルDOM
    this.btnSettingsOpen = document.getElementById("btn-settings-open");
    this.settingsModal = document.getElementById("settings-modal");
    this.btnCloseSettings = document.getElementById("btn-close-settings");
    this.themeOptTwilight = document.getElementById("theme-opt-twilight");
    this.themeOptDaylight = document.getElementById("theme-opt-daylight");
    this.settingsNotesCount = document.getElementById("settings-notes-count");
    this.settingsQueueCount = document.getElementById("settings-queue-count");
    this.btnExportJson = document.getElementById("btn-export-json");
    this.btnClearQueue = document.getElementById("btn-clear-queue");
    this.inputGithubToken = document.getElementById("input-github-token");
    this.inputGithubRepo = document.getElementById("input-github-repo");
    this.btnSaveGithubConfig = document.getElementById("btn-save-github-config");
    this.btnTestGithub = document.getElementById("btn-test-github");
    this.btnTestGithubText = document.getElementById("btn-test-github-text");
    this.btnSyncPullNow = document.getElementById("btn-sync-pull-now");
    this.githubTestResult = document.getElementById("github-test-result");

    this.btnNewNote = document.getElementById("btn-new-note");
    this.btnInstallPwa = document.getElementById("btn-install-pwa");
    this.deferredInstallPrompt = null;

    // ☁️ 同期インジケーター（アイコン化ボタン）
    this.syncIndicator = document.getElementById("sync-indicator");
    this.syncIconWrap = document.getElementById("sync-icon-wrap");
    this.syncBadgeCount = document.getElementById("sync-badge-count");

    // 📖 ノート詳細モーダル（閲覧 ⟷ 編集）
    this.noteModal = document.getElementById("note-modal");
    this.headerViewActions = document.getElementById("header-view-actions");
    this.headerEditActions = document.getElementById("header-edit-actions");
    this.viewPanel = document.getElementById("view-panel");
    this.editPanel = document.getElementById("edit-panel");
    this.modalEditBadge = document.getElementById("modal-edit-badge");

    // 閲覧パネルDOM
    this.viewTitle = document.getElementById("view-title");
    this.viewCategoryBadge = document.getElementById("view-category-badge");
    this.viewDateDisplay = document.getElementById("view-date-display");
    this.viewContent = document.getElementById("view-content");
    this.viewLinksSection = document.getElementById("view-links-section");
    this.viewLinksChips = document.getElementById("view-links-chips");
    this.btnCloseModal = document.getElementById("btn-close-modal");
    this.btnSwitchToEdit = document.getElementById("btn-switch-to-edit");

    // 編集パネルDOM
    this.btnCancelEdit = document.getElementById("btn-cancel-edit");
    this.btnCommitEdit = document.getElementById("btn-commit-edit");
    this.editTitle = document.getElementById("edit-title");
    this.editCategory = document.getElementById("edit-category");
    this.editContent = document.getElementById("edit-content");
    this.editDateDisplay = document.getElementById("edit-date-display");
    this.editLinksSection = document.getElementById("edit-links-section");
    this.editLinksChips = document.getElementById("edit-links-chips");

    // トースト ＆ Undo
    this.commitToast = document.getElementById("commit-toast");
    this.toastIcon = document.getElementById("toast-icon");
    this.toastMessageText = document.getElementById("toast-message-text");
    this.btnToastUndo = document.getElementById("btn-toast-undo");
    this.toastTimer = null;
    this.undoCallback = null;
    this.lastArchivedNoteIds = [];

    // 編集ステート
    this.editorMode = "edit"; // 'edit' | 'create'

    // ジェスチャー状態
    this.isDragging = false;
    this.startX = 0;
    this.startY = 0;
    this.currentDeltaX = 0;
    this.currentDeltaY = 0;
    this.dragAxis = null; // 'vertical' | 'horizontal'
    this.isWarping = false;

    // 長押し（ロングプレス）状態
    this.longPressTimer = null;
    this.longPressFired = false;
    this.longPressCard = null;

    // 同期エンジン状態
    this.isSyncing = false;

    this.init();
  }


  async init() {
    this.initTheme();

    // 1. IndexedDBの初期化 ＆ 初回シード投入
    try {
      await this.storage.init();
      const notes = await this.storage.seedInitialDataIfEmpty(SAMPLE_NOTES);
      this.state = new DeckState(notes);
    } catch (err) {
      console.warn("Storage init failed, falling back to in-memory:", err);
      this.state = new DeckState(SAMPLE_NOTES);
    }

    this.renderCards();
    this.bindEvents();
    this.updateStatus();
    await this.updateSyncIndicator();
    this.registerServiceWorker();

    // 起動時にトークンとリポジトリがあれば完全双方向同期（プッシュ先行＆プル差分）
    const token = localStorage.getItem("petasos_github_token");
    const repo = localStorage.getItem("petasos_github_repo");
    if (token && repo) {
      this.syncAll({ isManual: false });
    }
  }

  // ---------------------------------------------------------------------------
  // ☁️ 同期キュー・インジケーター更新（Lucide CircleCheck / CircleDashedCheck / Loader2 / Alert）
  // ---------------------------------------------------------------------------
  async updateSyncIndicator(overrideState = null) {
    if (!this.syncIndicator || !this.syncIconWrap) return;

    if (overrideState === "syncing" || this.isSyncing) {
      this.syncIndicator.classList.remove("is-synced", "has-pending", "has-error");
      this.syncIndicator.classList.add("is-syncing");
      this.syncIndicator.title = "GitHubへ同期中...";
      this.syncIconWrap.innerHTML = ICONS.loader2;
      return;
    }

    if (overrideState === "error") {
      this.syncIndicator.classList.remove("is-synced", "has-pending", "is-syncing");
      this.syncIndicator.classList.add("has-error");
      this.syncIndicator.title = "同期エラーが発生しました（タップで確認）";
      this.syncIconWrap.innerHTML = ICONS.circleAlert;
      return;
    }

    try {
      const count = await this.storage.getPendingQueueCount();
      this.syncIndicator.classList.remove("is-syncing", "has-error");

      if (count > 0) {
        // 未同期あり: CircleDashedCheck (テーマカラーのシアンで光る)
        this.syncIndicator.classList.add("has-pending");
        this.syncIndicator.classList.remove("is-synced");
        this.syncIndicator.title = `同期待ちの変更が ${count} 件あります（タップでGitHubへ送信）`;

        this.syncIconWrap.innerHTML = ICONS.circleDashedCheck;

        if (this.syncBadgeCount) {
          this.syncBadgeCount.textContent = count > 99 ? "99+" : count;
          this.syncBadgeCount.style.display = "flex";
        }
      } else {
        // 同期完了: CircleCheck (墨色・静かな佇まい)
        this.syncIndicator.classList.add("is-synced");
        this.syncIndicator.classList.remove("has-pending");
        this.syncIndicator.title = "GitHub同期済み / ローカル保存済み（タップで再同期）";

        this.syncIconWrap.innerHTML = ICONS.circleCheck;

        if (this.syncBadgeCount) {
          this.syncBadgeCount.style.display = "none";
        }
      }
    } catch (e) {
      console.warn("Failed to update sync indicator:", e);
    }
  }

  // ---------------------------------------------------------------------------
  // ☁️ GitHub プッシュ同期エンジン（ステップ2）
  // 1メモ＝1ファイル (notes/{note.id}.json) でPrivateリポジトリへコミット
  // ---------------------------------------------------------------------------
  async syncPushQueue(options = { isManual: false, isSilent: false }) {
    if (this.isSyncing && !options.allowReentrant) {
      console.log("Push sync already running, skipping.");
      return { success: false, successCount: 0 };
    }

    const token = localStorage.getItem("petasos_github_token") || "";
    const repo = localStorage.getItem("petasos_github_repo") || "";

    if (!token || !repo) {
      if (options.isManual && !options.isSilent) {
        this.showToast("⚙️ GitHub連携が未設定です。設定画面からトークンとリポジトリを設定してください。");
        this.openSettings("github");
      }
      await this.updateSyncIndicator();
      return { success: false, successCount: 0 };
    }

    let pendingItems = [];
    try {
      pendingItems = await this.storage.getPendingQueueItems();
    } catch (err) {
      console.error("Failed to get pending queue items:", err);
      return { success: false, successCount: 0 };
    }

    if (pendingItems.length === 0) {
      if (options.isManual && !options.isSilent) {
        this.showToast("✨ すべての思考はGitHubに同期済みです");
      }
      await this.updateSyncIndicator();
      return { success: true, successCount: 0 };
    }

    const wasAlreadySyncing = this.isSyncing;
    this.isSyncing = true;
    await this.updateSyncIndicator("syncing");

    let successCount = 0;
    let failCount = 0;
    let lastErrorMessage = "";

    try {
      for (const item of pendingItems) {
        try {
          const note = await this.storage.getNote(item.note_id);
          if (!note) {
            // メモが存在しない場合はキューアイテムを消去
            await this.storage.deleteQueueItem(item.queue_id);
            continue;
          }

          // GitHub API経由で notes/{id}.json をコミット
          const result = await this.github.pushNote(token, repo, note);
          if (result.success) {
            await this.storage.deleteQueueItem(item.queue_id);
            successCount++;
          } else {
            console.error(`Failed to push note ${item.note_id}:`, result.message);
            failCount++;
            lastErrorMessage = result.message;
            // 認証エラーや権限エラーの場合はループを中断
            if (result.status === 401 || result.status === 403 || result.status === 404) {
              break;
            }
          }
        } catch (itemErr) {
          console.error(`Error processing queue item ${item.queue_id}:`, itemErr);
          failCount++;
          lastErrorMessage = itemErr.message;
        }
      }
    } finally {
      if (!wasAlreadySyncing) {
        this.isSyncing = false;
      }
      await this.updateSyncIndicator(failCount > 0 && successCount === 0 ? "error" : null);

      // 設定モーダル内のキュー件数バッジも更新
      if (this.settingsQueueCount) {
        const qCount = await this.storage.getPendingQueueCount();
        this.settingsQueueCount.textContent = `${qCount} 件`;
      }

      if (!options.isSilent) {
        if (successCount > 0 && failCount === 0) {
          if (options.isManual) {
            this.showToast(`☁️ GitHubへの同期が完了しました (${successCount} 件)`);
          }
        } else if (failCount > 0) {
          this.showToast(`⚠️ 一部の同期に失敗しました (${failCount} 件): ${lastErrorMessage || "通信エラー"}`);
        }
      }
    }

    return { success: failCount === 0, successCount, failCount };
  }

  // ---------------------------------------------------------------------------
  // 📥 GitHub プル同期エンジン（ステップ3）
  // GitHubリポジトリの notes/*.json から最新の思考差分を取得してIndexedDBに反映
  // ---------------------------------------------------------------------------
  async syncPullNotes(options = { isManual: false }) {
    const token = localStorage.getItem("petasos_github_token") || "";
    const repo = localStorage.getItem("petasos_github_repo") || "";

    if (!token || !repo) return { success: false, pullCount: 0 };

    // 1. リポジトリ内の notes/*.json 一覧を取得
    const listRes = await this.github.listNotes(token, repo);
    if (!listRes.success) {
      console.warn("Pull sync: failed to list notes from GitHub:", listRes.message);
      return { success: false, pullCount: 0, error: listRes.message };
    }

    const remoteFiles = listRes.files || [];
    if (remoteFiles.length === 0) {
      return { success: true, pullCount: 0 };
    }

    // 2. ローカルに記録されているファイルSHAハッシュ一覧を取得
    let localShas = {};
    try {
      localShas = JSON.parse(localStorage.getItem("petasos_file_shas") || "{}");
    } catch (_) {
      localShas = {};
    }

    // 3. 差分判定：SHAが変わっているファイルまたは未取得のファイルを抽出
    const filesToFetch = remoteFiles.filter((file) => {
      return localShas[file.name] !== file.sha;
    });

    if (filesToFetch.length === 0) {
      // 差分なし（手元が最新）
      return { success: true, pullCount: 0 };
    }

    console.log(`[Pull Sync] ${filesToFetch.length} files changed on remote, downloading...`);

    let pullCount = 0;
    for (const file of filesToFetch) {
      try {
        const fetchRes = await this.github.fetchNoteFile(token, repo, file.path);
        if (!fetchRes.success || !fetchRes.note) {
          console.warn(`Failed to fetch remote note file ${file.path}:`, fetchRes.message);
          continue;
        }

        const remoteNote = fetchRes.note;

        // 4. LWW (Last-Write-Wins): 手元のメモと比較
        const localNote = await this.storage.getNote(remoteNote.id);
        if (localNote) {
          const localTime = Date.parse(localNote.updated_at || localNote.created_at || localNote.date) || 0;
          const remoteTime = Date.parse(remoteNote.updated_at || remoteNote.created_at || remoteNote.date) || 0;

          // ローカルの方が更新日時が新しい場合はスキップ（手元の最新思考を保護）
          if (localTime > remoteTime) {
            localShas[file.name] = file.sha;
            continue;
          }
        }

        // 5. IndexedDBを更新（※キュー追加なし）
        await this.storage.upsertNoteFromRemote(remoteNote);
        localShas[file.name] = file.sha;
        pullCount++;
      } catch (err) {
        console.error(`Error pulling file ${file.path}:`, err);
      }
    }

    // SHAマッピングを保存
    localStorage.setItem("petasos_file_shas", JSON.stringify(localShas));

    // 6. デッキと画面の再描画
    if (pullCount > 0) {
      const freshNotes = await this.storage.getAllNotes(false);
      const currentNote = this.state.getCurrentNote();
      const currentNoteId = currentNote ? currentNote.id : null;

      this.state.notes = freshNotes;

      // 見ていたメモの位置を維持（または先頭）
      if (currentNoteId) {
        const newIdx = this.state.notes.findIndex((n) => n.id === currentNoteId);
        this.state.currentIndex = newIdx !== -1 ? newIdx : 0;
      } else {
        this.state.currentIndex = 0;
      }

      this.renderCards();
      this.updateStatus();
    }

    return { success: true, pullCount };
  }

  // ---------------------------------------------------------------------------
  // 🔄 完全双方向同期（プッシュ先行 ➔ プル差分取得 を連続実行）
  // ---------------------------------------------------------------------------
  async syncAll(options = { isManual: false }) {
    if (this.isSyncing) return;

    const token = localStorage.getItem("petasos_github_token") || "";
    const repo = localStorage.getItem("petasos_github_repo") || "";

    if (!token || !repo) {
      if (options.isManual) {
        this.showToast("⚙️ GitHub連携が未設定です。設定画面からトークンとリポジトリを設定してください。");
        this.openSettings("github");
      }
      return;
    }

    this.isSyncing = true;
    await this.updateSyncIndicator("syncing");

    try {
      // 1. 未送信変更のプッシュ先行（安全第一）
      await this.syncPushQueue({ isManual: false, isSilent: true, allowReentrant: true });

      // 2. リモート変更のプル
      const pullResult = await this.syncPullNotes({ isManual: options.isManual });

      if (options.isManual) {
        if (pullResult.pullCount > 0) {
          this.showToast(`☁️ GitHubから最新の思考を ${pullResult.pullCount} 件取り込みました`);
        } else {
          this.showToast("✨ すべての思考は最新状態に保たれています");
        }
      }
    } catch (err) {
      console.error("Full sync error:", err);
      if (options.isManual) {
        this.showToast(`⚠️ 同期中にエラーが発生しました: ${err.message}`);
      }
    } finally {
      this.isSyncing = false;
      await this.updateSyncIndicator();
    }
  }

  // ---------------------------------------------------------------------------
  // テーマ & 外観管理（設定モーダル内から切り替え可能）
  // ---------------------------------------------------------------------------
  initTheme() {
    const savedTheme = localStorage.getItem("petasos_theme") || "twilight";
    this.setTheme(savedTheme);

    // すべての外観テーマ選択カードにイベントを紐付け
    const themeCards = document.querySelectorAll(".theme-option-card[data-theme]");
    themeCards.forEach((card) => {
      card.addEventListener("click", () => {
        const theme = card.getAttribute("data-theme");
        if (theme) {
          this.setTheme(theme);
        }
      });
    });

    // 星屑テクスチャのトグル初期化
    this.initStarsToggle();

    // 設定モーダルのタブ切り替え初期化
    this.initSettingsTabs();
  }

  initSettingsTabs() {
    const tabButtons = document.querySelectorAll(".settings-tab-btn");
    const tabPanes = document.querySelectorAll(".settings-tab-pane");

    tabButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        const targetTab = btn.getAttribute("data-tab");
        if (targetTab) {
          this.setSettingsTab(targetTab);
        }
      });
    });
  }

  setSettingsTab(tabName) {
    const tabButtons = document.querySelectorAll(".settings-tab-btn");
    const tabPanes = document.querySelectorAll(".settings-tab-pane");

    tabButtons.forEach((b) => {
      if (b.getAttribute("data-tab") === tabName) {
        b.classList.add("is-active");
      } else {
        b.classList.remove("is-active");
      }
    });

    tabPanes.forEach((p) => {
      if (p.id === `tab-pane-${tabName}`) {
        p.classList.add("is-active");
      } else {
        p.classList.remove("is-active");
      }
    });
  }

  setTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("petasos_theme", theme);

    // 設定モーダル内のアクティブ選択状態を更新
    const themeCards = document.querySelectorAll(".theme-option-card[data-theme]");
    themeCards.forEach((card) => {
      if (card.getAttribute("data-theme") === theme) {
        card.classList.add("is-active");
      } else {
        card.classList.remove("is-active");
      }
    });
  }

  initStarsToggle() {
    const toggleStars = document.getElementById("toggle-stars");
    const savedStars = localStorage.getItem("petasos_stars") !== "off"; // デフォルトはON

    document.documentElement.setAttribute("data-stars", savedStars ? "on" : "off");
    if (toggleStars) {
      toggleStars.checked = savedStars;
      toggleStars.addEventListener("change", (e) => {
        const enabled = e.target.checked;
        document.documentElement.setAttribute("data-stars", enabled ? "on" : "off");
        localStorage.setItem("petasos_stars", enabled ? "on" : "off");
      });
    }
  }

  // ---------------------------------------------------------------------------
  // カードのHTML生成
  // ---------------------------------------------------------------------------
  createCardElement(note, positionClass) {
    const card = document.createElement("div");
    const isSelected = this.state.isSelected(note.id);
    card.className = `note-card ${positionClass}${isSelected ? " is-selected" : ""}`;
    card.dataset.id = note.id;

    // 本文のチェックボックス記法の簡易パース
    let parsedContent = note.content;
    const lines = note.content.split("\n");
    const hasTodos = lines.some(l => l.trim().startsWith("- [ ]") || l.trim().startsWith("- [x]"));

    let bodyHTML = "";
    if (hasTodos) {
      bodyHTML = lines.map(line => {
        const trimmed = line.trim();
        if (trimmed.startsWith("- [ ]")) {
          return `<div class="todo-item"><span class="todo-check"></span><span>${escapeHtml(trimmed.slice(5).trim())}</span></div>`;
        } else if (trimmed.startsWith("- [x]")) {
          return `<div class="todo-item"><span class="todo-check checked"></span><span>${escapeHtml(trimmed.slice(5).trim())}</span></div>`;
        }
        return `<div>${escapeHtml(line)}</div>`;
      }).join("");
    } else {
      bodyHTML = escapeHtml(note.content);
    }

    const linkedNotes = note.links ? note.links.length : 0;
    const linkIndicatorHTML = linkedNotes > 0 
      ? `<div class="link-indicator"><span style="font-size: 13px;">🔗</span> 結ばれている星 (${linkedNotes})</div>`
      : `<div></div>`;

    let hintText = "";
    if (positionClass === "card-center") {
      hintText = this.state.isSelectMode ? (isSelected ? "✓ 選択中" : "タップで選択") : "タップで閲覧";
    }

    card.innerHTML = `
      <!-- 選択モード用チェックアイコン -->
      <div class="card-select-checkbox" title="${isSelected ? '選択を解除' : '選択する'}">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"
          stroke-linecap="round" stroke-linejoin="round">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
      </div>

      <div class="card-meta-top">
        <span class="card-tag">
          <span class="tag-dot"></span>
          ${note.category ? `#${escapeHtml(note.category)}` : "Inbox"}
        </span>
        <span class="card-date">${note.date}</span>
      </div>
      <h2 class="card-title">${escapeHtml(note.title)}</h2>
      <div class="card-body">
        ${bodyHTML}
      </div>
      <div class="card-footer">
        ${linkIndicatorHTML}
        <span class="tap-hint">${hintText}</span>
      </div>
    `;

    return card;
  }

  // ---------------------------------------------------------------------------
  // 画面の3〜5枚のDOMを配置（スライディングウィンドウ）
  // ---------------------------------------------------------------------------
  renderCards() {
    this.stage.innerHTML = "";

    const filtered = this.state.getFilteredNotes();

    // メモが0件の場合の空状態カード表示
    if (filtered.length === 0) {
      const emptyCard = document.createElement("div");
      emptyCard.className = "note-card card-center is-empty-state";

      let icon = "🌌";
      let title = "思考のポケットは空っぽです";
      let desc = "上部の <strong>＋</strong> ボタンから新しい思考を書き留めましょう。";

      if (this.state.activeDeck === "inbox") {
        icon = "📥";
        title = "Inboxは空です。";
        desc = "思考のポケットは静かに整っています。<br>上部の <strong>＋</strong> ボタンから、いつでも新しい思考をポケットに放り込みましょう。";
      } else if (this.state.activeDeck !== "all") {
        icon = "🏷️";
        title = `#${escapeHtml(this.state.activeDeck)} のメモはありません`;
        desc = "このカテゴリのメモはすべて消化されたか、まだ存在しません。";
      }

      emptyCard.innerHTML = `
        <div class="empty-state-wrap" style="text-align: center; padding: 48px 24px; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; gap: 16px;">
          <span style="font-size: 44px; opacity: 0.85;">${icon}</span>
          <h2 style="font-size: 17px; font-weight: 700; color: var(--text-main); margin: 0; line-height: 1.5;">${title}</h2>
          <p style="font-size: 13px; color: var(--text-muted); line-height: 1.7; margin: 0;">${desc}</p>
        </div>
      `;
      this.stage.appendChild(emptyCard);
      this.centerCard = emptyCard;
      this.topCard = null;
      this.bottomCard = null;
      this.rightCard = null;
      return;
    }

    const current = this.state.getCurrentNote();
    const top = this.state.getTopNote();
    const bottom = this.state.getBottomNote();
    const linked = this.state.getLinkedNotes();

    // 1. 上のカード（より新しい）
    if (top) {
      this.topCard = this.createCardElement(top, "card-top");
      this.stage.appendChild(this.topCard);
    } else {
      this.topCard = null;
    }

    // 2. 下のカード（より古い）
    if (bottom) {
      this.bottomCard = this.createCardElement(bottom, "card-bottom");
      this.stage.appendChild(this.bottomCard);
    } else {
      this.bottomCard = null;
    }

    // 3. 左右の関連カード（もしリンクが存在すれば）
    if (linked.length > 0) {
      this.rightCard = this.createCardElement(linked[0], "card-right");
      this.stage.appendChild(this.rightCard);
    } else {
      this.rightCard = null;
    }
    this.leftCard = null;

    // 4. 中央のアクティブカード
    if (current) {
      this.centerCard = this.createCardElement(current, "card-center");
      this.stage.appendChild(this.centerCard);
    }
  }

  // ---------------------------------------------------------------------------
  // 状態バッジ＆ボタン表示更新
  // ---------------------------------------------------------------------------
  updateStatus() {
    const filtered = this.state.getFilteredNotes();
    const total = filtered.length;

    // デッキ名バッジの更新
    if (this.deckNameBadge) {
      if (this.state.activeDeck === "inbox") {
        this.deckNameBadge.textContent = "Inbox";
      } else if (this.state.activeDeck === "all") {
        this.deckNameBadge.textContent = "すべて";
      } else {
        this.deckNameBadge.textContent = `#${this.state.activeDeck}`;
      }
    }

    if (total === 0) {
      this.indexBadge.textContent = "0 / 0";
      this.timeBadge.textContent = "空っぽ";
      this.timeBadge.className = "time-badge is-latest";
      this.btnReturnLatest.style.opacity = "0";
      this.btnReturnLatest.style.pointerEvents = "none";
      return;
    }

    const currentNum = this.state.currentIndex + 1;
    this.indexBadge.textContent = `${currentNum} / ${total}`;

    const currentNote = this.state.getCurrentNote();
    // インラインスタイルをクリアしてCSSクラスに委ねる
    this.timeBadge.style.color = "";
    this.timeBadge.style.backgroundColor = "";

    if (this.state.currentIndex === 0) {
      this.timeBadge.textContent = "最新";
      this.timeBadge.className = "time-badge is-latest";
      // 最新のときは戻るボタンを非表示
      this.btnReturnLatest.style.opacity = "0";
      this.btnReturnLatest.style.pointerEvents = "none";
    } else {
      this.timeBadge.textContent = currentNote ? currentNote.timeAgo : "";
      this.timeBadge.className = "time-badge is-past";
      // 過去にいるときは戻るボタンを表示
      this.btnReturnLatest.style.opacity = "1";
      this.btnReturnLatest.style.pointerEvents = "auto";
    }
  }

  // ---------------------------------------------------------------------------
  // ジェスチャーイベント登録（ポインター・ホイール・キーボード）
  // ---------------------------------------------------------------------------
  bindEvents() {
    // ポインターイベント（マウス・タッチ共通）
    this.viewport.addEventListener("pointerdown", (e) => this.onPointerDown(e));
    window.addEventListener("pointermove", (e) => this.onPointerMove(e));
    window.addEventListener("pointerup", (e) => this.onPointerUp(e));
    window.addEventListener("pointercancel", (e) => this.onPointerUp(e));

    // マウスホイール（上下めくり）
    let wheelTimeout = null;
    this.viewport.addEventListener("wheel", (e) => {
      e.preventDefault();
      if (this.isWarping) return;
      if (wheelTimeout) return;

      if (e.deltaY > 30) {
        this.triggerCardSwitch("down");
      } else if (e.deltaY < -30) {
        this.triggerCardSwitch("up");
      }

      wheelTimeout = setTimeout(() => {
        wheelTimeout = null;
      }, 350);
    }, { passive: false });

    // キーボード操作
    window.addEventListener("keydown", (e) => {
      if (this.isWarping) return;
      if (e.key === "Escape") {
        if (this.groupModal && this.groupModal.classList.contains("is-active")) {
          this.closeGroupModal();
        } else if (this.state.isGridView) {
          this.closeGridSheet();
        } else if (this.state.isSelectMode) {
          this.exitSelectMode();
        } else if (this.settingsModal && this.settingsModal.classList.contains("is-active")) {
          this.closeSettings();
        } else if (this.noteModal && this.noteModal.classList.contains("is-active")) {
          this.closeModal();
        }
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        this.triggerCardSwitch("down");
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        this.triggerCardSwitch("up");
      } else if (e.key === "ArrowRight" && this.rightCard) {
        e.preventDefault();
        this.triggerCardSwitch("right");
      }
    });

    // 🏷️ 整理（複数選択モード）ボタン
    if (this.btnStartSelect) {
      this.btnStartSelect.addEventListener("click", () => this.enterSelectMode());
    }
    if (this.btnCancelSelect) {
      this.btnCancelSelect.addEventListener("click", () => this.exitSelectMode());
    }
    if (this.btnSelectAllToggle) {
      this.btnSelectAllToggle.addEventListener("click", () => this.toggleSelectAll());
    }

    // 🛠️ アクションバー（リンク、グループ化、結合、コピー、手放す、一覧）
    if (this.btnActionLink) {
      this.btnActionLink.addEventListener("click", () => this.executeLink());
    }
    if (this.btnActionGroup) {
      this.btnActionGroup.addEventListener("click", () => this.openGroupModal());
    }
    if (this.btnActionJoin) {
      this.btnActionJoin.addEventListener("click", () => this.executeJoin());
    }
    if (this.btnActionExport) {
      this.btnActionExport.addEventListener("click", () => this.executeExport());
    }
    if (this.btnActionArchive) {
      this.btnActionArchive.addEventListener("click", () => this.executeArchive());
    }
    if (this.btnToggleGrid) {
      this.btnToggleGrid.addEventListener("click", () => this.toggleGridView());
    }

    // ⊞ グリッドシート操作
    if (this.btnCloseGridSheet) {
      this.btnCloseGridSheet.addEventListener("click", () => this.closeGridSheet());
    }
    if (this.gridViewSheet) {
      this.gridViewSheet.addEventListener("click", (e) => {
        if (e.target === this.gridViewSheet) this.closeGridSheet();
      });
    }

    // 🏷️ グループ化モーダル操作
    if (this.btnCloseGroupModal) {
      this.btnCloseGroupModal.addEventListener("click", () => this.closeGroupModal());
    }
    if (this.btnCancelGroup) {
      this.btnCancelGroup.addEventListener("click", () => this.closeGroupModal());
    }
    if (this.btnApplyGroup) {
      this.btnApplyGroup.addEventListener("click", () => this.executeGroup());
    }
    if (this.inputGroupCategory) {
      this.inputGroupCategory.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          this.executeGroup();
        }
      });
    }
    if (this.groupModal) {
      this.groupModal.addEventListener("click", (e) => {
        if (e.target === this.groupModal) this.closeGroupModal();
      });
    }

    // ↩️ Toast Undoボタン
    if (this.btnToastUndo) {
      this.btnToastUndo.addEventListener("click", () => this.triggerUndo());
    }

    // 🚀 ロケットボタン（Mさんのワープ発掘）
    this.btnRocket.addEventListener("click", () => this.triggerRocketWarp());

    // 最新に戻るボタン
    this.btnReturnLatest.addEventListener("click", () => {
      if (this.isWarping) return;
      this.state.jumpTo(0);
      this.renderCards();
      this.updateStatus();
    });

    // ＋ 新規メモ作成ボタン（ダイレクトに新規作成モードを開く）
    if (this.btnNewNote) {
      this.btnNewNote.addEventListener("click", () => this.openEditor("create"));
    }

    // ☁️ 同期キューインジケーター（クリックで完全双方向同期を実行）
    if (this.syncIndicator) {
      this.syncIndicator.addEventListener("click", () => {
        this.syncAll({ isManual: true });
      });
    }

    // ネットワーク復帰時に自動同期（プッシュ＆プル）
    window.addEventListener("online", () => {
      console.log("Online detected: triggering full sync");
      this.syncAll({ isManual: false });
    });

    // タブがフォアグラウンドに戻った時に自動プル同期
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") {
        const token = localStorage.getItem("petasos_github_token");
        const repo = localStorage.getItem("petasos_github_repo");
        if (token && repo) {
          console.log("Visibility visible: triggering background sync");
          this.syncAll({ isManual: false });
        }
      }
    });

    // ⚙️ 設定ボタン（設定モーダルを開く）
    if (this.btnSettingsOpen) {
      this.btnSettingsOpen.addEventListener("click", () => this.openSettings());
    }
    if (this.btnCloseSettings) {
      this.btnCloseSettings.addEventListener("click", () => this.closeSettings());
    }
    if (this.settingsModal) {
      this.settingsModal.addEventListener("click", (e) => {
        if (e.target === this.settingsModal) {
          this.closeSettings();
        }
      });
    }

    // 設定モーダル内のアクション
    if (this.btnExportJson) {
      this.btnExportJson.addEventListener("click", () => this.exportNotesAsJson());
    }
    if (this.btnClearQueue) {
      this.btnClearQueue.addEventListener("click", () => this.clearSyncQueue());
    }
    if (this.btnSaveGithubConfig) {
      this.btnSaveGithubConfig.addEventListener("click", () => this.saveGithubConfig());
    }
    if (this.btnSyncPullNow) {
      this.btnSyncPullNow.addEventListener("click", () => this.syncAll({ isManual: true }));
    }
    if (this.btnTestGithub) {
      this.btnTestGithub.addEventListener("click", () => this.testGithubConnection());
    }
    if (this.btnInstallPwa) {
      this.btnInstallPwa.addEventListener("click", () => this.installPwa());
    }

    // 📖 モーダル内アクション紐付け
    // 閲覧モードのアクション
    if (this.btnCloseModal) {
      this.btnCloseModal.addEventListener("click", () => this.closeModal());
    }
    if (this.btnSwitchToEdit) {
      this.btnSwitchToEdit.addEventListener("click", () => this.switchToEdit());
    }

    // 編集モードのアクション
    if (this.btnCancelEdit) {
      this.btnCancelEdit.addEventListener("click", () => this.cancelEdit());
    }
    if (this.btnCommitEdit) {
      this.btnCommitEdit.addEventListener("click", () => this.commitEditor());
    }

    // 背景クリックで閉じる
    if (this.noteModal) {
      this.noteModal.addEventListener("click", (e) => {
        if (e.target === this.noteModal) {
          this.closeModal();
        }
      });
    }

    // 閲覧モード内でのインタラクティブ操作（チェックボックスクリック ＆ リンクチップクリック）
    if (this.viewContent) {
      this.viewContent.addEventListener("click", (e) => {
        const todoItem = e.target.closest(".todo-item");
        if (todoItem) {
          const lineIndex = parseInt(todoItem.dataset.lineIndex, 10);
          if (!isNaN(lineIndex)) {
            this.toggleTodoItem(lineIndex);
          }
        }
      });
    }

    if (this.viewLinksChips) {
      this.viewLinksChips.addEventListener("click", (e) => {
        const chip = e.target.closest(".link-chip");
        if (chip && chip.dataset.targetId) {
          const targetIndex = this.state.notes.findIndex(n => n.id === chip.dataset.targetId);
          if (targetIndex !== -1) {
            this.state.jumpTo(targetIndex);
            this.renderCards();
            this.updateStatus();
            this.openReader(); // 新しいメモで閲覧モード再表示
          }
        }
      });
    }

    // 思考の束（デッキ）ピッカー開閉
    if (this.deckStatus) {
      this.deckStatus.addEventListener("click", (e) => {
        e.stopPropagation();
        this.toggleDeckPicker();
      });
      this.deckStatus.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          this.toggleDeckPicker();
        }
      });
    }

    // デッキピッカー外側クリックで閉じる
    document.addEventListener("pointerdown", (e) => {
      if (this.deckPickerPopover && this.deckPickerPopover.style.display !== "none") {
        if (!this.deckPickerPopover.contains(e.target) && !this.deckStatus.contains(e.target)) {
          this.closeDeckPicker();
        }
      }
    });
  }

  // ---------------------------------------------------------------------------
  // 思考の束（デッキ）ピッカー制御
  // ---------------------------------------------------------------------------
  toggleDeckPicker() {
    if (!this.deckPickerPopover) return;
    if (this.deckPickerPopover.style.display === "none" || !this.deckPickerPopover.style.display) {
      this.openDeckPicker();
    } else {
      this.closeDeckPicker();
    }
  }

  openDeckPicker() {
    if (!this.deckPickerPopover || !this.deckPickerList) return;
    this.renderDeckPickerList();
    this.deckPickerPopover.style.display = "flex";
  }

  closeDeckPicker() {
    if (this.deckPickerPopover) {
      this.deckPickerPopover.style.display = "none";
    }
  }

  renderDeckPickerList() {
    if (!this.deckPickerList) return;
    this.deckPickerList.innerHTML = "";

    const counts = this.state.getDeckCategoriesWithCounts();
    const currentActive = this.state.activeDeck;

    // 1. Inbox
    const inboxItem = this.createDeckPickerItem({
      id: "inbox",
      icon: "📥",
      label: "Inbox",
      count: counts.inbox,
      isActive: currentActive === "inbox"
    });
    this.deckPickerList.appendChild(inboxItem);

    // 2. すべて
    const allItem = this.createDeckPickerItem({
      id: "all",
      icon: "🌌",
      label: "すべて",
      count: counts.all,
      isActive: currentActive === "all"
    });
    this.deckPickerList.appendChild(allItem);

    // 3. 各カテゴリ
    if (counts.categories.length > 0) {
      const divider = document.createElement("div");
      divider.style.height = "1px";
      divider.style.background = "var(--border-subtle, rgba(128, 128, 128, 0.15))";
      divider.style.margin = "4px 0";
      this.deckPickerList.appendChild(divider);

      counts.categories.forEach(cat => {
        const catItem = this.createDeckPickerItem({
          id: cat.name,
          icon: "🏷️",
          label: `#${cat.name}`,
          count: cat.count,
          isActive: currentActive === cat.name
        });
        this.deckPickerList.appendChild(catItem);
      });
    }
  }

  createDeckPickerItem({ id, icon, label, count, isActive }) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `deck-picker-item${isActive ? " is-active" : ""}`;
    btn.innerHTML = `
      <span class="deck-picker-item-label">
        <span class="deck-picker-item-icon">${icon}</span>
        <span>${escapeHtml(label)}</span>
      </span>
      <span class="deck-picker-item-count">${count}</span>
    `;

    btn.addEventListener("click", () => {
      this.selectDeck(id);
    });

    return btn;
  }

  selectDeck(deckId) {
    this.state.setDeck(deckId);
    this.closeDeckPicker();
    this.renderCards();
    this.updateStatus();
  }

  // ---------------------------------------------------------------------------
  // ポインター処理（身体性・指吸い付きの実装 ＆ 長押し選択モード判定）
  // ---------------------------------------------------------------------------
  onPointerDown(e) {
    if (this.isWarping) return;
    if (e.target.closest("button")) return; // ボタン押下時はスルー

    // チェックボックス直接タップ時はドラッグ開始せず選択トグル
    const checkboxDirect = e.target.closest(".card-select-checkbox");
    if (checkboxDirect) {
      const card = checkboxDirect.closest(".note-card");
      if (card && card.dataset.id) {
        if (!this.state.isSelectMode) {
          this.enterSelectMode(card.dataset.id);
        } else {
          this.toggleNoteSelection(card.dataset.id);
        }
        return;
      }
    }

    this.isDragging = true;
    this.startX = e.clientX;
    this.startY = e.clientY;
    this.currentDeltaX = 0;
    this.currentDeltaY = 0;
    this.dragAxis = null;

    // 💡 長押し（ロングプレス）判定の仕込み（450ms）
    const centerCard = e.target.closest(".note-card.card-center");
    if (centerCard && !this.noteModal.classList.contains("is-active") && !this.settingsModal.classList.contains("is-active")) {
      this.longPressFired = false;
      this.longPressCard = centerCard;
      centerCard.classList.add("is-long-pressing");

      this.longPressTimer = setTimeout(() => {
        this.longPressFired = true;
        if (this.longPressCard) {
          this.longPressCard.classList.remove("is-long-pressing");
          this.longPressCard = null;
        }
        if (navigator.vibrate) {
          try { navigator.vibrate(40); } catch (_) {}
        }
        const noteId = centerCard.dataset.id;
        if (!this.state.isSelectMode) {
          this.enterSelectMode(noteId);
        } else {
          this.toggleNoteSelection(noteId);
        }
      }, 450);
    }

    if (this.centerCard) {
      this.centerCard.classList.add("is-dragging");
    }
    if (this.topCard) this.topCard.classList.add("is-dragging");
    if (this.bottomCard) this.bottomCard.classList.add("is-dragging");
    if (this.rightCard) this.rightCard.classList.add("is-dragging");

    // 操作開始したらヒントをフェードアウト
    if (this.gestureHint) {
      this.gestureHint.style.opacity = "0";
    }
  }

  onPointerMove(e) {
    if (!this.isDragging) return;

    const dx = e.clientX - this.startX;
    const dy = e.clientY - this.startY;

    // 微小な移動を超えたら長押し判定をキャンセル
    if (this.longPressTimer && (Math.abs(dx) > 6 || Math.abs(dy) > 6)) {
      clearTimeout(this.longPressTimer);
      this.longPressTimer = null;
      if (this.longPressCard) {
        this.longPressCard.classList.remove("is-long-pressing");
        this.longPressCard = null;
      }
    }

    // 方向（縦 or 横）の判定（しきい値 8px）
    if (!this.dragAxis) {
      if (Math.abs(dy) > 8 || Math.abs(dx) > 8) {
        this.dragAxis = Math.abs(dy) >= Math.abs(dx) ? "vertical" : "horizontal";
      }
    }

    if (this.dragAxis === "vertical") {
      // 縦スワイプ：上下の移動量をそのまま反映（端での抵抗感ゴムエフェクト）
      let effectiveDy = dy;
      if ((!this.topCard && dy > 0) || (!this.bottomCard && dy < 0)) {
        effectiveDy = dy * 0.25; // 先頭や末尾では重くする
      }
      this.currentDeltaY = effectiveDy;
      this.currentDeltaX = 0;

      // 中央カードの移動
      if (this.centerCard) {
        this.centerCard.style.transform = `translate3d(0, ${effectiveDy}px, 0) scale(${1 - Math.abs(effectiveDy) * 0.0003})`;
      }

      // 上カード（引き下げ時）
      if (this.topCard && effectiveDy > 0) {
        const progress = Math.min(effectiveDy / 300, 1);
        const yPos = -92 + progress * 92;
        const scale = 0.92 + progress * 0.08;
        const opacity = 0.6 + progress * 0.4;
        this.topCard.style.transform = `translate3d(0, ${yPos}%, 0) scale(${scale})`;
        this.topCard.style.opacity = opacity;
      }

      // 下カード（引き上げ時）
      if (this.bottomCard && effectiveDy < 0) {
        const progress = Math.min(Math.abs(effectiveDy) / 300, 1);
        const yPos = 92 - progress * 92;
        const scale = 0.92 + progress * 0.08;
        const opacity = 0.6 + progress * 0.4;
        this.bottomCard.style.transform = `translate3d(0, ${yPos}%, 0) scale(${scale})`;
        this.bottomCard.style.opacity = opacity;
      }

    } else if (this.dragAxis === "horizontal") {
      // 横スワイプ：関連メモへのスライド
      let effectiveDx = dx;
      if (!this.rightCard && dx < 0) {
        effectiveDx = dx * 0.2;
      }
      if (dx > 0) {
        effectiveDx = dx * 0.2; // 今回は右スライドのみリンクがある想定
      }
      this.currentDeltaX = effectiveDx;
      this.currentDeltaY = 0;

      if (this.centerCard) {
        this.centerCard.style.transform = `translate3d(${effectiveDx}px, 0, 0)`;
      }

      if (this.rightCard && effectiveDx < 0) {
        const progress = Math.min(Math.abs(effectiveDx) / 300, 1);
        const xPos = 94 - progress * 94;
        this.rightCard.style.transform = `translate3d(${xPos}%, 0, 0) scale(${0.92 + progress * 0.08})`;
        this.rightCard.style.opacity = 0.6 + progress * 0.4;
      }
    }
  }

  onPointerUp(e) {
    if (!this.isDragging) return;
    this.isDragging = false;

    // 長押しタイマーの後始末
    if (this.longPressTimer) {
      clearTimeout(this.longPressTimer);
      this.longPressTimer = null;
    }
    if (this.longPressCard) {
      this.longPressCard.classList.remove("is-long-pressing");
      this.longPressCard = null;
    }

    // 長押しが成立した直後はドラッグやタップを発火させない
    if (this.longPressFired) {
      this.longPressFired = false;
      this.resetCardTransforms();
      return;
    }

    // トランジション復活
    [this.centerCard, this.topCard, this.bottomCard, this.rightCard].forEach(card => {
      if (card) {
        card.classList.remove("is-dragging");
      }
    });

    // 💡 タップ判定：ドラッグ移動量がごくわずかな場合
    if (Math.abs(this.currentDeltaX) < 6 && Math.abs(this.currentDeltaY) < 6) {
      const centerTarget = e.target.closest(".note-card.card-center");
      if (centerTarget) {
        if (this.state.isSelectMode) {
          // 選択モード中はカードタップで選択トグル！
          this.toggleNoteSelection(centerTarget.dataset.id);
        } else {
          // 通常時は閲覧モードを開く（安全地帯）
          this.openReader();
        }
        return;
      }
    }

    const threshold = 65; // めくり確定のしきい値(px)

    if (this.dragAxis === "vertical") {
      if (this.currentDeltaY < -threshold && this.bottomCard) {
        // 下から上へスワイプ ➔ 過去へ（次のカード）
        this.triggerCardSwitch("down");
      } else if (this.currentDeltaY > threshold && this.topCard) {
        // 上から下へスワイプ ➔ 未来へ（前のカード）
        this.triggerCardSwitch("up");
      } else {
        // 移動量不足 ➔ スッと元の位置に戻る（リセット）
        this.resetCardTransforms();
      }
    } else if (this.dragAxis === "horizontal") {
      if (this.currentDeltaX < -threshold && this.rightCard) {
        // 左へスワイプ ➔ 関連メモへ
        this.triggerCardSwitch("right");
      } else {
        this.resetCardTransforms();
      }
    } else {
      this.resetCardTransforms();
    }
  }

  // ---------------------------------------------------------------------------
  // 元の位置へスナップ（キャンセル時）
  // ---------------------------------------------------------------------------
  resetCardTransforms() {
    if (this.centerCard) {
      this.centerCard.style.transform = "";
      this.centerCard.style.opacity = "";
    }
    if (this.topCard) {
      this.topCard.style.transform = "";
      this.topCard.style.opacity = "";
    }
    if (this.bottomCard) {
      this.bottomCard.style.transform = "";
      this.bottomCard.style.opacity = "";
    }
    if (this.rightCard) {
      this.rightCard.style.transform = "";
      this.rightCard.style.opacity = "";
    }
  }

  // ---------------------------------------------------------------------------
  // カード切り替えアニメーション ＆ 状態更新
  // ---------------------------------------------------------------------------
  triggerCardSwitch(direction) {
    if (direction === "down") {
      // 過去へ
      if (!this.state.moveDown()) {
        this.resetCardTransforms();
        return;
      }
    } else if (direction === "up") {
      // 未来へ
      if (!this.state.moveUp()) {
        this.resetCardTransforms();
        return;
      }
    } else if (direction === "right") {
      // 関連メモへジャンプ
      const current = this.state.getCurrentNote();
      if (current.links && current.links.length > 0) {
        const targetId = current.links[0];
        const targetIndex = this.state.notes.findIndex(n => n.id === targetId);
        if (targetIndex !== -1) {
          this.state.jumpTo(targetIndex);
        }
      }
    }

    // 新しい状態のカードを再描画
    this.renderCards();
    this.updateStatus();
  }

  // ---------------------------------------------------------------------------
  // 🚀 Mさんのロケットボタン（思考の全宇宙を巡るランダム発掘ワープ演出）
  // ---------------------------------------------------------------------------
  triggerRocketWarp() {
    if (this.isWarping) return;

    // ワープ対象は境界を越えた全宇宙（全アクティブメモ）
    const allNotes = this.state.notes.filter(n => n.status !== "archived");
    if (allNotes.length <= 1) {
      this.showToast("🚀 ワープできるメモがまだ十分にありません");
      return;
    }

    this.isWarping = true;

    // どの束にいても「すべて」の大地へ自動で持ち替えて大ジャンプ
    this.state.setDeck("all");

    const total = allNotes.length;
    let targetIndex = Math.floor(Math.random() * total);
    if (targetIndex === this.state.currentIndex && total > 1) {
      targetIndex = (targetIndex + 1) % total;
    }

    // ロケットボタンの回転＆加速モーション
    this.btnRocket.style.transform = "scale(1.2) rotate(-45deg)";

    // ワープ演出オーバーレイON
    this.warpOverlay.classList.add("is-active");

    // カードがシュババッと高速でめくられる演出
    let shuffleCount = 0;
    const shuffleInterval = setInterval(() => {
      const tempRandom = Math.floor(Math.random() * total);
      this.state.currentIndex = tempRandom;
      this.renderCards();
      shuffleCount++;

      if (shuffleCount >= 5) {
        clearInterval(shuffleInterval);
        
        // 最終目的地に着地
        setTimeout(() => {
          this.state.jumpTo(targetIndex);
          this.renderCards();
          this.updateStatus();

          this.warpOverlay.classList.remove("is-active");
          this.btnRocket.style.transform = "";
          this.isWarping = false;

          // 着地カードの微かなバウンス演出
          if (this.centerCard) {
            this.centerCard.style.animation = "pulse-dot 0.5s ease-out";
          }
        }, 180);
      }
    }, 80);
  }

  // ===========================================================================
  // 📖 閲覧モード（安全地帯 ＆ 全文スクロール読書）
  // ===========================================================================
  openReader() {
    const note = this.state.getCurrentNote();
    if (!note) return;

    // ヘッダーアクションを「閲覧用」に切り替え
    this.headerViewActions.style.display = "flex";
    this.headerEditActions.style.display = "none";

    // パネルを「閲覧用」に切り替え
    this.viewPanel.style.display = "flex";
    this.editPanel.style.display = "none";

    // データのバインド
    this.viewTitle.textContent = note.title;
    const catLabel = note.category ? `#${escapeHtml(note.category)}` : "Inbox";
    this.viewCategoryBadge.innerHTML = `<span class="tag-dot"></span> ${catLabel}`;
    this.viewDateDisplay.textContent = note.date;

    // 本文のMarkdown/チェックリスト変換（行単位でインデックス保持）
    const lines = note.content.split("\n");
    const bodyHTML = lines.map((line, idx) => {
      const trimmed = line.trim();
      if (trimmed.startsWith("- [ ]")) {
        return `<div class="todo-item" data-line-index="${idx}">
          <span class="todo-check"></span>
          <span>${escapeHtml(trimmed.slice(5).trim())}</span>
        </div>`;
      } else if (trimmed.startsWith("- [x]")) {
        return `<div class="todo-item" data-line-index="${idx}">
          <span class="todo-check checked"></span>
          <span style="text-decoration: line-through; opacity: 0.65;">${escapeHtml(trimmed.slice(5).trim())}</span>
        </div>`;
      } else if (trimmed.startsWith("## ")) {
        return `<h3 style="font-size: 18px; font-weight: 700; margin: 14px 0 6px; color: var(--text-main);">${escapeHtml(trimmed.slice(3))}</h3>`;
      } else if (trimmed === "") {
        return `<div style="height: 10px;"></div>`;
      }
      return `<div>${escapeHtml(line)}</div>`;
    }).join("");

    this.viewContent.innerHTML = bodyHTML;

    // リンク先メモの表示
    const linked = this.state.getLinkedNotes();
    if (linked.length > 0) {
      this.viewLinksSection.style.display = "block";
      this.viewLinksChips.innerHTML = linked.map(l => 
        `<span class="link-chip" data-target-id="${l.id}" style="cursor: pointer;">🔗 ${escapeHtml(l.title)}</span>`
      ).join("");
    } else {
      this.viewLinksSection.style.display = "none";
    }

    // モーダルオープン
    this.noteModal.classList.add("is-active");
  }

  // 閲覧モード内でのインタラクティブなチェックリスト反転
  async toggleTodoItem(lineIndex) {
    const note = this.state.getCurrentNote();
    if (!note) return;

    const lines = note.content.split("\n");
    if (lineIndex < 0 || lineIndex >= lines.length) return;

    const targetLine = lines[lineIndex].trim();
    if (targetLine.startsWith("- [ ]")) {
      lines[lineIndex] = lines[lineIndex].replace("- [ ]", "- [x]");
    } else if (targetLine.startsWith("- [x]")) {
      lines[lineIndex] = lines[lineIndex].replace("- [x]", "- [ ]");
    }

    note.content = lines.join("\n");
    note.updated_at = new Date().toISOString();

    // IndexedDB保存 ＆ 同期キューへの追加
    try {
      await this.storage.saveNote(note, "update");
      await this.updateSyncIndicator();
      this.syncPushQueue({ isManual: false });
    } catch (e) {
      console.warn("Storage save error:", e);
    }

    // 閲覧画面とデッキカードを即時反映
    this.openReader();
    this.renderCards();
  }

  // ===========================================================================
  // 📝 編集モードへの切り替え ＆ 新規作成
  // ===========================================================================
  switchToEdit() {
    this.editorMode = "edit";
    const note = this.state.getCurrentNote();
    if (!note) return;

    // フォームに値を流し込む
    this.editTitle.value = note.title;
    this.editCategory.value = note.category || "";
    this.editContent.value = note.content;
    this.editDateDisplay.textContent = note.date;
    this.modalEditBadge.textContent = "編集モード";

    const linked = this.state.getLinkedNotes();
    if (linked.length > 0) {
      this.editLinksSection.style.display = "block";
      this.editLinksChips.innerHTML = linked.map(l => 
        `<span class="link-chip">🔗 ${escapeHtml(l.title)}</span>`
      ).join("");
    } else {
      this.editLinksSection.style.display = "none";
    }

    // ヘッダーとパネルを「編集用」に切り替え
    this.headerViewActions.style.display = "none";
    this.headerEditActions.style.display = "flex";
    this.viewPanel.style.display = "none";
    this.editPanel.style.display = "flex";

    setTimeout(() => {
      this.editContent.focus();
    }, 150);
  }

  openEditor(mode = "create") {
    this.editorMode = mode;

    this.editTitle.value = "";
    this.editCategory.value = "";
    this.editContent.value = "";
    this.editDateDisplay.textContent = formatCurrentDate();
    this.modalEditBadge.textContent = "新規メモ";
    this.editLinksSection.style.display = "none";

    // ヘッダーとパネルを「編集用」に切り替え
    this.headerViewActions.style.display = "none";
    this.headerEditActions.style.display = "flex";
    this.viewPanel.style.display = "none";
    this.editPanel.style.display = "flex";

    this.noteModal.classList.add("is-active");

    setTimeout(() => {
      this.editTitle.focus();
    }, 200);
  }

  cancelEdit() {
    if (this.editorMode === "create") {
      this.closeModal();
    } else {
      // 既存編集のキャンセルは閲覧モードへ戻る（安全地帯）
      this.openReader();
    }
  }

  async commitEditor() {
    const titleVal = this.editTitle.value.trim();
    const categoryVal = this.editCategory.value.trim();
    const contentVal = this.editContent.value.trim();

    let finalTitle = titleVal;
    if (!finalTitle) {
      if (contentVal) {
        const firstLine = contentVal.split("\n")[0].replace(/^[-*#\s\[\]x]+/, "").trim();
        finalTitle = firstLine.slice(0, 24) || "無題の思考";
      } else {
        finalTitle = "無題の思考";
      }
    }

    const currentDateStr = formatCurrentDate();
    const currentIso = new Date().toISOString();

    if (this.editorMode === "edit") {
      const note = this.state.getCurrentNote();
      if (note) {
        const oldCategory = (note.category || "").trim();
        const newCategory = categoryVal.trim();

        note.title = finalTitle;
        note.category = newCategory;
        note.content = contentVal;
        note.date = currentDateStr;
        note.updated_at = currentIso;
        note.timeAgo = "たった今更新";

        // IndexedDB保存 ＆ 同期キュー追加
        try {
          await this.storage.saveNote(note, "update");
        } catch (e) {
          console.warn("Storage save error:", e);
        }

        // カテゴリが変更・付与されたときの優しいトースト通知（「消えた？」の不安解消）
        if (oldCategory !== newCategory && newCategory) {
          this.showToast(`🏷️ 「#${newCategory}」デッキへ移動しました`);
        } else if (oldCategory && !newCategory) {
          this.showToast("📥 「Inbox」デッキへ移動しました");
        } else {
          this.showToast("コミット完了 - メモを更新しました");
        }
      }
      this.renderCards();
      this.updateStatus();
      await this.updateSyncIndicator();
      this.syncPushQueue({ isManual: false });
      this.openReader(); // コミット後は閲覧モードで確認
    } else {
      // 新規作成 ➔ 先頭に追加（未指定時は空文字＝Inbox所属）
      const newNote = {
        id: "note-" + Date.now().toString(36),
        title: finalTitle,
        category: categoryVal.trim(),
        date: currentDateStr,
        created_at: currentIso,
        updated_at: currentIso,
        timeAgo: "最新",
        content: contentVal,
        links: [],
        status: "active"
      };

      this.state.notes.unshift(newNote);
      this.state.currentIndex = 0;

      // IndexedDB保存 ＆ 同期キュー追加
      try {
        await this.storage.saveNote(newNote, "create");
      } catch (e) {
        console.warn("Storage save error:", e);
      }

      if (newNote.category) {
        this.showToast(`✨ 「#${newNote.category}」デッキに放り込みました`);
      } else {
        this.showToast("✨ 新しい思考をInboxのポケットに放り込みました");
      }
      this.renderCards();
      this.updateStatus();
      await this.updateSyncIndicator();
      this.syncPushQueue({ isManual: false });
      this.openReader(); // 新規作成後も閲覧モードで美しく確認
    }

    if (this.centerCard) {
      this.centerCard.style.animation = "pulse-dot 0.6s ease-out";
    }
  }

  closeModal() {
    this.noteModal.classList.remove("is-active");
  }

  // ===========================================================================
  // ⚙️ 設定モーダル（環境設定・データ・GitHub）
  // ===========================================================================
  async openSettings(defaultTab = null) {
    if (!this.settingsModal) return;

    if (defaultTab) {
      this.setSettingsTab(defaultTab);
    }

    // 1. 保存済みメモ数
    if (this.settingsNotesCount) {
      this.settingsNotesCount.textContent = `${this.state.notes.length} 件`;
    }

    // 2. 同期待ちキュー件数
    if (this.settingsQueueCount) {
      const qCount = await this.storage.getPendingQueueCount();
      this.settingsQueueCount.textContent = `${qCount} 件`;
    }

    // 3. GitHub設定の復元
    if (this.inputGithubToken) {
      this.inputGithubToken.value = localStorage.getItem("petasos_github_token") || "";
    }
    if (this.inputGithubRepo) {
      this.inputGithubRepo.value = localStorage.getItem("petasos_github_repo") || "";
    }

    // 4. 現在のテーマと星屑設定を反映
    const currentTheme = document.documentElement.getAttribute("data-theme") || "twilight";
    this.setTheme(currentTheme);

    const toggleStars = document.getElementById("toggle-stars");
    if (toggleStars) {
      toggleStars.checked = localStorage.getItem("petasos_stars") !== "off";
    }

    // 5. 前回のGitHubテスト結果表示をリセット
    if (this.githubTestResult) {
      this.githubTestResult.style.display = "none";
      this.githubTestResult.textContent = "";
    }

    this.settingsModal.classList.add("is-active");
  }

  closeSettings() {
    if (!this.settingsModal) return;
    this.settingsModal.classList.remove("is-active");
  }

  async exportNotesAsJson() {
    try {
      const allNotes = await this.storage.getAllNotes();
      const exportData = {
        app: "Petasos v2",
        exported_at: new Date().toISOString(),
        notes_count: allNotes.length,
        notes: allNotes
      };

      const jsonStr = JSON.stringify(exportData, null, 2);
      const blob = new Blob([jsonStr], { type: "application/json" });
      const url = URL.createObjectURL(blob);

      const now = new Date();
      const ymd = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
      const link = document.createElement("a");
      link.href = url;
      link.download = `petasos-backup-${ymd}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      this.showToast("📥 思考データをJSONとしてエクスポートしました");
    } catch (e) {
      console.error("Export error:", e);
      this.showToast("エクスポートに失敗しました");
    }
  }

  async clearSyncQueue() {
    try {
      await this.storage.clearQueue();
      await this.updateSyncIndicator();
      if (this.settingsQueueCount) {
        this.settingsQueueCount.textContent = "0 件";
      }
      this.showToast("🧹 同期キューをクリアしました");
    } catch (e) {
      console.error("Queue clear error:", e);
      this.showToast("キューのクリアに失敗しました");
    }
  }

  saveGithubConfig() {
    if (this.inputGithubToken && this.inputGithubRepo) {
      const token = this.inputGithubToken.value.trim();
      const repo = this.inputGithubRepo.value.trim();
      localStorage.setItem("petasos_github_token", token);
      localStorage.setItem("petasos_github_repo", repo);
      this.showToast("⚙️ GitHub設定をブラウザに保存しました");
      if (this.githubTestResult) {
        this.githubTestResult.style.display = "none";
      }
      this.syncPushQueue({ isManual: false });
    }
  }

  // ---------------------------------------------------------------------------
  // 🔌 GitHub API 接続テスト（疎通確認）
  // ---------------------------------------------------------------------------
  async testGithubConnection() {
    const token = (this.inputGithubToken ? this.inputGithubToken.value.trim() : "") || localStorage.getItem("petasos_github_token") || "";
    const repo = (this.inputGithubRepo ? this.inputGithubRepo.value.trim() : "") || localStorage.getItem("petasos_github_repo") || "";

    if (!token) {
      this.showGithubTestResult("error", "❌ Personal Access Token が入力されていません。");
      return;
    }
    if (!repo) {
      this.showGithubTestResult("error", "❌ リポジトリ名が入力されていません (例: username/petasos-notes)。");
      return;
    }

    this.setGithubTestLoading(true);
    this.showGithubTestResult("loading", "⏳ GitHub API に接続確認中...");

    try {
      const result = await this.github.testConnection(token, repo);
      if (result.success) {
        this.showGithubTestResult("success", result.message);
        // 接続成功時は自動的に設定を保存
        localStorage.setItem("petasos_github_token", token);
        localStorage.setItem("petasos_github_repo", repo);
        this.syncPushQueue({ isManual: false });
      } else {
        this.showGithubTestResult("error", result.message);
      }
    } catch (err) {
      console.error("testGithubConnection error:", err);
      this.showGithubTestResult("error", `❌ 予期せぬエラーが発生しました: ${err.message}`);
    } finally {
      this.setGithubTestLoading(false);
    }
  }

  showGithubTestResult(type, message) {
    if (!this.githubTestResult) return;
    this.githubTestResult.style.display = "block";
    this.githubTestResult.className = `github-test-result is-${type}`;
    this.githubTestResult.textContent = message;
  }

  setGithubTestLoading(isLoading) {
    if (!this.btnTestGithub) return;
    this.btnTestGithub.disabled = isLoading;
    if (this.btnTestGithubText) {
      this.btnTestGithubText.textContent = isLoading ? "確認中..." : "接続テスト";
    }
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
    // Undoがあるときは7.5秒間じっくり表示（ゆとりを持って元に戻せる）
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

  // ===========================================================================
  // 🏷️ 複数選択モード（整理モード）ロジック
  // ===========================================================================
  enterSelectMode(initialNoteId = null) {
    this.state.enterSelectMode(initialNoteId);
    document.body.classList.add("is-select-mode");

    if (this.normalHeaderPill) this.normalHeaderPill.style.display = "none";
    if (this.selectHeaderPill) this.selectHeaderPill.style.display = "flex";
    if (this.selectActionBar) this.selectActionBar.classList.add("is-active");

    this.updateSelectUI();
    this.updateCardSelectionVisuals();
  }

  exitSelectMode() {
    this.state.exitSelectMode();
    document.body.classList.remove("is-select-mode");

    if (this.normalHeaderPill) this.normalHeaderPill.style.display = "flex";
    if (this.selectHeaderPill) this.selectHeaderPill.style.display = "none";
    if (this.selectActionBar) this.selectActionBar.classList.remove("is-active");

    this.closeGridSheet();
    this.closeGroupModal();
    this.updateCardSelectionVisuals();
    this.renderCards();
    this.updateStatus();
  }

  toggleNoteSelection(noteId) {
    this.state.toggleSelection(noteId);
    this.updateSelectUI();
    this.updateCardSelectionVisuals();
    if (this.state.isGridView) {
      this.renderGridTiles();
    }
  }

  updateCardSelectionVisuals() {
    const cards = this.stage.querySelectorAll(".note-card");
    cards.forEach((card) => {
      const id = card.dataset.id;
      const isSel = this.state.isSelected(id);
      if (isSel) {
        card.classList.add("is-selected");
      } else {
        card.classList.remove("is-selected");
      }
      const hint = card.querySelector(".tap-hint");
      if (hint && card.classList.contains("card-center")) {
        hint.textContent = this.state.isSelectMode ? (isSel ? "✓ 選択中" : "タップで選択") : "タップで閲覧";
      }
    });
  }

  toggleSelectAll() {
    const activeNotes = this.state.notes.filter((n) => n.status !== "archived");
    if (this.state.getSelectedCount() >= activeNotes.length && activeNotes.length > 0) {
      this.state.clearSelection();
    } else {
      this.state.selectAll();
    }
    this.updateSelectUI();
    this.updateCardSelectionVisuals();
    if (this.state.isGridView) {
      this.renderGridTiles();
    }
  }

  updateSelectUI() {
    const count = this.state.getSelectedCount();
    const activeNotes = this.state.notes.filter((n) => n.status !== "archived");

    if (this.selectCountNum) this.selectCountNum.textContent = count;
    if (this.gridSelectedCountBadge) this.gridSelectedCountBadge.textContent = `${count} 件選択`;

    if (this.selectAllLabel) {
      this.selectAllLabel.textContent = (count >= activeNotes.length && count > 0) ? "解除" : "全選択";
    }

    if (this.btnActionLink) this.btnActionLink.disabled = count < 2;
    if (this.btnActionGroup) this.btnActionGroup.disabled = count === 0;
    if (this.btnActionJoin) this.btnActionJoin.disabled = count < 2;
    if (this.btnActionExport) this.btnActionExport.disabled = count === 0;
    if (this.btnActionArchive) this.btnActionArchive.disabled = count === 0;
  }

  // ===========================================================================
  // ⊞ 思考のタイル一覧シート（案1-C ハイブリッド）
  // ===========================================================================
  openGridSheet() {
    this.state.isGridView = true;
    if (this.gridViewSheet) this.gridViewSheet.classList.add("is-active");
    if (this.gridToggleText) this.gridToggleText.textContent = "デッキ";
    this.renderGridTiles();
  }

  closeGridSheet() {
    this.state.isGridView = false;
    if (this.gridViewSheet) this.gridViewSheet.classList.remove("is-active");
    if (this.gridToggleText) this.gridToggleText.textContent = "一覧";
  }

  toggleGridView() {
    if (this.state.isGridView) {
      this.closeGridSheet();
    } else {
      this.openGridSheet();
    }
  }

  renderGridTiles() {
    if (!this.gridTilesStage) return;
    this.gridTilesStage.innerHTML = "";

    const activeNotes = this.state.notes.filter((n) => n.status !== "archived");
    activeNotes.forEach((note) => {
      const isSel = this.state.isSelected(note.id);
      const tile = document.createElement("div");
      tile.className = `grid-tile${isSel ? " is-selected" : ""}`;
      tile.dataset.id = note.id;

      const snippet = escapeHtml(note.content.slice(0, 110));
      const hasLinks = note.links && note.links.length > 0;

      tile.innerHTML = `
        <div class="tile-header">
          <span class="tile-tag">#${escapeHtml(note.category)}</span>
          <div class="tile-checkbox" title="${isSel ? '選択解除' : '選択'}">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"
              stroke-linecap="round" stroke-linejoin="round">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
          </div>
        </div>
        <h4 class="tile-title">${escapeHtml(note.title)}</h4>
        <p class="tile-snippet">${snippet}</p>
        <div class="tile-footer">
          <span>${note.date}</span>
          ${hasLinks ? `<span>🔗 ${note.links.length}</span>` : ""}
        </div>
      `;

      tile.addEventListener("click", () => {
        this.toggleNoteSelection(note.id);
      });

      this.gridTilesStage.appendChild(tile);
    });
  }

  // ===========================================================================
  // 🏷️ グループ化（カテゴリ設定）モーダル
  // ===========================================================================
  openGroupModal() {
    const count = this.state.getSelectedCount();
    if (count === 0) return;

    if (this.groupTargetCount) this.groupTargetCount.textContent = count;
    if (this.inputGroupCategory) this.inputGroupCategory.value = "";

    // 既存カテゴリを抽出してタグチップ生成
    if (this.existingCategoryChips) {
      const cats = Array.from(new Set(this.state.notes.map((n) => n.category).filter(Boolean)));
      this.existingCategoryChips.innerHTML = cats
        .map((cat) => `<button type="button" class="existing-tag-chip" data-cat="${escapeHtml(cat)}">#${escapeHtml(cat)}</button>`)
        .join("");

      this.existingCategoryChips.querySelectorAll(".existing-tag-chip").forEach((chip) => {
        chip.addEventListener("click", () => {
          if (this.inputGroupCategory) {
            this.inputGroupCategory.value = chip.dataset.cat;
            this.inputGroupCategory.focus();
          }
        });
      });
    }

    if (this.groupModal) this.groupModal.classList.add("is-active");
    setTimeout(() => {
      if (this.inputGroupCategory) this.inputGroupCategory.focus();
    }, 150);
  }

  closeGroupModal() {
    if (this.groupModal) this.groupModal.classList.remove("is-active");
  }

  async executeGroup() {
    const category = this.inputGroupCategory ? this.inputGroupCategory.value.trim() : "";
    if (!category) {
      this.showToast("カテゴリ名を入力してください");
      return;
    }

    const selectedIds = Array.from(this.state.selectedNoteIds);
    try {
      await this.storage.updateNotesCategory(selectedIds, category);
      this.state.notes.forEach((note) => {
        if (selectedIds.includes(note.id)) {
          note.category = category;
          note.updated_at = new Date().toISOString();
        }
      });

      this.closeGroupModal();
      this.exitSelectMode();
      this.showToast(`🏷️ ${selectedIds.length} 件に「#${category}」を設定しました`);
      await this.updateSyncIndicator();
      this.syncPushQueue({ isManual: false });
    } catch (e) {
      console.error("Group error:", e);
      this.showToast("カテゴリの更新に失敗しました");
    }
  }

  // ===========================================================================
  // 🔗 相互リンク（全結合）
  // ===========================================================================
  async executeLink() {
    const selectedIds = Array.from(this.state.selectedNoteIds);
    if (selectedIds.length < 2) return;

    try {
      await this.storage.addMutualLinks(selectedIds);
      // メモリ上のリンク配列も更新
      selectedIds.forEach((currId) => {
        const note = this.state.notes.find((n) => n.id === currId);
        if (note) {
          const linksSet = new Set(note.links || []);
          selectedIds.forEach((otherId) => {
            if (otherId !== currId) linksSet.add(otherId);
          });
          note.links = Array.from(linksSet);
          note.updated_at = new Date().toISOString();
        }
      });

      this.exitSelectMode();
      this.showToast(`🔗 ${selectedIds.length} 件のメモを相互に結びました`);
      await this.updateSyncIndicator();
      this.syncPushQueue({ isManual: false });
    } catch (e) {
      console.error("Link error:", e);
      this.showToast("リンクの付与に失敗しました");
    }
  }

  // ===========================================================================
  // 📑 結合（Join：新メモ作成 ＆ 元メモアーカイブ）
  // ===========================================================================
  async executeJoin() {
    const selectedNotes = this.state.getSelectedNotes();
    if (selectedNotes.length < 2) return;

    // 作成日時または日付で昇順（古い順）にソート
    selectedNotes.sort((a, b) => {
      const timeA = Date.parse(a.created_at || a.date) || 0;
      const timeB = Date.parse(b.created_at || b.date) || 0;
      return timeA - timeB;
    });

    const selectedIds = selectedNotes.map((n) => n.id);
    const currentDateStr = formatCurrentDate();
    const currentIso = new Date().toISOString();

    // 本文結合
    const joinedSections = selectedNotes.map((n) => `### ${n.title}\n\n${n.content.trim()}`);
    const noteCount = selectedNotes.length;
    const joinedBody = joinedSections.join("\n\n---\n\n") + `\n\n*(※ ${noteCount} 件のメモを統合)*`;

    // リンクの集約（選択メモ自身以外）
    const mergedLinks = new Set();
    selectedNotes.forEach((n) => {
      (n.links || []).forEach((lId) => {
        if (!selectedIds.includes(lId)) mergedLinks.add(lId);
      });
    });

    const newNote = {
      id: generateNoteId(),
      title: `${selectedNotes[0].title} ほか (統合)`,
      category: selectedNotes[0].category || "統合",
      date: currentDateStr,
      created_at: currentIso,
      updated_at: currentIso,
      timeAgo: "最新",
      content: joinedBody,
      links: Array.from(mergedLinks),
      status: "active"
    };

    try {
      await this.storage.joinNotes(newNote, selectedIds);

      // メモリ上の配列からも元のメモを除外し、先頭に結合メモを追加
      this.state.notes = this.state.notes.filter((n) => !selectedIds.includes(n.id));
      this.state.notes.unshift(newNote);
      this.state.jumpTo(0);

      this.exitSelectMode();
      this.showToast(`📑 ${selectedIds.length} 件のメモを1つに結合しました`);
      await this.updateSyncIndicator();
      this.syncPushQueue({ isManual: false });
    } catch (e) {
      console.error("Join error:", e);
      this.showToast("メモの結合に失敗しました");
    }
  }

  // ===========================================================================
  // 📋 Markdownコピー（選択エクスポート）
  // ===========================================================================
  async executeExport() {
    const selectedNotes = this.state.getSelectedNotes();
    if (selectedNotes.length === 0) return;

    const mdChunks = selectedNotes.map((n) => {
      return `# ${n.title}\n*${n.date} #${n.category}*\n\n${n.content.trim()}`;
    });
    const fullMd = mdChunks.join("\n\n---\n\n");

    try {
      await navigator.clipboard.writeText(fullMd);
      this.showToast(`📋 ${selectedNotes.length} 件のメモをMarkdownでコピーしました`);
    } catch (err) {
      console.warn("Clipboard error, fallback to prompt:", err);
      prompt("以下のMarkdownをコピーしてください:", fullMd);
    }
  }

  // ===========================================================================
  // 🗑️ 手放す（アーカイブ） ＆ Undo
  // ===========================================================================
  async executeArchive() {
    const selectedIds = Array.from(this.state.selectedNoteIds);
    if (selectedIds.length === 0) return;

    this.lastArchivedNoteIds = [...selectedIds];

    try {
      // 1. IndexedDB上で status = 'archived' に更新
      await this.storage.archiveNotes(selectedIds);

      // 2. メモリ上の notes 配列から手放したメモを除外！
      this.state.notes = this.state.notes.filter((n) => !selectedIds.includes(n.id));

      // 3. インデックスを安全な範囲に調整
      if (this.state.currentIndex >= this.state.notes.length) {
        this.state.currentIndex = Math.max(0, this.state.notes.length - 1);
      }

      this.exitSelectMode();

      // 4. Undoトースト表示（元に戻すボタン付き）
      this.showToast(`🗑️ ${selectedIds.length} 件のメモを手放しました`, async () => {
        try {
          // IndexedDBで status = 'active' に復元
          await this.storage.restoreNotes(this.lastArchivedNoteIds);
          // 最新の未アーカイブメモ一覧を再取得
          const freshNotes = await this.storage.getAllNotes(false);
          this.state.notes = freshNotes;

          // 復元した最初のメモの位置にジャンプして目の前に戻す！
          if (this.lastArchivedNoteIds.length > 0) {
            const restoredIndex = this.state.notes.findIndex((n) => n.id === this.lastArchivedNoteIds[0]);
            if (restoredIndex !== -1) {
              this.state.jumpTo(restoredIndex);
            }
          }

          this.renderCards();
          this.updateStatus();
          await this.updateSyncIndicator();
          this.syncPushQueue({ isManual: false });
          this.showToast(`✨ ${this.lastArchivedNoteIds.length} 件のメモを元に戻しました`);
        } catch (err) {
          console.error("Undo restore error:", err);
          this.showToast("メモの復元に失敗しました");
        }
      });

      await this.updateSyncIndicator();
      this.syncPushQueue({ isManual: false });
    } catch (e) {
      console.error("Archive error:", e);
      this.showToast("メモのアーカイブに失敗しました");
    }
  }

  // ===========================================================================
  // 📱 PWA (Progressive Web App) 管理
  // ===========================================================================
  registerServiceWorker() {
    if ("serviceWorker" in navigator) {
      window.addEventListener("load", () => {
        navigator.serviceWorker
          .register("./sw.js")
          .then((registration) => {
            console.log("[PWA] ServiceWorker registered with scope:", registration.scope);

            // 更新が見つかった場合のハンドリング
            registration.addEventListener("updatefound", () => {
              const newWorker = registration.installing;
              if (newWorker) {
                newWorker.addEventListener("statechange", () => {
                  if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
                    console.log("[PWA] New update available");
                    this.showToast("✨ 新しいバージョンが利用可能です。再読み込みで更新されます。");
                  }
                });
              }
            });
          })
          .catch((error) => {
            console.warn("[PWA] ServiceWorker registration failed:", error);
          });
      });
    }

    // PWAインストールプロンプト（beforeinstallprompt）の捕捉
    window.addEventListener("beforeinstallprompt", (e) => {
      e.preventDefault();
      this.deferredInstallPrompt = e;
      console.log("[PWA] Install prompt captured");
      if (this.btnInstallPwa) {
        this.btnInstallPwa.style.display = "inline-flex";
      }
    });

    // インストール完了イベント
    window.addEventListener("appinstalled", () => {
      this.deferredInstallPrompt = null;
      console.log("[PWA] App successfully installed");
      this.showToast("🎉 Petasos がホーム画面/PCにインストールされました！");
      if (this.btnInstallPwa) {
        this.btnInstallPwa.style.display = "none";
      }
    });
  }

  async installPwa() {
    if (!this.deferredInstallPrompt) {
      this.showToast("📱 ブラウザの共有メニューまたはアドレスバーから「ホーム画面に追加」を選択してください");
      return;
    }

    this.deferredInstallPrompt.prompt();
    const { outcome } = await this.deferredInstallPrompt.userChoice;
    console.log(`[PWA] Install prompt outcome: ${outcome}`);
    if (outcome === "accepted") {
      this.showToast("🎉 Petasos のインストールを開始しました");
    }
    this.deferredInstallPrompt = null;
    if (this.btnInstallPwa) {
      this.btnInstallPwa.style.display = "none";
    }
  }
}



// アプリケーション起動
window.addEventListener("DOMContentLoaded", () => {
  window.app = new PhysicalCardDeckApp();
});
