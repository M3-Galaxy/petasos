/**
 * Petasos v2 - Grid View Module
 * 思考のカード一覧シート（案1-C ハイブリッド俯瞰シート）
 */

import { escapeHtml } from "../utils.js";

export class GridView {
  /**
   * @param {Object} app - PhysicalCardDeckApp インスタンス
   */
  constructor(app) {
    this.app = app;

    // DOM要素
    this.gridViewSheet = document.getElementById("grid-view-sheet");
    this.gridTilesStage = document.getElementById("grid-tiles-stage");
    this.gridToggleText = document.getElementById("grid-toggle-text");
    this.btnCloseGridSheet = document.getElementById("btn-close-grid-sheet");
  }

  init() {
    this.bindEvents();
  }

  bindEvents() {
    if (this.btnCloseGridSheet) {
      this.btnCloseGridSheet.addEventListener("click", () => this.closeGridSheet());
    }

    // シート背景クリックで閉じる
    if (this.gridViewSheet) {
      this.gridViewSheet.addEventListener("click", (e) => {
        if (e.target === this.gridViewSheet) {
          this.closeGridSheet();
        }
      });
    }
  }

  openGridSheet() {
    this.app.state.isGridView = true;
    if (this.gridViewSheet) this.gridViewSheet.classList.add("is-active");
    if (this.gridToggleText) this.gridToggleText.textContent = "デッキ";
    this.renderGridTiles();
  }

  closeGridSheet() {
    this.app.state.isGridView = false;
    if (this.gridViewSheet) this.gridViewSheet.classList.remove("is-active");
    if (this.gridToggleText) this.gridToggleText.textContent = "一覧";
  }

  toggleGridView() {
    if (this.app.state.isGridView) {
      this.closeGridSheet();
    } else {
      this.openGridSheet();
    }
  }

  renderGridTiles() {
    if (!this.gridTilesStage) return;
    this.gridTilesStage.innerHTML = "";

    const activeNotes = this.app.state.notes.filter((n) => n.status !== "archived");
    activeNotes.forEach((note) => {
      const isSel = this.app.state.isSelected(note.id);
      const tile = document.createElement("div");
      tile.className = `grid-tile${isSel ? " is-selected" : ""}`;
      tile.dataset.id = note.id;

      const snippet = escapeHtml(note.content.slice(0, 110));
      const hasLinks = note.links && note.links.length > 0;

      tile.innerHTML = `
        <div class="tile-header">
          <span class="tile-tag">#${escapeHtml(note.category || "Inbox")}</span>
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
        if (this.app.selection) {
          this.app.selection.toggleNoteSelection(note.id);
        } else {
          this.app.toggleNoteSelection(note.id);
        }
      });

      this.gridTilesStage.appendChild(tile);
    });
  }
}
