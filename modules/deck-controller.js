/**
 * Petasos v2 - Deck Controller Module
 * 身体性を伴うカードデッキのレンダリング、スライディングウィンドウ、ジェスチャー、ワープ、デッキピッカー
 */

import { escapeHtml, formatRelativeTime, renderMarkdown } from "../utils.js";

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
    this.btnRocket = document.getElementById("btn-rocket-warp");
    this.rocketMenuPopover = document.getElementById("rocket-menu-popover");
    this.btnMenuWarp = document.getElementById("btn-menu-warp");
    this.btnMenuLatest = document.getElementById("btn-menu-latest");
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

    // 🌌 星のカルーセルシーク状態
    this.carouselOverlay = document.getElementById("link-carousel-overlay");
    this.carouselTrack = document.getElementById("carousel-track");
    this.isCarouselSeeking = false;
    this.carouselItems = [];
    this.carouselOriginIndex = 0;
    this.carouselActiveIndex = 0;
    this.carouselStartX = 0;
    this.carouselCardWidth = 290;
    this.carouselBaseOffset = 0;
    this.lastVibratedIndex = -1;
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

    // 🚀 ロケットボタン（タイムジャンプメニュー展開）
    if (this.btnRocket) {
      this.btnRocket.addEventListener("click", (e) => {
        e.stopPropagation();
        this.toggleRocketMenu();
      });
    }

    // ポップアップ内：ランダムワープ
    if (this.btnMenuWarp) {
      this.btnMenuWarp.addEventListener("click", (e) => {
        e.stopPropagation();
        this.closeRocketMenu();
        this.triggerRocketWarp();
      });
    }

    // ポップアップ内：最新へ戻る
    if (this.btnMenuLatest) {
      this.btnMenuLatest.addEventListener("click", (e) => {
        e.stopPropagation();
        this.closeRocketMenu();
        this.jumpToLatest();
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

    // 外側クリックでポップオーバーを閉じる
    document.addEventListener("pointerdown", (e) => {
      // デッキピッカー外側クリック
      if (this.deckPickerPopover && this.deckPickerPopover.style.display !== "none") {
        if (!this.deckPickerPopover.contains(e.target) && !this.deckStatus.contains(e.target)) {
          this.closeDeckPicker();
        }
      }
      // ロケットメニュー外側クリック
      if (this.rocketMenuPopover && this.rocketMenuPopover.style.display !== "none") {
        if (!this.rocketMenuPopover.contains(e.target) && !this.btnRocket.contains(e.target)) {
          this.closeRocketMenu();
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
  // 🚀 タイムジャンプ（ロケット）ポップオーバーメニュー制御
  // ---------------------------------------------------------------------------
  jumpToLatest() {
    if (this.isWarping) return;
    this.app.state.jumpTo(0);
    this.renderCards();
    this.updateStatus();
    if (this.centerCard) {
      this.centerCard.style.animation = "pulse-dot 0.4s ease-out";
    }
  }

  toggleRocketMenu() {
    if (!this.rocketMenuPopover) return;
    if (this.rocketMenuPopover.style.display === "none" || !this.rocketMenuPopover.style.display) {
      this.openRocketMenu();
    } else {
      this.closeRocketMenu();
    }
  }

  openRocketMenu() {
    if (!this.rocketMenuPopover) return;
    this.updateRocketMenuState();
    this.rocketMenuPopover.style.display = "flex";
    if (this.btnRocket) {
      this.btnRocket.classList.add("is-menu-open");
    }
  }

  closeRocketMenu() {
    if (this.rocketMenuPopover) {
      this.rocketMenuPopover.style.display = "none";
    }
    if (this.btnRocket) {
      this.btnRocket.classList.remove("is-menu-open");
    }
  }

  updateRocketMenuState() {
    if (this.btnMenuLatest) {
      const isLatest = this.app.state.currentIndex === 0;
      this.btnMenuLatest.disabled = isLatest;
      const desc = this.btnMenuLatest.querySelector(".rocket-menu-item-desc");
      if (desc) {
        desc.textContent = isLatest ? "現在表示中" : "時間の最前線へ";
      }
    }
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

    // 本文のMarkdown/チェックリスト/箇条書きのパース
    const bodyHTML = renderMarkdown(note.content, { interactive: false });

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
  // 関連メモをID降順（新しい順）で取得
  // ---------------------------------------------------------------------------
  getSortedLinkedNotes() {
    const linked = this.app.state.getLinkedNotes();
    if (!linked || linked.length === 0) return [];
    // IDが新しい順（例: note-004 > note-002）にソート
    return [...linked].sort((a, b) => {
      if (a.id && b.id) {
        return b.id.localeCompare(a.id, undefined, { numeric: true });
      }
      return 0;
    });
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

    // 3. 左右の関連カード（IDが新しい順に 右 ➔ 左 へ配置）
    const sortedLinked = this.getSortedLinkedNotes();
    if (sortedLinked.length >= 1) {
      this.rightCard = this.createCardElement(sortedLinked[0], "card-right");
      this.stage.appendChild(this.rightCard);
    } else {
      this.rightCard = null;
    }

    if (sortedLinked.length >= 2) {
      this.leftCard = this.createCardElement(sortedLinked[1], "card-left");
      this.stage.appendChild(this.leftCard);
    } else {
      this.leftCard = null;
    }

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
      this.updateRocketMenuState();
      return;
    }

    const currentNum = this.app.state.currentIndex + 1;
    if (this.indexBadge) this.indexBadge.textContent = `${currentNum} / ${total}`;

    const currentNote = this.app.state.getCurrentNote();
    if (this.timeBadge) {
      this.timeBadge.style.color = "";
      this.timeBadge.style.backgroundColor = "";

      const relTime = currentNote
        ? formatRelativeTime(currentNote.updated_at || currentNote.created_at || currentNote.date)
        : "";

      if (this.app.state.currentIndex === 0) {
        this.timeBadge.textContent = relTime ? `最新 (${relTime})` : "最新";
        this.timeBadge.className = "time-badge is-latest";
      } else {
        this.timeBadge.textContent = relTime || (currentNote ? currentNote.timeAgo : "") || "過去";
        this.timeBadge.className = "time-badge is-past";
      }
    }

    this.updateRocketMenuState();
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

    // 💡 長押し判定（400ms）：リンクされた星が存在する場合にカルーセルシークを発動
    const noteModal = document.getElementById("note-modal");
    const settingsModal = document.getElementById("settings-modal");
    const isModalActive = (noteModal && noteModal.classList.contains("is-active")) ||
      (settingsModal && settingsModal.classList.contains("is-active"));

    const centerCard = e.target.closest(".note-card.card-center");
    if (centerCard && !isModalActive && !this.app.state.isSelectMode) {
      const current = this.app.state.getCurrentNote();
      const hasLinks = current && current.links && current.links.length > 0;

      if (hasLinks) {
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
            try { navigator.vibrate(45); } catch (_) { }
          }
          // 🌌 星のカルーセルシークを開始！
          this.startLinkCarouselSeek(e.clientX);
        }, 400);
      }
    }

    if (this.centerCard) {
      this.centerCard.classList.add("is-dragging");
    }
    if (this.topCard) this.topCard.classList.add("is-dragging");
    if (this.bottomCard) this.bottomCard.classList.add("is-dragging");
    if (this.rightCard) this.rightCard.classList.add("is-dragging");
    if (this.leftCard) this.leftCard.classList.add("is-dragging");

    // 操作開始したらヒントをフェードアウト
    if (this.gestureHint) {
      this.gestureHint.style.opacity = "0";
    }
  }

  onPointerMove(e) {
    if (!this.isDragging) return;

    // 🌌 カルーセルシークモード中：横スクラブ処理へ直行
    if (this.isCarouselSeeking) {
      const dx = e.clientX - this.carouselStartX;
      this.updateLinkCarouselSeek(dx);
      return;
    }

    const dx = e.clientX - this.startX;
    const dy = e.clientY - this.startY;

    // 微小な移動（10px以内）を超えたら長押し判定をキャンセル（指の微小な震えを許容）
    if (this.longPressTimer && (Math.abs(dx) > 10 || Math.abs(dy) > 10)) {
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

      const baseY = window.innerWidth <= 600 ? 80 : 84;
      const baseOpacity = window.innerWidth <= 600 ? 0.5 : 0.55;

      // 上カード（引き下げ時）
      if (this.topCard && effectiveDy > 0) {
        const progress = Math.min(effectiveDy / 300, 1);
        const yPos = -baseY + progress * baseY;
        const scale = 0.92 + progress * 0.08;
        const opacity = baseOpacity + progress * (1 - baseOpacity);
        this.topCard.style.transform = `translate3d(0, ${yPos}%, 0) scale(${scale})`;
        this.topCard.style.opacity = opacity;
      }

      // 下カード（引き上げ時）
      if (this.bottomCard && effectiveDy < 0) {
        const progress = Math.min(Math.abs(effectiveDy) / 300, 1);
        const yPos = baseY - progress * baseY;
        const scale = 0.92 + progress * 0.08;
        const opacity = baseOpacity + progress * (1 - baseOpacity);
        this.bottomCard.style.transform = `translate3d(0, ${yPos}%, 0) scale(${scale})`;
        this.bottomCard.style.opacity = opacity;
      }

    } else if (this.dragAxis === "horizontal") {
      // 横スワイプ：関連メモへのスライド
      let effectiveDx = dx;
      if (!this.rightCard && dx < 0) {
        effectiveDx = dx * 0.2;
      }
      if (!this.leftCard && dx > 0) {
        effectiveDx = dx * 0.2;
      }
      this.currentDeltaX = effectiveDx;
      this.currentDeltaY = 0;

      if (this.centerCard) {
        this.centerCard.style.transform = `translate3d(${effectiveDx}px, 0, 0)`;
      }

      // 右のカード（左へスワイプ時：右から中央へ引き寄せ）
      if (this.rightCard && effectiveDx < 0) {
        const progress = Math.min(Math.abs(effectiveDx) / 300, 1);
        const xPos = 94 - progress * 94;
        this.rightCard.style.transform = `translate3d(${xPos}%, 0, 0) scale(${0.92 + progress * 0.08})`;
        this.rightCard.style.opacity = 0.6 + progress * 0.4;
      }

      // 左のカード（右へスワイプ時：左から中央へ引き寄せ）
      if (this.leftCard && effectiveDx > 0) {
        const progress = Math.min(effectiveDx / 300, 1);
        const xPos = -94 + progress * 94;
        this.leftCard.style.transform = `translate3d(${xPos}%, 0, 0) scale(${0.92 + progress * 0.08})`;
        this.leftCard.style.opacity = 0.6 + progress * 0.4;
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

    // 🌌 カルーセルシーク中の場合：指を離した瞬間に選択中の星へジャンプ確定
    if (this.isCarouselSeeking) {
      this.finishLinkCarouselSeek();
      return;
    }

    // 長押しが成立した直後はドラッグやタップを発火させない
    if (this.longPressFired) {
      this.longPressFired = false;
      this.resetCardTransforms();
      return;
    }

    // トランジション復活
    [this.centerCard, this.topCard, this.bottomCard, this.rightCard, this.leftCard].forEach(card => {
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
        // 左へスワイプ ➔ 右の関連メモへ
        this.triggerCardSwitch("right");
      } else if (this.currentDeltaX > threshold && this.leftCard) {
        // 右へスワイプ ➔ 左の関連メモへ
        this.triggerCardSwitch("left");
      } else {
        this.resetCardTransforms();
      }
    } else {
      this.resetCardTransforms();
    }
  }

  // ---------------------------------------------------------------------------
  // 🌌 星のカルーセルシーク（連想星巡りホールドモード）
  // ---------------------------------------------------------------------------
  startLinkCarouselSeek(clientX) {
    const current = this.app.state.getCurrentNote();
    if (!current || !current.links || current.links.length === 0) return;

    const sortedLinked = this.getSortedLinkedNotes();
    if (sortedLinked.length === 0) return;

    // 左右の配置を通常デッキと一致させる：
    // sortedLinked[0] は通常デッキの右カード（最新の星）
    // sortedLinked[1] は通常デッキの左カード（2番目の星）、sortedLinked[2..] はさらに左へ
    // 例: sortedLinked = [L0, L1, L2] の場合
    // leftItems = [L2, L1] (L1が現在のカードのすぐ左に来るよう古い順に配置)
    // rightItems = [L0] (L0が現在のカードのすぐ右に来る)
    const rightItems = sortedLinked.slice(0, 1);
    const leftItems = sortedLinked.slice(1).reverse();

    // 実際の枚数のみ（現在のカード＋リンクされたカード）の配列を構築
    this.carouselItems = [...leftItems, current, ...rightItems];
    this.carouselOriginIndex = leftItems.length; // 現在のカードのインデックス
    this.carouselActiveIndex = this.carouselOriginIndex;
    this.carouselStartX = clientX;
    this.isCarouselSeeking = true;
    this.lastVibratedIndex = this.carouselOriginIndex;

    // DOM要素の取得（未キャッシュ時対応）
    if (!this.carouselOverlay) this.carouselOverlay = document.getElementById("link-carousel-overlay");
    if (!this.carouselTrack) this.carouselTrack = document.getElementById("carousel-track");
    if (!this.carouselOverlay || !this.carouselTrack) return;

    // トラック内カードを生成
    this.renderCarouselTrackCards();

    // オーバーレイをアクティブ化
    this.carouselOverlay.style.display = "flex";
    requestAnimationFrame(() => {
      if (this.carouselOverlay) this.carouselOverlay.classList.add("is-active");
    });

    // デッキ中央カードを少し縮小＆透過して背景に沈める
    if (this.centerCard) {
      this.centerCard.style.transition = "transform 0.25s ease, opacity 0.25s ease";
      this.centerCard.style.transform = "scale(0.92)";
      this.centerCard.style.opacity = "0.2";
    }
    if (this.topCard) this.topCard.style.opacity = "0";
    if (this.bottomCard) this.bottomCard.style.opacity = "0";
    if (this.rightCard) this.rightCard.style.opacity = "0";
    if (this.leftCard) this.leftCard.style.opacity = "0";
  }

  renderCarouselTrackCards() {
    if (!this.carouselTrack) return;
    this.carouselTrack.innerHTML = "";

    const P = this.carouselCardWidth; // 290px
    const N = this.carouselItems.length;

    this.carouselItems.forEach((note, idx) => {
      const isOrigin = idx === this.carouselOriginIndex;
      const isSelected = isOrigin;

      const card = document.createElement("div");
      card.className = `carousel-card-item${isOrigin ? " is-origin" : ""}${isSelected ? " is-selected" : ""}`;
      card.dataset.index = idx;

      const bodyHTML = renderMarkdown(note.content, { interactive: false });
      const badgeLabel = isOrigin ? "📍 現在地（離すと戻る）" : "🔗 結ばれている星";

      let positionHint = "現在地";
      if (!isOrigin) {
        if (idx > this.carouselOriginIndex) {
          positionHint = "右の星（最新）";
        } else if (idx === this.carouselOriginIndex - 1) {
          positionHint = "左の星";
        } else {
          positionHint = `左の星 (${this.carouselOriginIndex - idx})`;
        }
      }

      card.innerHTML = `
        <div class="carousel-card-meta">
          <span class="carousel-card-badge">${badgeLabel}</span>
          <span>${note.date || ""}</span>
        </div>
        <h3 class="carousel-card-title">${escapeHtml(note.title)}</h3>
        <div class="carousel-card-body">${bodyHTML}</div>
        <div class="carousel-card-footer">
          <span>${note.category ? `#${escapeHtml(note.category)}` : "Inbox"}</span>
          <span>${positionHint}</span>
        </div>
      `;
      this.carouselTrack.appendChild(card);
    });

    // 初期オフセット：現在のカード（originIndex）の中心が画面中央（left: 50%）にピタリと来る位置
    this.carouselBaseOffset = -(this.carouselOriginIndex * P + P / 2);
    this.carouselTrack.style.transform = `translate3d(${this.carouselBaseOffset}px, -50%, 0)`;
  }

  updateLinkCarouselSeek(dx) {
    if (!this.isCarouselSeeking || !this.carouselTrack) return;

    const N = this.carouselItems.length;
    if (N === 0) return;

    const P = this.carouselCardWidth;

    // 端を超えたときの抵抗感（ラバーバンド）
    // 指を左へ動かす(dx < 0) ➔ 右端カード(N - 1)へ向かう
    // 指を右へ動かす(dx > 0) ➔ 左端カード(0)へ向かう
    const minDx = (this.carouselOriginIndex - (N - 1)) * P;
    const maxDx = this.carouselOriginIndex * P;

    let effectiveDx = dx;
    if (dx < minDx) {
      effectiveDx = minDx + (dx - minDx) * 0.25;
    } else if (dx > maxDx) {
      effectiveDx = maxDx + (dx - maxDx) * 0.25;
    }

    const currentOffset = this.carouselBaseOffset + effectiveDx;
    this.carouselTrack.style.transform = `translate3d(${currentOffset}px, -50%, 0)`;

    // 中心（「▼」の直下）にあるカードのインデックスを計算
    const calculatedIndex = Math.round(this.carouselOriginIndex - (effectiveDx / P));
    const activeIndex = Math.max(0, Math.min(N - 1, calculatedIndex));

    if (activeIndex !== this.carouselActiveIndex) {
      this.carouselActiveIndex = activeIndex;

      // 触覚フィードバック（カードが切り替わるたびにコツッと鳴らす）
      if (activeIndex !== this.lastVibratedIndex) {
        this.lastVibratedIndex = activeIndex;
        if (navigator.vibrate) {
          try { navigator.vibrate(15); } catch (_) { }
        }
      }

      // トラック内のカードの選択状態を更新
      const allCards = this.carouselTrack.querySelectorAll(".carousel-card-item");
      allCards.forEach((card) => {
        const idx = parseInt(card.dataset.index, 10);
        if (idx === activeIndex) {
          card.classList.add("is-selected");
        } else {
          card.classList.remove("is-selected");
        }
      });
    }
  }

  finishLinkCarouselSeek() {
    this.isCarouselSeeking = false;
    const targetItem = this.carouselItems[this.carouselActiveIndex];
    const isOrigin = this.carouselActiveIndex === this.carouselOriginIndex;

    // オーバーレイを閉じる
    if (this.carouselOverlay) {
      this.carouselOverlay.classList.remove("is-active");
      setTimeout(() => {
        if (!this.isCarouselSeeking) {
          this.carouselOverlay.style.display = "none";
          if (this.carouselTrack) this.carouselTrack.innerHTML = "";
        }
      }, 250);
    }

    // デッキ中央カードのリセット
    if (this.centerCard) {
      this.centerCard.style.transition = "";
      this.centerCard.style.transform = "";
      this.centerCard.style.opacity = "";
    }

    if (!isOrigin && targetItem) {
      // 別の星が選ばれた ➔ ワープ移動！
      this.app.state.jumpToNote(targetItem.id);
      this.renderCards();
      this.updateStatus();
      this.app.showToast(`🔗 「${targetItem.title}」へ移動しました`);
      if (navigator.vibrate) {
        try { navigator.vibrate([20, 50, 20]); } catch (_) { }
      }
    } else {
      // 原点のまま離された（キャンセル） ➔ そのままデッキを復元
      this.renderCards();
      this.updateStatus();
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
    if (this.leftCard) {
      this.leftCard.style.transform = "";
      this.leftCard.style.opacity = "";
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
    } else if (direction === "right" || direction === "left") {
      // 関連メモへジャンプ（別カテゴリのメモでも確実に追従）
      const current = this.app.state.getCurrentNote();
      if (current && current.links && current.links.length > 0) {
        const sortedLinked = this.getSortedLinkedNotes();
        const targetNote = direction === "right" ? sortedLinked[0] : sortedLinked[1];
        if (targetNote && !this.app.state.jumpToNote(targetNote.id)) {
          this.resetCardTransforms();
          return;
        }
      } else {
        this.resetCardTransforms();
        return;
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
