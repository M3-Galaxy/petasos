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
    this.registerServiceWorker();
    this.bindEvents();
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
