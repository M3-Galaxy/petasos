/**
 * Petasos v2 - Settings View Module
 * 設定モーダル（外観テーマ、データ管理、GitHub連携、About）の制御
 */

export class SettingsView {
  /**
   * @param {Object} app - PhysicalCardDeckApp インスタンス
   */
  constructor(app) {
    this.app = app;

    // DOM要素
    this.settingsModal = document.getElementById("settings-modal");
    this.btnCloseSettings = document.getElementById("btn-close-settings");
    this.settingsNotesCount = document.getElementById("settings-notes-count");
    this.settingsQueueCount = document.getElementById("settings-queue-count");
    this.btnExportJson = document.getElementById("btn-export-json");
    this.btnClearQueue = document.getElementById("btn-clear-queue");

    // GitHub設定DOM
    this.inputGithubToken = document.getElementById("input-github-token");
    this.inputGithubRepo = document.getElementById("input-github-repo");
    this.btnSaveGithubConfig = document.getElementById("btn-save-github-config");
    this.btnTestGithub = document.getElementById("btn-test-github");
    this.btnTestGithubText = document.getElementById("btn-test-github-text");
    this.btnSyncPullNow = document.getElementById("btn-sync-pull-now");
    this.githubTestResult = document.getElementById("github-test-result");
  }

  init() {
    this.initTheme();
    this.initSettingsTabs();
    this.bindEvents();
  }

  bindEvents() {
    // ⚙️ 設定ボタン（ヘッダー等の設定アイコン）
    const btnSettings = document.getElementById("btn-settings-open") || document.getElementById("btn-settings");
    if (btnSettings) {
      btnSettings.addEventListener("click", () => this.openSettings());
    }

    if (this.btnCloseSettings) {
      this.btnCloseSettings.addEventListener("click", () => this.closeSettings());
    }

    // 背景クリックで閉じる
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
      this.btnSyncPullNow.addEventListener("click", () => {
        if (this.app.sync) {
          this.app.sync.syncAll({ isManual: true });
        } else {
          this.app.syncAll({ isManual: true });
        }
      });
    }
    if (this.btnTestGithub) {
      this.btnTestGithub.addEventListener("click", () => this.testGithubConnection());
    }
  }

  // ---------------------------------------------------------------------------
  // テーマ & 外観管理
  // ---------------------------------------------------------------------------
  initTheme() {
    const savedTheme = localStorage.getItem("petasos_theme") || "twilight";
    this.setTheme(savedTheme);

    // 外観テーマ選択カードのイベント紐付け
    const themeCards = document.querySelectorAll(".theme-option-card[data-theme]");
    themeCards.forEach((card) => {
      card.addEventListener("click", () => {
        const theme = card.getAttribute("data-theme");
        if (theme) {
          this.setTheme(theme);
        }
      });
    });

    this.initStarsToggle();
  }

  initSettingsTabs() {
    const tabButtons = document.querySelectorAll(".settings-tab-btn");

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
    const starDust = document.querySelector(".star-dust");
    if (!toggleStars || !starDust) return;

    const savedState = localStorage.getItem("petasos_stars");
    const isVisible = savedState !== "off";

    toggleStars.checked = isVisible;
    starDust.style.display = isVisible ? "block" : "none";

    toggleStars.addEventListener("change", (e) => {
      const checked = e.target.checked;
      starDust.style.display = checked ? "block" : "none";
      localStorage.setItem("petasos_stars", checked ? "on" : "off");
    });
  }

  // ---------------------------------------------------------------------------
  // 設定モーダル開閉
  // ---------------------------------------------------------------------------
  async openSettings(defaultTab = null) {
    if (!this.settingsModal) return;

    if (defaultTab) {
      this.setSettingsTab(defaultTab);
    }

    // 1. 保存済みメモ数
    if (this.settingsNotesCount) {
      this.settingsNotesCount.textContent = `${this.app.state.notes.length} 件`;
    }

    // 2. 同期待ちキュー件数
    if (this.settingsQueueCount) {
      const qCount = await this.app.storage.getPendingQueueCount();
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
      const allNotes = await this.app.storage.getAllNotes();
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

      this.app.showToast("📥 思考データをJSONとしてエクスポートしました");
    } catch (e) {
      console.error("Export error:", e);
      this.app.showToast("エクスポートに失敗しました");
    }
  }

  async clearSyncQueue() {
    try {
      await this.app.storage.clearQueue();
      if (this.app.sync) {
        await this.app.sync.updateSyncIndicator();
      } else {
        await this.app.updateSyncIndicator();
      }
      if (this.settingsQueueCount) {
        this.settingsQueueCount.textContent = "0 件";
      }
      this.app.showToast("🧹 同期キューをクリアしました");
    } catch (e) {
      console.error("Queue clear error:", e);
      this.app.showToast("キューのクリアに失敗しました");
    }
  }

  saveGithubConfig() {
    if (this.inputGithubToken && this.inputGithubRepo) {
      const token = this.inputGithubToken.value.trim();
      const repo = this.inputGithubRepo.value.trim();
      localStorage.setItem("petasos_github_token", token);
      localStorage.setItem("petasos_github_repo", repo);
      this.app.showToast("⚙️ GitHub設定をブラウザに保存しました");
      if (this.githubTestResult) {
        this.githubTestResult.style.display = "none";
      }
      if (this.app.sync) {
        this.app.sync.syncPushQueue({ isManual: false });
      } else {
        this.app.syncPushQueue({ isManual: false });
      }
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
      const result = await this.app.github.testConnection(token, repo);
      if (result.success) {
        this.showGithubTestResult("success", result.message);
        localStorage.setItem("petasos_github_token", token);
        localStorage.setItem("petasos_github_repo", repo);
        if (this.app.sync) {
          this.app.sync.syncPushQueue({ isManual: false });
        } else {
          this.app.syncPushQueue({ isManual: false });
        }
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
}
