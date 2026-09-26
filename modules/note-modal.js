/**
 * Petasos v2 - Note Modal Module
 * ノート詳細モーダル（閲覧モード ⟷ 編集モード、Markdown/ToDo変換、コミット）
 */

import { escapeHtml, formatCurrentDate } from "../utils.js";

export class NoteModal {
  /**
   * @param {Object} app - PhysicalCardDeckApp インスタンス
   */
  constructor(app) {
    this.app = app;
    this.editorMode = "create"; // 'create' | 'edit'

    // DOM要素
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
  }

  init() {
    this.bindEvents();
  }

  bindEvents() {
    // 📖 モーダル内アクション
    if (this.btnCloseModal) {
      this.btnCloseModal.addEventListener("click", () => this.closeModal());
    }
    if (this.btnSwitchToEdit) {
      this.btnSwitchToEdit.addEventListener("click", () => this.switchToEdit());
    }
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
          if (this.editorMode === "edit" || this.editorMode === "create") {
            // 編集中の誤タップ防止：確認なしで閉じず、キャンセルボタン等に委ねる（またはそのまま閉じる）
            this.closeModal();
          } else {
            this.closeModal();
          }
        }
      });
    }

    // 閲覧パネル内のインタラクティブ操作（ToDoトグル & リンク遷移）
    if (this.viewContent) {
      this.viewContent.addEventListener("click", (e) => {
        const todoItem = e.target.closest(".todo-item");
        if (todoItem) {
          const lineIdx = parseInt(todoItem.dataset.lineIndex, 10);
          if (!isNaN(lineIdx)) {
            this.toggleTodoItem(lineIdx);
          }
        }
      });
    }

    if (this.viewLinksChips) {
      this.viewLinksChips.addEventListener("click", (e) => {
        const chip = e.target.closest(".link-chip");
        if (chip && chip.dataset.targetId) {
          const targetId = chip.dataset.targetId;
          const targetIdx = this.app.state.notes.findIndex((n) => n.id === targetId);
          if (targetIdx !== -1) {
            this.app.state.jumpTo(targetIdx);
            this.app.renderCards();
            this.app.updateStatus();
            this.openReader();
          }
        }
      });
    }

    if (this.editLinksChips) {
      this.editLinksChips.addEventListener("click", (e) => {
        const removeBtn = e.target.closest(".btn-remove-link");
        if (removeBtn && removeBtn.dataset.targetId) {
          e.stopPropagation();
          this.removeLink(removeBtn.dataset.targetId);
        }
      });
    }
  }

  // ---------------------------------------------------------------------------
  // 📖 閲覧モード（安全地帯 ＆ 全文スクロール読書）
  // ---------------------------------------------------------------------------
  openReader() {
    const note = this.app.state.getCurrentNote();
    if (!note) return;

    this.editorMode = "view";

    // ヘッダーアクションを「閲覧用」に切り替え
    if (this.headerViewActions) this.headerViewActions.style.display = "flex";
    if (this.headerEditActions) this.headerEditActions.style.display = "none";

    // パネルを「閲覧用」に切り替え
    if (this.viewPanel) this.viewPanel.style.display = "flex";
    if (this.editPanel) this.editPanel.style.display = "none";

    // データのバインド
    if (this.viewTitle) this.viewTitle.textContent = note.title;
    const catLabel = note.category ? `#${escapeHtml(note.category)}` : "Inbox";
    if (this.viewCategoryBadge) {
      this.viewCategoryBadge.innerHTML = `<span class="tag-dot"></span> ${catLabel}`;
    }
    if (this.viewDateDisplay) this.viewDateDisplay.textContent = note.date;

    // 本文のMarkdown/チェックリスト変換
    const lines = (note.content || "").split("\n");
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

    if (this.viewContent) this.viewContent.innerHTML = bodyHTML;

    // リンク先メモの表示
    const linked = this.app.state.getLinkedNotes();
    if (this.viewLinksSection && this.viewLinksChips) {
      if (linked.length > 0) {
        this.viewLinksSection.style.display = "block";
        this.viewLinksChips.innerHTML = linked.map(l => 
          `<span class="link-chip" data-target-id="${l.id}" style="cursor: pointer;">🔗 ${escapeHtml(l.title)}</span>`
        ).join("");
      } else {
        this.viewLinksSection.style.display = "none";
      }
    }

    if (this.noteModal) this.noteModal.classList.add("is-active");
  }

  // 閲覧モード内でのインタラクティブなチェックリスト反転
  async toggleTodoItem(lineIndex) {
    const note = this.app.state.getCurrentNote();
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
      await this.app.storage.saveNote(note, "update");
      if (this.app.sync) {
        await this.app.sync.updateSyncIndicator();
        this.app.sync.syncPushQueue({ isManual: false });
      }
    } catch (e) {
      console.warn("Storage save error:", e);
    }

    this.openReader();
    this.app.renderCards();
  }

  // ---------------------------------------------------------------------------
  // 📝 編集モードへの切り替え ＆ 新規作成
  // ---------------------------------------------------------------------------
  switchToEdit() {
    this.editorMode = "edit";
    const note = this.app.state.getCurrentNote();
    if (!note) return;

    // フォームに値を流し込む
    if (this.editTitle) this.editTitle.value = note.title;
    if (this.editCategory) this.editCategory.value = note.category || "";
    if (this.editContent) this.editContent.value = note.content;
    if (this.editDateDisplay) this.editDateDisplay.textContent = note.date;
    if (this.modalEditBadge) this.modalEditBadge.textContent = "編集モード";

    this.renderEditLinksChips();

    if (this.headerViewActions) this.headerViewActions.style.display = "none";
    if (this.headerEditActions) this.headerEditActions.style.display = "flex";
    if (this.viewPanel) this.viewPanel.style.display = "none";
    if (this.editPanel) this.editPanel.style.display = "flex";

    setTimeout(() => {
      if (this.editContent) this.editContent.focus();
    }, 150);
  }

  // 編集モードでのリンクチップ描画
  renderEditLinksChips() {
    const linked = this.app.state.getLinkedNotes();
    if (this.editLinksSection && this.editLinksChips) {
      if (linked.length > 0) {
        this.editLinksSection.style.display = "block";
        this.editLinksChips.innerHTML = linked.map(l => 
          `<span class="link-chip is-editable" data-target-id="${l.id}">
            <span>🔗 ${escapeHtml(l.title)}</span>
            <button type="button" class="btn-remove-link" data-target-id="${l.id}" title="「${escapeHtml(l.title)}」とのリンクを解除">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </span>`
        ).join("");
      } else {
        this.editLinksSection.style.display = "none";
      }
    }
  }

  // 個別リンクの相互解除
  async removeLink(targetId) {
    const currentNote = this.app.state.getCurrentNote();
    if (!currentNote || !targetId) return;

    try {
      await this.app.storage.removeMutualLink(currentNote.id, targetId);

      // state（メモリ上のキャッシュ）を即時更新
      currentNote.links = (currentNote.links || []).filter((id) => id !== targetId);
      currentNote.updated_at = new Date().toISOString();

      const targetNote = this.app.state.notes.find((n) => n.id === targetId);
      if (targetNote) {
        targetNote.links = (targetNote.links || []).filter((id) => id !== currentNote.id);
        targetNote.updated_at = new Date().toISOString();
      }

      this.renderEditLinksChips();
      this.app.renderCards();
      this.app.showToast("🔗 リンクを解除しました");

      if (this.app.sync) {
        await this.app.sync.updateSyncIndicator();
        this.app.sync.syncPushQueue({ isManual: false });
      }
    } catch (e) {
      console.error("Remove link error:", e);
      this.app.showToast("リンクの解除に失敗しました");
    }
  }

  openEditor(mode = "create") {
    this.editorMode = mode;

    if (this.editTitle) this.editTitle.value = "";
    if (this.editCategory) this.editCategory.value = "";
    if (this.editContent) this.editContent.value = "";
    if (this.editDateDisplay) this.editDateDisplay.textContent = formatCurrentDate();
    if (this.modalEditBadge) this.modalEditBadge.textContent = "新規メモ";
    if (this.editLinksSection) this.editLinksSection.style.display = "none";

    if (this.headerViewActions) this.headerViewActions.style.display = "none";
    if (this.headerEditActions) this.headerEditActions.style.display = "flex";
    if (this.viewPanel) this.viewPanel.style.display = "none";
    if (this.editPanel) this.editPanel.style.display = "flex";

    if (this.noteModal) this.noteModal.classList.add("is-active");

    setTimeout(() => {
      if (this.editTitle) this.editTitle.focus();
    }, 200);
  }

  cancelEdit() {
    if (this.editorMode === "create") {
      this.closeModal();
    } else {
      this.openReader();
    }
  }

  async commitEditor() {
    const titleVal = this.editTitle ? this.editTitle.value.trim() : "";
    const categoryVal = this.editCategory ? this.editCategory.value.trim() : "";
    const contentVal = this.editContent ? this.editContent.value.trim() : "";

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
      const note = this.app.state.getCurrentNote();
      if (note) {
        const oldCategory = (note.category || "").trim();
        const newCategory = categoryVal.trim();

        note.title = finalTitle;
        note.category = newCategory;
        note.content = contentVal;
        note.date = currentDateStr;
        note.updated_at = currentIso;
        note.timeAgo = "たった今更新";

        try {
          await this.app.storage.saveNote(note, "update");
        } catch (e) {
          console.warn("Storage save error:", e);
        }

        if (oldCategory !== newCategory && newCategory) {
          this.app.showToast(`🏷️ 「#${newCategory}」デッキへ移動しました`);
        } else if (oldCategory && !newCategory) {
          this.app.showToast("📥 「Inbox」デッキへ移動しました");
        } else {
          this.app.showToast("コミット完了 - メモを更新しました");
        }
      }
      this.app.renderCards();
      this.app.updateStatus();
      if (this.app.sync) {
        await this.app.sync.updateSyncIndicator();
        this.app.sync.syncPushQueue({ isManual: false });
      }
      this.openReader();
    } else {
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

      this.app.state.notes.unshift(newNote);
      this.app.state.currentIndex = 0;

      try {
        await this.app.storage.saveNote(newNote, "create");
      } catch (e) {
        console.warn("Storage save error:", e);
      }

      if (newNote.category) {
        this.app.showToast(`✨ 「#${newNote.category}」デッキに放り込みました`);
      } else {
        this.app.showToast("✨ 新しい思考をInboxのポケットに放り込みました");
      }
      this.app.renderCards();
      this.app.updateStatus();
      if (this.app.sync) {
        await this.app.sync.updateSyncIndicator();
        this.app.sync.syncPushQueue({ isManual: false });
      }
      this.openReader();
    }

    if (this.app.centerCard) {
      this.app.centerCard.style.animation = "pulse-dot 0.6s ease-out";
    }
  }

  closeModal() {
    if (this.noteModal) this.noteModal.classList.remove("is-active");
  }
}
