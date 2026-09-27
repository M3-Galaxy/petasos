/**
 * Petasos v2 - Selection & Batch Actions Module
 * 複数選択モード（整理モード）、カード選択状態管理、グループ変更、相互リンク、結合、アーカイブ
 */

import { escapeHtml, formatCurrentDate, generateNoteId } from "../utils.js";

export class SelectionManager {
  /**
   * @param {Object} app - PhysicalCardDeckApp インスタンス
   */
  constructor(app) {
    this.app = app;
    this.lastArchivedNoteIds = [];

    // DOM要素
    this.normalHeaderPill = document.getElementById("normal-header-pill");
    this.selectHeaderPill = document.getElementById("select-header-pill");
    this.selectCountNum = document.getElementById("select-count-num");
    this.selectAllLabel = document.getElementById("select-all-label");
    this.btnStartSelect = document.getElementById("btn-start-select");
    this.btnCancelSelect = document.getElementById("btn-cancel-select");
    this.btnToggleSelectAll = document.getElementById("btn-toggle-select-all");
    this.gridSelectedCountBadge = document.getElementById("grid-selected-count-badge");

    // アクションバーDOM
    this.selectActionBar = document.getElementById("select-action-bar");
    this.btnActionLink = document.getElementById("btn-action-link");
    this.btnActionGroup = document.getElementById("btn-action-group");
    this.btnActionJoin = document.getElementById("btn-action-join");
    this.btnActionExport = document.getElementById("btn-action-export");
    this.btnActionArchive = document.getElementById("btn-action-archive");
    this.btnToggleGrid = document.getElementById("btn-toggle-grid");

    // グループ化（カテゴリ設定）モーダルDOM
    this.groupModal = document.getElementById("group-modal");
    this.groupTargetCount = document.getElementById("group-target-count");
    this.inputGroupCategory = document.getElementById("input-group-category");
    this.existingCategoryChips = document.getElementById("existing-category-chips");
    this.btnCancelGroup = document.getElementById("btn-cancel-group");
    this.btnClearGroup = document.getElementById("btn-clear-group");
    this.btnApplyGroup = document.getElementById("btn-apply-group");

    // リンク管理（相互結び / リンク解除）モーダルDOM
    this.linkModal = document.getElementById("link-modal");
    this.linkTargetCount = document.getElementById("link-target-count");
    this.linkStatusBadge = document.getElementById("link-status-badge");
    this.btnCancelLinkModal = document.getElementById("btn-cancel-link-modal");
    this.btnCloseLinkModal = document.getElementById("btn-close-link-modal");
    this.btnUnlinkAction = document.getElementById("btn-unlink-action");
    this.btnApplyLinkAction = document.getElementById("btn-apply-link-action");
  }

  init() {
    this.bindEvents();
  }

