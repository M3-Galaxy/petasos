/**
 * Petasos v2 - GitHub Sync Manager Module
 * プッシュ同期、プル同期（SHAハッシュ差分＆LWW競合解決）、およびインジケーター管理
 */

import { ICONS } from "../icons.js";

export class SyncManager {
  /**
   * @param {Object} app - PhysicalCardDeckApp インスタンス
   */
  constructor(app) {
    this.app = app;
    this.isSyncing = false;

    // DOM要素
    this.syncIndicator = document.getElementById("sync-indicator");
    this.syncIconWrap = document.getElementById("sync-icon-wrap");
    this.syncBadgeCount = document.getElementById("sync-badge-count");
  }

  init() {
    this.bindEvents();
    this.updateSyncIndicator();
  }

  bindEvents() {
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
      const count = await this.app.storage.getPendingQueueCount();
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
  // ☁️ GitHub プッシュ同期エンジン
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
        this.app.showToast("⚙️ GitHub連携が未設定です。設定画面からトークンとリポジトリを設定してください。");
        this.app.openSettings("github");
      }
      await this.updateSyncIndicator();
      return { success: false, successCount: 0 };
    }

    let pendingItems = [];
    try {
      pendingItems = await this.app.storage.getPendingQueueItems();
    } catch (err) {
      console.error("Failed to get pending queue items:", err);
      return { success: false, successCount: 0 };
    }

    if (pendingItems.length === 0) {
      if (options.isManual && !options.isSilent) {
        this.app.showToast("✨ すべての思考はGitHubに同期済みです");
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
          const note = await this.app.storage.getNote(item.note_id);
          if (!note) {
            // メモが存在しない場合はキューアイテムを消去
            await this.app.storage.deleteQueueItem(item.queue_id);
            continue;
          }

          // GitHub API経由で notes/{id}.json をコミット
          const result = await this.app.github.pushNote(token, repo, note);
          if (result.success) {
            await this.app.storage.deleteQueueItem(item.queue_id);
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
      if (this.app.settingsQueueCount) {
        const qCount = await this.app.storage.getPendingQueueCount();
        this.app.settingsQueueCount.textContent = `${qCount} 件`;
      }
    }

    if (options.isManual && !options.isSilent) {
      if (successCount > 0) {
        this.app.showToast(`☁️ ${successCount} 件の思考をGitHubへ安全に同期しました`);
      } else if (failCount > 0) {
        this.app.showToast(`⚠️ 一部の同期に失敗しました (${failCount} 件): ${lastErrorMessage || "通信エラー"}`);
      }
    }

    return { success: failCount === 0, successCount, failCount };
  }

  // ---------------------------------------------------------------------------
  // 📥 GitHub プル同期エンジン（ステップ3）
  // ---------------------------------------------------------------------------
  async syncPullNotes(options = { isManual: false }) {
    const token = localStorage.getItem("petasos_github_token") || "";
    const repo = localStorage.getItem("petasos_github_repo") || "";

    if (!token || !repo) {
      return { success: false, pullCount: 0 };
    }

    // 1. リモートの notes/ 配下の一覧を取得
    const listRes = await this.app.github.listNotes(token, repo);
    if (!listRes.success) {
      console.warn("Failed to list remote notes:", listRes.message);
      return { success: false, pullCount: 0 };
    }

    const remoteFiles = listRes.files;
    if (remoteFiles.length === 0) {
      return { success: true, pullCount: 0 };
    }

    // 2. ローカルで保持しているリモートSHA一覧を取得
    let localShas = {};
    try {
      const raw = localStorage.getItem("petasos_file_shas");
      if (raw) localShas = JSON.parse(raw);
    } catch (e) {
      console.warn("Failed to parse local file SHAs:", e);
      localShas = {};
    }

    // 3. SHAハッシュが異なる（未取得または更新された）ファイルだけをフィルタリング
    const filesToFetch = remoteFiles.filter((f) => {
      const cachedSha = localShas[f.name];
      return !cachedSha || cachedSha !== f.sha;
    });

    if (filesToFetch.length === 0) {
      return { success: true, pullCount: 0 };
    }

    console.log(`[Pull Sync] ${filesToFetch.length} files changed on remote, downloading...`);

    let pullCount = 0;
    for (const file of filesToFetch) {
      try {
        const fetchRes = await this.app.github.fetchNoteFile(token, repo, file.path);
        if (!fetchRes.success || !fetchRes.note) {
          console.warn(`Failed to fetch remote note file ${file.path}:`, fetchRes.message);
          continue;
        }

        const remoteNote = fetchRes.note;

        // 4. LWW (Last-Write-Wins): 手元のメモと比較
        const localNote = await this.app.storage.getNote(remoteNote.id);
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
        await this.app.storage.upsertNoteFromRemote(remoteNote);
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
      const freshNotes = await this.app.storage.getAllNotes(false);
      const currentNote = this.app.state.getCurrentNote();
      const currentNoteId = currentNote ? currentNote.id : null;

      this.app.state.notes = freshNotes;

      // 見ていたメモの位置を維持（または先頭）
      if (currentNoteId) {
        const newIdx = this.app.state.notes.findIndex((n) => n.id === currentNoteId);
        this.app.state.currentIndex = newIdx !== -1 ? newIdx : 0;
      } else {
        this.app.state.currentIndex = 0;
      }

      this.app.renderCards();
      this.app.updateStatus();
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
        this.app.showToast("⚙️ GitHub連携が未設定です。設定画面からトークンとリポジトリを設定してください。");
        this.app.openSettings("github");
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
          this.app.showToast(`☁️ GitHubから最新の思考を ${pullResult.pullCount} 件取り込みました`);
        } else {
          this.app.showToast("✨ すべての思考は最新状態に保たれています");
        }
      }
    } catch (err) {
      console.error("Full sync error:", err);
      if (options.isManual) {
        this.app.showToast(`⚠️ 同期中にエラーが発生しました: ${err.message}`);
      }
    } finally {
      this.isSyncing = false;
      await this.updateSyncIndicator();
    }
  }
}
