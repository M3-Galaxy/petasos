/**
 * Petasos v2 - GitHub REST API Client & Sync Engine
 * 1メモ＝1ファイル（JSON）によるPrivateリポジトリ双方向同期モジュール
 */

export class GitHubClient {
  constructor() {
    this.baseUrl = "https://api.github.com";
  }

  /**
   * リポジトリ名文字列（"owner/repo"）をパース
   */
  parseRepoPath(repoPath) {
    if (!repoPath || typeof repoPath !== "string") {
      throw new Error("リポジトリ名が入力されていません (例: username/petasos-notes)");
    }
    const clean = repoPath.trim().replace(/^https?:\/\/github\.com\//, "").replace(/\.git$/, "");
    const parts = clean.split("/");
    if (parts.length !== 2 || !parts[0] || !parts[1]) {
      throw new Error("リポジトリ名は「ユーザー名/リポジトリ名」の形式で入力してください (例: username/petasos-notes)");
    }
    return { owner: parts[0], repo: parts[1] };
  }

  /**
   * 共通リクエストヘッダー
   */
  getHeaders(token) {
    return {
      "Authorization": `Bearer ${token.trim()}`,
      "Accept": "application/vnd.github.v3+json",
      "X-GitHub-Api-Version": "2022-11-28"
    };
  }

  /**
   * 1. 接続テスト（疎通確認）
   * リポジトリの存在、Private属性、書き込み権限（permissions.push）を検証
   */
  async testConnection(token, repoPath) {
    if (!token || !token.trim()) {
      return {
        success: false,
        status: 400,
        message: "Personal Access Token が入力されていません。"
      };
    }

    let parsed;
    try {
      parsed = this.parseRepoPath(repoPath);
    } catch (err) {
      return {
        success: false,
        status: 400,
        message: err.message
      };
    }

    const url = `${this.baseUrl}/repos/${parsed.owner}/${parsed.repo}`;

    try {
      const res = await fetch(url, {
        method: "GET",
        headers: this.getHeaders(token)
      });

      if (res.status === 200) {
        const data = await res.json();
        const isPrivate = data.private;
        const canPush = data.permissions ? data.permissions.push : true;

        if (!canPush) {
          return {
            success: false,
            status: 200,
            message: `⚠️ リポジトリ「${data.full_name}」は見つかりましたが、書き込み権限（Push）がありません。トークンの「Contents: Read and write」権限をご確認ください。`,
            data
          };
        }

        return {
          success: true,
          status: 200,
          message: `✅ 接続成功！リポジトリ「${data.full_name}」(${isPrivate ? "Private" : "Public"}) への書き込み権限を確認しました。`,
          data
        };
      }

      if (res.status === 401) {
        return {
          success: false,
          status: 401,
          message: "❌ 認証エラー (401): トークンが無効または失効しています。トークン文字列をご確認ください。"
        };
      }

      if (res.status === 404) {
        return {
          success: false,
          status: 404,
          message: `❌ 見つかりません (404): リポジトリ「${parsed.owner}/${parsed.repo}」が存在しないか、トークンにこのリポジトリへのアクセス許可が付与されていません。Fine-grained PATの「Repository access」に対象リポジトリが含まれているかご確認ください。`
        };
      }

      if (res.status === 403) {
        const errorData = await res.json().catch(() => ({}));
        return {
          success: false,
          status: 403,
          message: `❌ アクセス拒否 (403): ${errorData.message || "レートリミットまたはアクセス権限の制限です。"}`
        };
      }

      const otherData = await res.json().catch(() => ({}));
      return {
        success: false,
        status: res.status,
        message: `❌ エラー (${res.status}): ${otherData.message || res.statusText}`
      };

    } catch (networkErr) {
      console.error("GitHub API network error:", networkErr);
      return {
        success: false,
        status: 0,
        message: "❌ 通信エラー: ネットワーク接続を確認してください。"
      };
    }
  }

  /**
   * UTF-8文字列を安全にBase64エンコード（日本語・絵文字対応）
   */
  utf8ToBase64(str) {
    const bytes = new TextEncoder().encode(str);
    const binString = Array.from(bytes, (byte) => String.fromCharCode(byte)).join("");
    return btoa(binString);
  }

  /**
   * 既存ファイルのSHAを取得（上書きコミット時の競合防止）
   * ファイルが存在しない場合は null を返す
   */
  async getFileSha(token, repoPath, filePath) {
    const parsed = this.parseRepoPath(repoPath);
    const url = `${this.baseUrl}/repos/${parsed.owner}/${parsed.repo}/contents/${filePath}`;

    try {
      const res = await fetch(url, {
        method: "GET",
        headers: this.getHeaders(token)
      });

      if (res.status === 200) {
        const data = await res.json();
        return data.sha || null;
      }
      return null;
    } catch (_) {
      return null;
    }
  }

  /**
   * ファイルのコミット作成・更新 (PUT contents API)
   */
  async putFile(token, repoPath, filePath, contentString, commitMessage) {
    const parsed = this.parseRepoPath(repoPath);
    const url = `${this.baseUrl}/repos/${parsed.owner}/${parsed.repo}/contents/${filePath}`;

    // 既存ファイルが存在するか確認して sha を取得
    const existingSha = await this.getFileSha(token, repoPath, filePath);

    const body = {
      message: commitMessage,
      content: this.utf8ToBase64(contentString)
    };

    if (existingSha) {
      body.sha = existingSha;
    }

    console.log(`[GitHub API] PUT ${url}`, { existingSha, message: commitMessage });

    const res = await fetch(url, {
      method: "PUT",
      headers: {
        ...this.getHeaders(token),
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });

    if (res.status === 200 || res.status === 201) {
      const data = await res.json();
      console.log(`[GitHub API] PUT Success (${res.status}):`, filePath);
      return {
        success: true,
        status: res.status,
        data
      };
    }

    const errorData = await res.json().catch(() => ({}));
    console.error(`[GitHub API] PUT Error (${res.status}):`, errorData);
    return {
      success: false,
      status: res.status,
      message: errorData.message || res.statusText
    };
  }

  /**
   * 2. メモ単件をGitHubリポジトリへプッシュ（1メモ＝1 JSONファイル）
   * リポジトリ内の notes/{note.id}.json としてコミット
   */
  async pushNote(token, repoPath, note) {
    if (!note || !note.id) {
      throw new Error("無効なメモデータです");
    }

    // 企画書セクション3準拠のデータ構造
    const noteData = {
      id: note.id,
      created_at: note.created_at || new Date().toISOString(),
      updated_at: note.updated_at || new Date().toISOString(),
      date: note.date || "",
      title: note.title || "無題の思考",
      content: note.content || "",
      category: note.category || "未分類",
      links: note.links || [],
      embedding: note.embedding || [],
      status: note.status || "active"
    };

    const jsonString = JSON.stringify(noteData, null, 2) + "\n";
    const filePath = `notes/${note.id}.json`;

    let commitMessage = `feat(notes): ${note.title || note.id}`;
    if (note.status === "archived") {
      commitMessage = `archive(notes): ${note.title || note.id} を手放す`;
    }

    return await this.putFile(token, repoPath, filePath, jsonString, commitMessage);
  }

  /**
   * Base64文字列を安全にUTF-8文字列へデコード（日本語・絵文字対応）
   */
  base64ToUtf8(base64Str) {
    const clean = base64Str.replace(/\s/g, "");
    const binary = atob(clean);
    const bytes = Uint8Array.from(binary, (ch) => ch.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  }

  /**
   * 3. リポジトリ内の notes/ フォルダにある全JSONファイル一覧を取得
   */
  async listNotes(token, repoPath) {
    const parsed = this.parseRepoPath(repoPath);
    const url = `${this.baseUrl}/repos/${parsed.owner}/${parsed.repo}/contents/notes`;

    try {
      const res = await fetch(url, {
        method: "GET",
        headers: this.getHeaders(token)
      });

      if (res.status === 200) {
        const items = await res.json();
        const jsonFiles = (Array.isArray(items) ? items : []).filter(
          (item) => item.type === "file" && item.name.endsWith(".json")
        );
        return {
          success: true,
          status: 200,
          files: jsonFiles
        };
      }

      if (res.status === 404) {
        // notesフォルダが未作成の場合は空リストを返す
        return {
          success: true,
          status: 404,
          files: []
        };
      }

      const errData = await res.json().catch(() => ({}));
      return {
        success: false,
        status: res.status,
        message: errData.message || res.statusText,
        files: []
      };
    } catch (err) {
      console.error("listNotes error:", err);
      return {
        success: false,
        status: 0,
        message: err.message,
        files: []
      };
    }
  }

  /**
   * 4. GitHubから単一メモファイルを取得・JSONパース
   */
  async fetchNoteFile(token, repoPath, filePath) {
    const parsed = this.parseRepoPath(repoPath);
    const url = `${this.baseUrl}/repos/${parsed.owner}/${parsed.repo}/contents/${filePath}`;

    try {
      const res = await fetch(url, {
        method: "GET",
        headers: this.getHeaders(token)
      });

      if (res.status === 200) {
        const data = await res.json();
        if (!data.content) {
          throw new Error("ファイルの中身が空です");
        }
        const jsonStr = this.base64ToUtf8(data.content);
        const noteObj = JSON.parse(jsonStr);
        return {
          success: true,
          status: 200,
          note: noteObj,
          sha: data.sha
        };
      }

      const errData = await res.json().catch(() => ({}));
      return {
        success: false,
        status: res.status,
        message: errData.message || res.statusText
      };
    } catch (err) {
      console.error(`fetchNoteFile error (${filePath}):`, err);
      return {
        success: false,
        status: 0,
        message: err.message
      };
    }
  }
}