  bindEvents() {
    // 選択モード開始
    if (this.btnStartSelect) {
      this.btnStartSelect.addEventListener("click", () => this.enterSelectMode());
    }

    // 選択モード解除
    if (this.btnCancelSelect) {
      this.btnCancelSelect.addEventListener("click", () => this.exitSelectMode());
    }

    // グリッド一覧切り替え
    if (this.btnToggleGrid) {
      this.btnToggleGrid.addEventListener("click", () => this.app.toggleGridView());
    }

    // 全選択/解除
    if (this.btnToggleSelectAll) {
      this.btnToggleSelectAll.addEventListener("click", () => this.toggleSelectAll());
    }

    // 一括アクションボタン
    if (this.btnActionLink) {
      this.btnActionLink.addEventListener("click", () => this.openLinkModal());
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

    // グループモーダル
    if (this.btnCancelGroup) {
      this.btnCancelGroup.addEventListener("click", () => this.closeGroupModal());
    }
    if (this.btnClearGroup) {
      this.btnClearGroup.addEventListener("click", () => this.executeClearGroup());
    }
    if (this.btnApplyGroup) {
      this.btnApplyGroup.addEventListener("click", () => this.executeGroup());
    }
    if (this.groupModal) {
      this.groupModal.addEventListener("click", (e) => {
        if (e.target === this.groupModal) {
          this.closeGroupModal();
        }
      });
    }

    // リンク管理モーダル
    if (this.btnCancelLinkModal) {
      this.btnCancelLinkModal.addEventListener("click", () => this.closeLinkModal());
    }
    if (this.btnCloseLinkModal) {
      this.btnCloseLinkModal.addEventListener("click", () => this.closeLinkModal());
    }
    if (this.btnUnlinkAction) {
      this.btnUnlinkAction.addEventListener("click", () => this.executeUnlink());
    }
    if (this.btnApplyLinkAction) {
      this.btnApplyLinkAction.addEventListener("click", () => this.executeLink());
    }
    if (this.linkModal) {
      this.linkModal.addEventListener("click", (e) => {
        if (e.target === this.linkModal) {
          this.closeLinkModal();
        }
      });
    }
  }

  // ---------------------------------------------------------------------------
  // 🏷️ 複数選択モード（整理モード）ロジック
  // ---------------------------------------------------------------------------
  enterSelectMode(initialNoteId = null) {
    this.app.state.enterSelectMode(initialNoteId);
    document.body.classList.add("is-select-mode");

    if (this.normalHeaderPill) this.normalHeaderPill.style.display = "none";
    if (this.selectHeaderPill) this.selectHeaderPill.style.display = "flex";
    if (this.selectActionBar) this.selectActionBar.classList.add("is-active");

    this.updateSelectUI();
    this.updateCardSelectionVisuals();
  }

  exitSelectMode() {
    this.app.state.exitSelectMode();
    document.body.classList.remove("is-select-mode");

    if (this.normalHeaderPill) this.normalHeaderPill.style.display = "flex";
    if (this.selectHeaderPill) this.selectHeaderPill.style.display = "none";
    if (this.selectActionBar) this.selectActionBar.classList.remove("is-active");

    if (this.app.grid) {
      this.app.grid.closeGridSheet();
    }
    this.closeGroupModal();
    this.closeLinkModal();
    this.updateCardSelectionVisuals();
    this.app.renderCards();
    this.app.updateStatus();
  }

  toggleNoteSelection(noteId) {
    this.app.state.toggleSelection(noteId);
    this.updateSelectUI();
    this.updateCardSelectionVisuals();
    if (this.app.state.isGridView && this.app.grid) {
      this.app.grid.renderGridTiles();
    }
  }

  // 選択中のメモと結ばれている未選択メモの判定
  isLinkedToSelection(noteId) {
    if (!this.app.state.isSelectMode) return false;
    if (this.app.state.selectedNoteIds.size === 0) return false;
    if (this.app.state.selectedNoteIds.has(noteId)) return false;

    for (const selId of this.app.state.selectedNoteIds) {
      const note = this.app.state.notes.find((n) => n.id === selId);
      if (note && note.links && note.links.includes(noteId)) {
        return true;
      }
    }
    return false;
  }

  updateCardSelectionVisuals() {
    const stage = document.getElementById("card-stage");
    if (stage) {
      const cards = stage.querySelectorAll(".note-card");
      cards.forEach((card) => {
        const id = card.dataset.id;
        const isSel = this.app.state.isSelected(id);
        const isLinked = this.isLinkedToSelection(id);

        if (isSel) {
          card.classList.add("is-selected");
        } else {
          card.classList.remove("is-selected");
        }

        if (isLinked) {
          card.classList.add("is-linked-target");
        } else {
          card.classList.remove("is-linked-target");
        }

        const hint = card.querySelector(".tap-hint");
        if (hint && card.classList.contains("card-center")) {
          hint.textContent = this.app.state.isSelectMode ? (isSel ? "✓ 選択中" : "タップで選択") : "タップで閲覧";
        }
      });
    }

    // グリッドシート表示中であれば、タイルのis-linked-targetも同期
    if (this.app.grid && this.app.grid.gridTilesStage) {
      const tiles = this.app.grid.gridTilesStage.querySelectorAll(".grid-tile");
      tiles.forEach((tile) => {
        const id = tile.dataset.id;
        const isSel = this.app.state.isSelected(id);
        const isLinked = this.isLinkedToSelection(id);

        if (isSel) {
          tile.classList.add("is-selected");
        } else {
          tile.classList.remove("is-selected");
        }

        if (isLinked) {
          tile.classList.add("is-linked-target");
        } else {
          tile.classList.remove("is-linked-target");
        }
      });
    }
  }

  toggleSelectAll() {
    const activeNotes = this.app.state.notes.filter((n) => n.status !== "archived");
    if (this.app.state.getSelectedCount() >= activeNotes.length && activeNotes.length > 0) {
      this.app.state.clearSelection();
    } else {
      this.app.state.selectAll();
    }
    this.updateSelectUI();
    this.updateCardSelectionVisuals();
    if (this.app.state.isGridView && this.app.grid) {
      this.app.grid.renderGridTiles();
    }
  }

  updateSelectUI() {
    const count = this.app.state.getSelectedCount();
    const activeNotes = this.app.state.notes.filter((n) => n.status !== "archived");

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

  // ---------------------------------------------------------------------------
  // 🏷️ グループ化（カテゴリ設定）モーダル
  // ---------------------------------------------------------------------------
  openGroupModal() {
    const count = this.app.state.getSelectedCount();
    if (count === 0) return;

    if (this.groupTargetCount) this.groupTargetCount.textContent = count;
    if (this.inputGroupCategory) this.inputGroupCategory.value = "";

    if (this.existingCategoryChips) {
      const cats = Array.from(new Set(this.app.state.notes.map((n) => n.category).filter(Boolean)));
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
    if (document.activeElement && typeof document.activeElement.blur === "function") {
      document.activeElement.blur();
    }
    if (this.groupModal) this.groupModal.classList.remove("is-active");
    window.scrollTo(0, 0);
    setTimeout(() => {
      window.scrollTo(0, 0);
    }, 350);
  }

  async executeGroup() {
    const category = this.inputGroupCategory ? this.inputGroupCategory.value.trim() : "";
    if (!category) {
      this.app.showToast("カテゴリ名を入力してください");
      return;
    }

    const selectedIds = Array.from(this.app.state.selectedNoteIds);
    try {
      await this.app.storage.updateNotesCategory(selectedIds, category);
      this.app.state.notes.forEach((note) => {
        if (selectedIds.includes(note.id)) {
          note.category = category;
          note.updated_at = new Date().toISOString();
        }
      });

      this.closeGroupModal();
      this.exitSelectMode();
      this.app.showToast(`🏷️ ${selectedIds.length} 件に「#${category}」を設定しました`);
      if (this.app.sync) {
        await this.app.sync.updateSyncIndicator();
        this.app.sync.syncPushQueue({ isManual: false });
      }
    } catch (e) {
      console.error("Group error:", e);
      this.app.showToast("カテゴリの更新に失敗しました");
    }
  }

  async executeClearGroup() {
    const selectedIds = Array.from(this.app.state.selectedNoteIds);
    if (selectedIds.length === 0) return;

    try {
      await this.app.storage.updateNotesCategory(selectedIds, "");
      this.app.state.notes.forEach((note) => {
        if (selectedIds.includes(note.id)) {
          note.category = "";
          note.updated_at = new Date().toISOString();
        }
      });

      this.closeGroupModal();
      this.exitSelectMode();
      this.app.showToast(`🏷️ ${selectedIds.length} 件のカテゴリを解除しました`);
      if (this.app.sync) {
        await this.app.sync.updateSyncIndicator();
        this.app.sync.syncPushQueue({ isManual: false });
      }
    } catch (e) {
      console.error("Clear group error:", e);
      this.app.showToast("カテゴリの解除に失敗しました");
    }
  }

  // ---------------------------------------------------------------------------
  // 🔗 リンク管理（相互結び / リンク解除）モーダル
  // ---------------------------------------------------------------------------
  openLinkModal() {
    const selectedIds = Array.from(this.app.state.selectedNoteIds);
    if (selectedIds.length < 2) return;

    if (this.linkTargetCount) this.linkTargetCount.textContent = selectedIds.length;

    // 選択されたメモ同士の間のリンク数を集計
    let linkedPairsCount = 0;
    for (let i = 0; i < selectedIds.length; i++) {
      const note = this.app.state.notes.find((n) => n.id === selectedIds[i]);
      if (note && note.links) {
        for (let j = i + 1; j < selectedIds.length; j++) {
          if (note.links.includes(selectedIds[j])) {
            linkedPairsCount++;
          }
        }
      }
    }

    if (this.linkStatusBadge) {
      if (linkedPairsCount > 0) {
        this.linkStatusBadge.className = "link-status-banner has-links";
        this.linkStatusBadge.innerHTML = `<span>🔗</span><span>選択中のメモ同士に <strong>${linkedPairsCount} 組の結びつき</strong> があります。「リンクを解除」で解くことができます。</span>`;
        if (this.btnUnlinkAction) this.btnUnlinkAction.disabled = false;
      } else {
        this.linkStatusBadge.className = "link-status-banner";
        this.linkStatusBadge.innerHTML = `<span>✨</span><span>選択中のメモ同士にはまだリンクがありません。「相互リンクを結ぶ」で新しく結びつけます。</span>`;
        if (this.btnUnlinkAction) this.btnUnlinkAction.disabled = true;
      }
    }

    if (this.linkModal) this.linkModal.classList.add("is-active");
  }

  closeLinkModal() {
    if (this.linkModal) this.linkModal.classList.remove("is-active");
  }

  async executeLink() {
    const selectedIds = Array.from(this.app.state.selectedNoteIds);
    if (selectedIds.length < 2) return;

    try {
      await this.app.storage.addMutualLinks(selectedIds);
      selectedIds.forEach((currId) => {
        const note = this.app.state.notes.find((n) => n.id === currId);
        if (note) {
          const linksSet = new Set(note.links || []);
          selectedIds.forEach((otherId) => {
            if (otherId !== currId) linksSet.add(otherId);
          });
          note.links = Array.from(linksSet);
          note.updated_at = new Date().toISOString();
        }
      });

      this.closeLinkModal();
      this.exitSelectMode();
      this.app.showToast(`🔗 ${selectedIds.length} 件のメモを相互に結びました`);
      if (this.app.sync) {
        await this.app.sync.updateSyncIndicator();
        this.app.sync.syncPushQueue({ isManual: false });
      }
    } catch (e) {
      console.error("Link error:", e);
      this.app.showToast("リンクの付与に失敗しました");
    }
  }

  async executeUnlink() {
    const selectedIds = Array.from(this.app.state.selectedNoteIds);
    if (selectedIds.length < 2) return;

    try {
      await this.app.storage.removeMutualLinks(selectedIds);
      selectedIds.forEach((currId) => {
        const note = this.app.state.notes.find((n) => n.id === currId);
        if (note) {
          note.links = (note.links || []).filter((id) => !selectedIds.includes(id));
          note.updated_at = new Date().toISOString();
        }
      });

      this.closeLinkModal();
      this.exitSelectMode();
      this.app.showToast(`🔗 ${selectedIds.length} 件のメモ間のリンクを解除しました`);
      if (this.app.sync) {
        await this.app.sync.updateSyncIndicator();
        this.app.sync.syncPushQueue({ isManual: false });
      }
    } catch (e) {
      console.error("Unlink error:", e);
      this.app.showToast("リンクの解除に失敗しました");
    }
  }

  // ---------------------------------------------------------------------------
  // 📑 結合（Join：新メモ作成 ＆ 元メモアーカイブ）
  // ---------------------------------------------------------------------------
  async executeJoin() {
    const selectedNotes = this.app.state.getSelectedNotes();
    if (selectedNotes.length < 2) return;

    selectedNotes.sort((a, b) => {
      const timeA = Date.parse(a.created_at || a.date) || 0;
      const timeB = Date.parse(b.created_at || b.date) || 0;
      return timeA - timeB;
    });

    const selectedIds = selectedNotes.map((n) => n.id);
    const currentDateStr = formatCurrentDate();
    const currentIso = new Date().toISOString();

    const joinedSections = selectedNotes.map((n) => `### ${n.title}\n\n${n.content.trim()}`);
    const noteCount = selectedNotes.length;
    const joinedBody = joinedSections.join("\n\n---\n\n") + `\n\n*(※ ${noteCount} 件のメモを統合)*`;

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
      await this.app.storage.joinNotes(newNote, selectedIds);

      this.app.state.notes = this.app.state.notes.filter((n) => !selectedIds.includes(n.id));
      this.app.state.notes.unshift(newNote);
      this.app.state.jumpTo(0);

      this.exitSelectMode();
      this.app.showToast(`📑 ${selectedIds.length} 件のメモを1つに結合しました`);
      if (this.app.sync) {
        await this.app.sync.updateSyncIndicator();
        this.app.sync.syncPushQueue({ isManual: false });
      }
    } catch (e) {
      console.error("Join error:", e);
      this.app.showToast("メモの結合に失敗しました");
    }
  }

  // ---------------------------------------------------------------------------
  // 📋 Markdownコピー（選択エクスポート）
  // ---------------------------------------------------------------------------
  async executeExport() {
    const selectedNotes = this.app.state.getSelectedNotes();
    if (selectedNotes.length === 0) return;

    const mdChunks = selectedNotes.map((n) => {
      return `# ${n.title}\n*${n.date} #${n.category}*\n\n${n.content.trim()}`;
    });
    const fullMd = mdChunks.join("\n\n---\n\n");

    try {
      await navigator.clipboard.writeText(fullMd);
      this.app.showToast(`📋 ${selectedNotes.length} 件のメモをMarkdownでコピーしました`);
    } catch (err) {
      console.warn("Clipboard error, fallback to prompt:", err);
      prompt("以下のMarkdownをコピーしてください:", fullMd);
    }
  }

  // ---------------------------------------------------------------------------
  // 🗑️ 手放す（アーカイブ） ＆ Undo
  // ---------------------------------------------------------------------------
  async executeArchive() {
    const selectedIds = Array.from(this.app.state.selectedNoteIds);
    if (selectedIds.length === 0) return;

    this.lastArchivedNoteIds = [...selectedIds];

    try {
      await this.app.storage.archiveNotes(selectedIds);
      this.app.state.notes = this.app.state.notes.filter((n) => !selectedIds.includes(n.id));

      if (this.app.state.currentIndex >= this.app.state.notes.length) {
        this.app.state.currentIndex = Math.max(0, this.app.state.notes.length - 1);
      }

      this.exitSelectMode();

      this.app.showToast(`🗑️ ${selectedIds.length} 件のメモを手放しました`, async () => {
        try {
          await this.app.storage.restoreNotes(this.lastArchivedNoteIds);
          const freshNotes = await this.app.storage.getAllNotes(false);
          this.app.state.notes = freshNotes;

          if (this.lastArchivedNoteIds.length > 0) {
            this.app.state.jumpToNote(this.lastArchivedNoteIds[0]);
          }

          this.app.renderCards();
          this.app.updateStatus();
          if (this.app.sync) {
            await this.app.sync.updateSyncIndicator();
            this.app.sync.syncPushQueue({ isManual: false });
          }
          this.app.showToast(`✨ ${this.lastArchivedNoteIds.length} 件のメモを元に戻しました`);
        } catch (err) {
          console.error("Undo restore error:", err);
          this.app.showToast("メモの復元に失敗しました");
        }
      });

      if (this.app.sync) {
        await this.app.sync.updateSyncIndicator();
        this.app.sync.syncPushQueue({ isManual: false });
      }
    } catch (e) {
      console.error("Archive error:", e);
      this.app.showToast("メモのアーカイブに失敗しました");
    }
  }
}
