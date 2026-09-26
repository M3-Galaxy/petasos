/**
 * Petasos v2 - Deck Controller Module
 * 身体性を伴うカードデッキのレンダリング、スライディングウィンドウ、ジェスチャー、ワープ、デッキピッカー
 */

import { escapeHtml } from "../utils.js";

export class DeckController {
  /**
   * @param {Object} app - PhysicalCardDeckApp インスタンス
   */
  constructor(app) {
    this.app = app;

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

    // カード参照（DOM要素）
    this.centerCard = null;
    this.topCard = null;
    this.bottomCard = null;
    this.rightCard = null;
    this.leftCard = null;

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
  }

  init() {
    this.bindEvents();
  }

  bindEvents() {
    // ポインターイベント（マウス・タッチ共通）
    if (this.viewport) {
      this.viewport.addEventListener("pointerdown", (e) => this.onPointerDown(e));
    }
    window.addEventListener("pointermove", (e) => this.onPointerMove(e));
    window.addEventListener("pointerup", (e) => this.onPointerUp(e));
    window.addEventListener("pointercancel", (e) => this.onPointerUp(e));

    // マウスホイール（上下めくり）
    let wheelTimeout = null;
    if (this.viewport) {
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
    }

    // 🚀 ロケットボタン（ワープ発掘）
    if (this.btnRocket) {
      this.btnRocket.addEventListener("click", () => this.triggerRocketWarp());
    }

    // 最新に戻るボタン
    if (this.btnReturnLatest) {
      this.btnReturnLatest.addEventListener("click", () => {
        if (this.isWarping) return;
        this.app.state.jumpTo(0);
        this.renderCards();
        this.updateStatus();
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

    const counts = this.app.state.getDeckCategoriesWithCounts();
    const currentActive = this.app.state.activeDeck;

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
    this.app.state.setDeck(deckId);
    this.closeDeckPicker();
    this.renderCards();
    this.updateStatus();
  }

  // ---------------------------------------------------------------------------
  // カードのHTML生成
  // ---------------------------------------------------------------------------
  createCardElement(note, positionClass) {
    const card = document.createElement("div");
    const isSelected = this.app.state.isSelected(note.id);
    const isLinkedTarget = this.app.selection && this.app.selection.isLinkedToSelection ? this.app.selection.isLinkedToSelection(note.id) : false;
    card.className = `note-card ${positionClass}${isSelected ? " is-selected" : ""}${isLinkedTarget ? " is-linked-target" : ""}`;
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
      hintText = this.app.state.isSelectMode ? (isSelected ? "✓ 選択中" : "タップで選択") : "タップで閲覧";
    }

    card.innerHTML = `
      <!-- 選択中のメモと結ばれている星のバッジ -->
      <div class="card-linked-badge" title="選択中のメモと結ばれています">🔗</div>

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
    if (!this.stage) return;
    this.stage.innerHTML = "";

    const filtered = this.app.state.getFilteredNotes();

    // メモが0件の場合の空状態カード表示
    if (filtered.length === 0) {
      const emptyCard = document.createElement("div");
      emptyCard.className = "note-card card-center is-empty-state";

      let icon = "🌌";
      let title = "思考のポケットは空っぽです";
      let desc = "上部の <strong>＋</strong> ボタンから新しい思考を書き留めましょう。";

      if (this.app.state.activeDeck === "inbox") {
        icon = "📥";
        title = "Inboxは空です。";
        desc = "思考のポケットは静かに整っています。<br>上部の <strong>＋</strong> ボタンから、いつでも新しい思考をポケットに放り込みましょう。";
      } else if (this.app.state.activeDeck !== "all") {
        icon = "🏷️";
        title = `#${escapeHtml(this.app.state.activeDeck)} のメモはありません`;
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

    const current = this.app.state.getCurrentNote();
    const top = this.app.state.getTopNote();
    const bottom = this.app.state.getBottomNote();
    const linked = this.app.state.getLinkedNotes();

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
    const filtered = this.app.state.getFilteredNotes();
    const total = filtered.length;

    // デッキ名バッジの更新
    if (this.deckNameBadge) {
      if (this.app.state.activeDeck === "inbox") {
        this.deckNameBadge.textContent = "Inbox";
      } else if (this.app.state.activeDeck === "all") {
        this.deckNameBadge.textContent = "すべて";
      } else {
        this.deckNameBadge.textContent = `#${this.app.state.activeDeck}`;
      }
    }

    if (total === 0) {
      if (this.indexBadge) this.indexBadge.textContent = "0 / 0";
      if (this.timeBadge) {
        this.timeBadge.textContent = "空っぽ";
        this.timeBadge.className = "time-badge is-latest";
      }
      if (this.btnReturnLatest) {
        this.btnReturnLatest.style.opacity = "0";
        this.btnReturnLatest.style.pointerEvents = "none";
      }
      return;
    }

    const currentNum = this.app.state.currentIndex + 1;
    if (this.indexBadge) this.indexBadge.textContent = `${currentNum} / ${total}`;

    const currentNote = this.app.state.getCurrentNote();
    if (this.timeBadge) {
      this.timeBadge.style.color = "";
      this.timeBadge.style.backgroundColor = "";

      if (this.app.state.currentIndex === 0) {
        this.timeBadge.textContent = "最新";
        this.timeBadge.className = "time-badge is-latest";
        if (this.btnReturnLatest) {
          this.btnReturnLatest.style.opacity = "0";
          this.btnReturnLatest.style.pointerEvents = "none";
        }
      } else {
        this.timeBadge.textContent = currentNote ? currentNote.timeAgo : "";
        this.timeBadge.className = "time-badge is-past";
        if (this.btnReturnLatest) {
          this.btnReturnLatest.style.opacity = "1";
          this.btnReturnLatest.style.pointerEvents = "auto";
        }
      }
    }
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
        if (!this.app.state.isSelectMode) {
          this.app.enterSelectMode(card.dataset.id);
        } else {
          this.app.toggleNoteSelection(card.dataset.id);
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
    const noteModal = document.getElementById("note-modal");
    const settingsModal = document.getElementById("settings-modal");
    const isModalActive = (noteModal && noteModal.classList.contains("is-active")) ||
      (settingsModal && settingsModal.classList.contains("is-active"));

    const centerCard = e.target.closest(".note-card.card-center");
    if (centerCard && !isModalActive) {
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
          try { navigator.vibrate(40); } catch (_) { }
        }
        const noteId = centerCard.dataset.id;
        if (!this.app.state.isSelectMode) {
          this.app.enterSelectMode(noteId);
        } else {
          this.app.toggleNoteSelection(noteId);
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
        if (this.app.state.isSelectMode) {
          // 選択モード中はカードタップで選択トグル！
          this.app.toggleNoteSelection(centerTarget.dataset.id);
        } else {
          // 通常時は閲覧モードを開く（安全地帯）
          this.app.openReader();
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
      if (!this.app.state.moveDown()) {
        this.resetCardTransforms();
        return;
      }
    } else if (direction === "up") {
      // 未来へ
      if (!this.app.state.moveUp()) {
        this.resetCardTransforms();
        return;
      }
    } else if (direction === "right") {
      // 関連メモへジャンプ
      const current = this.app.state.getCurrentNote();
      if (current && current.links && current.links.length > 0) {
        const targetId = current.links[0];
        const targetIndex = this.app.state.notes.findIndex(n => n.id === targetId);
        if (targetIndex !== -1) {
          this.app.state.jumpTo(targetIndex);
        }
      }
    }

    // 新しい状態のカードを再描画
    this.renderCards();
    this.updateStatus();
  }

  // ---------------------------------------------------------------------------
  // 🚀 ロケットボタン（思考の全宇宙を巡るランダム発掘ワープ演出）
  // ---------------------------------------------------------------------------
  triggerRocketWarp() {
    if (this.isWarping) return;

    // ワープ対象は境界を越えた全宇宙（全アクティブメモ）
    const allNotes = this.app.state.notes.filter(n => n.status !== "archived");
    if (allNotes.length <= 1) {
      this.app.showToast("🚀 ワープできるメモがまだ十分にありません");
      return;
    }

    this.isWarping = true;

    // どの束にいても「すべて」の大地へ自動で持ち替えて大ジャンプ
    this.app.state.setDeck("all");

    const total = allNotes.length;
    let targetIndex = Math.floor(Math.random() * total);
    if (targetIndex === this.app.state.currentIndex && total > 1) {
      targetIndex = (targetIndex + 1) % total;
    }

    // ロケットボタンの回転＆加速モーション
    if (this.btnRocket) {
      this.btnRocket.style.transform = "scale(1.2) rotate(-45deg)";
    }

    // ワープ演出オーバーレイON
    if (this.warpOverlay) {
      this.warpOverlay.classList.add("is-active");
    }

    // カードがシュババッと高速でめくられる演出
    let shuffleCount = 0;
    const shuffleInterval = setInterval(() => {
      const tempRandom = Math.floor(Math.random() * total);
      this.app.state.currentIndex = tempRandom;
      this.renderCards();
      shuffleCount++;

      if (shuffleCount >= 5) {
        clearInterval(shuffleInterval);

        // 最終目的地に着地
        setTimeout(() => {
          this.app.state.jumpTo(targetIndex);
          this.renderCards();
          this.updateStatus();

          if (this.warpOverlay) {
            this.warpOverlay.classList.remove("is-active");
          }
          if (this.btnRocket) {
            this.btnRocket.style.transform = "";
          }
          this.isWarping = false;

          // 着地カードの微かなバウンス演出
          if (this.centerCard) {
            this.centerCard.style.animation = "pulse-dot 0.5s ease-out";
          }
        }, 180);
      }
    }, 80);
  }
}
