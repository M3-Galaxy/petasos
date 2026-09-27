/**
 * Petasos v2 - PWA Manager Module
 * Service Worker の登録、更新検知、および PWA インストールプロンプトの管理
 */

export class PwaManager {
  /**
   * @param {Object} app - PhysicalCardDeckApp インスタンス（showToast 等を委譲）
   */
  constructor(app) {
    this.app = app;
    this.btnInstallPwa = document.getElementById("btn-install-pwa");
    this.deferredInstallPrompt = null;
  }

  init() {
    this.setupIosViewportStabilizer();
    this.registerServiceWorker();
    this.bindEvents();
  }

  /**
   * 📱 iOS PWA における初期ロード遅延・フォント適用・キーボード退場時の下端ズレを防止するスタビライザー
   */
  setupIosViewportStabilizer() {
    // スクロール原点を強制的にゼロへ戻す関数
    const forceReset = () => {
      window.scrollTo(0, 0);
      if (document.documentElement) document.documentElement.scrollTop = 0;
      if (document.body) document.body.scrollTop = 0;
    };

    // 多段階タイマーで遅延したレイアウト確定（フォント・通信・セーフエリア確定の波）を迎え撃つ
    const triggerMultiStageReset = () => {
      forceReset();
      // 0ms, 150ms, 350ms, 700ms, 1500ms, 2200ms, 3200ms
      // 2秒前後に発生する「Webフォント到着・レイアウト確定の縮み」を確実にカバー
      const stages = [150, 350, 700, 1500, 2200, 3200];
      stages.forEach((delay) => {
        setTimeout(forceReset, delay);
      });
    };

    this.forceReset = forceReset;
    this.triggerMultiStageReset = triggerMultiStageReset;

    // ① Webフォント（Noto Sans JP等）の読み込み完了時（文字の伸縮・レイアウトシフト直後）
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(() => {
        triggerMultiStageReset();
      });
    }

    // ② ページリソース全体の読み込み完了時
    window.addEventListener("load", () => {
      triggerMultiStageReset();
    });

    // ③ アプリ復帰時（バックグラウンドからフォアグラウンドに戻った瞬間）
    window.addEventListener("pageshow", () => {
      triggerMultiStageReset();
    });
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") {
        triggerMultiStageReset();
      }
    });

    // ④ キーボードを閉じた（focusout）瞬間（iOSキーボード退場アニメーション完了後）
    document.addEventListener("focusout", (e) => {
      if (e.target && ["INPUT", "TEXTAREA"].includes(e.target.tagName)) {
        setTimeout(forceReset, 350);
        setTimeout(forceReset, 500);
      }
    });
  }

  bindEvents() {
    if (this.btnInstallPwa) {
      this.btnInstallPwa.addEventListener("click", () => this.installPwa());
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
      this.app.showToast("🎉 Petasos がホーム画面/PCにインストールされました！");
      if (this.btnInstallPwa) {
        this.btnInstallPwa.style.display = "none";
      }
    });
  }

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
                    this.app.showToast("✨ 新しいバージョンが利用可能です。再読み込みで更新されます。");
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
  }

  async installPwa() {
    if (!this.deferredInstallPrompt) {
      this.app.showToast("📱 ブラウザの共有メニューまたはアドレスバーから「ホーム画面に追加」を選択してください");
      return;
    }

    this.deferredInstallPrompt.prompt();
    const { outcome } = await this.deferredInstallPrompt.userChoice;
    console.log(`[PWA] Install prompt outcome: ${outcome}`);
    if (outcome === "accepted") {
      this.app.showToast("🎉 Petasos のインストールを開始しました");
    }
    this.deferredInstallPrompt = null;
    if (this.btnInstallPwa) {
      this.btnInstallPwa.style.display = "none";
    }
  }
}
