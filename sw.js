/**
 * Petasos v2 - Service Worker (Offline Support & Cache Management)
 * キャッシュバージョン管理により、オフライン動作とスムーズな更新を実現
 */

const CACHE_NAME = "petasos-v1.3.7";

// アプリの動作に必要な静的コアファイル群
const CORE_ASSETS = [
  "./",
  "./index.html",
  "./style.css",
  "./app.js",
  "./constants.js",
  "./github.js",
  "./icons.js",
  "./state.js",
  "./storage.js",
  "./utils.js",
  "./modules/deck-controller.js",
  "./modules/grid-view.js",
  "./modules/note-modal.js",
  "./modules/pwa-manager.js",
  "./modules/selection.js",
  "./modules/settings-view.js",
  "./modules/sync-manager.js",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
  "./icon-maskable-512.png",
  "./apple-touch-icon.png",
  "./favicon.png",
  "./hermes-lineart.webp",
  "./hermes-lineart.png"
];

// -----------------------------------------------------------------------------
// 1. Install: コアアセットの事前キャッシュ ＆ 即時有効化
// -----------------------------------------------------------------------------
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => {
        console.log("[ServiceWorker] Pre-caching core assets...");
        return cache.addAll(CORE_ASSETS);
      })
      .then(() => self.skipWaiting())
      .catch((err) => {
        console.warn("[ServiceWorker] Pre-cache warning:", err);
      })
  );
});

// -----------------------------------------------------------------------------
// 2. Activate: 古いキャッシュの自動削除 ＆ 即時コントロール開始
// -----------------------------------------------------------------------------
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((name) => {
            if (name !== CACHE_NAME) {
              console.log("[ServiceWorker] Removing old cache:", name);
              return caches.delete(name);
            }
          })
        );
      })
      .then(() => self.clients.claim())
  );
});

// -----------------------------------------------------------------------------
// 3. Fetch: キャッシュファースト ＋ バックグラウンド更新（Stale-While-Revalidate）
// -----------------------------------------------------------------------------
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // ① GitHub APIへの同期通信はキャッシュせず常にネットワークへ（安全最優先）
  if (url.hostname.includes("github.com") || url.hostname.includes("githubusercontent.com")) {
    return;
  }

  // ② GET以外のリクエスト（POST, PUT等）や特殊スキームは素通し
  if (event.request.method !== "GET" || !url.protocol.startsWith("http")) {
    return;
  }

  // ③ 静的リソース: キャッシュから即座に応答 ＋ バックグラウンドで最新を取得・更新
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      // ネットワーク通信プロミス（最新リソースのフェッチ＆キャッシュ更新）
      const fetchPromise = fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200 && networkResponse.type === "basic") {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }
          return networkResponse;
        })
        .catch((err) => {
          // ネットワークオフライン時は何もしない（cachedResponseがあればそれが返る）
          console.debug("[ServiceWorker] Fetch failed, relying on cache if available:", err);
        });

      // キャッシュが存在すれば即座に応答（高速）、なければネットワーク結果を待つ
      return cachedResponse || fetchPromise;
    })
  );
});
