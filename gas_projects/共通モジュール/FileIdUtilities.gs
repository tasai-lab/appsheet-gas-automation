/**
 * ファイルID処理共通ユーティリティモジュール
 *
 * Google Drive上のファイル検索、ID・URL取得を標準化
 * 全てのAppSheet GASプロジェクトで共通利用可能
 *
 * @author Fractal Group
 * @version 2.0.0
 * @date 2025-10-17
 */

const FileIdUtilities = {

  /**
   * ログ出力レベル設定
   * @type {string} DEBUG | INFO | WARN | ERROR
   */
  LOG_LEVEL: 'INFO',

  /**
   * ログ出力
   * @private
   * @param {string} level - ログレベル
   * @param {string} message - メッセージ
   * @param {Object} [details] - 詳細情報
   */
  log_: function(level, message, details) {
    const levels = ['DEBUG', 'INFO', 'WARN', 'ERROR'];
    const currentLevel = levels.indexOf(this.LOG_LEVEL);
    const messageLevel = levels.indexOf(level);

    if (messageLevel >= currentLevel) {
      const prefix = `[FileIdUtils][${level}]`;
      if (details) {
        Logger.log(`${prefix} ${message}: ${JSON.stringify(details, null, 2)}`);
      } else {
        Logger.log(`${prefix} ${message}`);
      }
    }
  },

  /**
   * ファイルパスからファイルID・URLを取得（共有ドライブ対応）
   *
   * @param {string} filePath - ファイルパス（例: "2024/10/recording.m4a"）
   * @param {string} baseFolderId - ベースフォルダーID（共有ドライブのルートフォルダー）
   * @param {Object} [options] - オプション設定
   * @param {boolean} [options.throwOnNotFound=true] - ファイルが見つからない場合に例外を投げるか
   * @param {boolean} [options.returnFirstMatch=true] - 同名ファイルが複数ある場合、最初のものを返すか
   * @return {Object|null} {fileId: string, fileUrl: string, fileName: string, mimeType: string, size: number} または null
   */
  getFileIdFromPath: function(filePath, baseFolderId, options = {}) {
    const opts = {
      throwOnNotFound: true,
      returnFirstMatch: true,
      ...options
    };

    try {
      this.log_('INFO', `ファイルパス解決開始`, { filePath, baseFolderId });

      // パス検証
      if (!filePath || typeof filePath !== 'string') {
        throw new Error('ファイルパスが無効です');
      }

      if (!baseFolderId) {
        throw new Error('ベースフォルダーIDが指定されていません');
      }

      // パスを分割（例: "2024/10/recording.m4a" → ["2024", "10", "recording.m4a"]）
      const pathParts = filePath.split('/').filter(part => part.length > 0);

      if (pathParts.length === 0) {
        throw new Error('ファイルパスが空です');
      }

      // ベースフォルダーから開始
      let currentFolder;
      try {
        currentFolder = DriveApp.getFolderById(baseFolderId);
      } catch (e) {
        throw new Error(`ベースフォルダーにアクセスできません: ${baseFolderId} - ${e.message}`);
      }

      // パスを辿る（最後の要素はファイル名なので除外）
      for (let i = 0; i < pathParts.length - 1; i++) {
        const folderName = pathParts[i];
        this.log_('DEBUG', `フォルダー検索: ${folderName}`);

        const folders = currentFolder.getFoldersByName(folderName);

        if (!folders.hasNext()) {
          const errorPath = pathParts.slice(0, i + 1).join('/');
          const error = new Error(`フォルダーが見つかりません: ${folderName} (パス: ${errorPath})`);
          if (opts.throwOnNotFound) {
            throw error;
          } else {
            this.log_('WARN', error.message);
            return null;
          }
        }

        currentFolder = folders.next();
        this.log_('DEBUG', `フォルダー発見`, {
          name: currentFolder.getName(),
          id: currentFolder.getId()
        });
      }

      // 最後の要素（ファイル名）を取得
      const fileName = pathParts[pathParts.length - 1];
      this.log_('INFO', `ファイル検索: ${fileName}`);

      const files = currentFolder.getFilesByName(fileName);

      if (!files.hasNext()) {
        const error = new Error(`ファイルが見つかりません: ${fileName} (フォルダー: ${currentFolder.getName()})`);
        if (opts.throwOnNotFound) {
          throw error;
        } else {
          this.log_('WARN', error.message);
          return null;
        }
      }

      const file = files.next();
      const fileId = file.getId();
      const fileUrl = file.getUrl();
      const mimeType = file.getMimeType();
      const size = file.getSize();

      this.log_('INFO', `ファイル発見`, {
        name: file.getName(),
        id: fileId,
        mimeType: mimeType,
        size: size
      });

      // 同名ファイルが複数ある場合は警告
      if (files.hasNext()) {
        this.log_('WARN', '同名ファイルが複数存在します。最初のファイルを使用します。');
      }

      return {
        fileId: fileId,
        fileUrl: fileUrl,
        fileName: file.getName(),
        mimeType: mimeType,
        size: size,
        lastUpdated: file.getLastUpdated(),
        createdDate: file.getDateCreated()
      };

    } catch (error) {
      this.log_('ERROR', `ファイルパスの解決に失敗: ${error.message}`, {
        filePath,
        baseFolderId
      });
      throw new Error(`ファイルパスの解決に失敗しました: ${error.message}`);
    }
  },

  /**
   * フォルダー内から特定の文字列を含むファイルを検索（再帰的）
   *
   * @param {string} folderId - 検索開始フォルダーID
   * @param {string} searchString - 検索文字列（ファイル名の一部）
   * @param {Object} [options] - オプション設定
   * @param {boolean} [options.recursive=true] - サブフォルダーも検索するか
   * @param {boolean} [options.returnLatest=true] - 最新のファイルのみ返すか
   * @param {Array<string>} [options.allowedExtensions] - 許可する拡張子リスト
   * @return {Object|Array|null} ファイル情報またはファイル情報の配列
   */
  findFileInFolder: function(folderId, searchString, options = {}) {
    const opts = {
      recursive: true,
      returnLatest: true,
      allowedExtensions: null,
      ...options
    };

    try {
      this.log_('INFO', `ファイル検索開始`, { folderId, searchString, options: opts });

      const folder = DriveApp.getFolderById(folderId);
      const results = [];

      // 再帰的検索関数
      const searchRecursively = (currentFolder) => {
        // 現在のフォルダー内を検索
        const query = `title contains '${searchString}' and trashed = false`;
        const files = currentFolder.searchFiles(query);

        while (files.hasNext()) {
          const file = files.next();
          const fileName = file.getName();

          // 拡張子チェック
          if (opts.allowedExtensions) {
            const extension = fileName.includes('.') ?
              fileName.split('.').pop().toLowerCase() : '';

            if (!opts.allowedExtensions.includes(extension)) {
              this.log_('DEBUG', `スキップ: 非対応拡張子`, { fileName, extension });
              continue;
            }
          }

          const fileInfo = {
            fileId: file.getId(),
            fileUrl: file.getUrl(),
            fileName: fileName,
            mimeType: file.getMimeType(),
            size: file.getSize(),
            lastUpdated: file.getLastUpdated(),
            createdDate: file.getDateCreated()
          };

          results.push(fileInfo);
          this.log_('DEBUG', `ファイル発見`, fileInfo);
        }

        // サブフォルダーの検索
        if (opts.recursive) {
          const subFolders = currentFolder.getFolders();
          while (subFolders.hasNext()) {
            searchRecursively(subFolders.next());
          }
        }
      };

      // 検索実行
      searchRecursively(folder);

      if (results.length === 0) {
        this.log_('WARN', `ファイルが見つかりません`, { searchString });
        return null;
      }

      // 結果の処理
      if (opts.returnLatest && results.length > 0) {
        // 最新のファイルを返す
        results.sort((a, b) => b.createdDate - a.createdDate);
        const latest = results[0];
        this.log_('INFO', `最新ファイルを返却`, latest);
        return latest;
      } else {
        // 全結果を返す
        this.log_('INFO', `${results.length}件のファイルを返却`);
        return results;
      }

    } catch (error) {
      this.log_('ERROR', `ファイル検索エラー: ${error.message}`, {
        folderId,
        searchString
      });
      throw new Error(`ファイル検索に失敗しました: ${error.message}`);
    }
  },

  /**
   * ファイルIDから詳細情報を取得
   *
   * @param {string} fileId - ファイルID
   * @return {Object} ファイル詳細情報
   */
  getFileInfo: function(fileId) {
    try {
      const file = DriveApp.getFileById(fileId);

      const info = {
        fileId: file.getId(),
        fileUrl: file.getUrl(),
        fileName: file.getName(),
        mimeType: file.getMimeType(),
        size: file.getSize(),
        lastUpdated: file.getLastUpdated(),
        createdDate: file.getDateCreated(),
        description: file.getDescription(),
        sharingAccess: file.getSharingAccess(),
        sharingPermission: file.getSharingPermission()
      };

      this.log_('INFO', `ファイル情報取得成功`, info);
      return info;

    } catch (error) {
      this.log_('ERROR', `ファイル情報取得エラー: ${error.message}`, { fileId });
      throw new Error(`ファイル情報の取得に失敗しました: ${error.message}`);
    }
  },

  /**
   * ファイル形式の検証
   *
   * @param {string} fileName - ファイル名
   * @param {Array<string>} allowedFormats - 許可する拡張子リスト
   * @return {Object} {isValid: boolean, extension: string, mimeType: string}
   */
  validateFileFormat: function(fileName, allowedFormats) {
    const extension = fileName.includes('.') ?
      fileName.split('.').pop().toLowerCase() : '';

    // 標準的なMIMEタイプマッピング
    const mimeTypeMap = {
      'm4a': 'audio/mp4',
      'mp4': 'audio/mp4',
      'mp3': 'audio/mpeg',
      'wav': 'audio/wav',
      'ogg': 'audio/ogg',
      '3gp': 'video/3gpp',
      '3gpp': 'video/3gpp',
      'pdf': 'application/pdf',
      'doc': 'application/msword',
      'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'xls': 'application/vnd.ms-excel',
      'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'png': 'image/png',
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'gif': 'image/gif'
    };

    const isValid = allowedFormats.includes(extension);
    const mimeType = mimeTypeMap[extension] || 'application/octet-stream';

    const result = {
      isValid: isValid,
      extension: extension,
      mimeType: mimeType
    };

    this.log_('DEBUG', `ファイル形式検証`, { fileName, ...result });
    return result;
  },

  /**
   * AppSheet APIへファイル情報を送信する汎用関数
   *
   * @param {Object} config - API設定
   * @param {string} config.appId - AppSheet アプリID
   * @param {string} config.tableName - テーブル名
   * @param {string} config.accessKey - アクセスキー
   * @param {string} action - アクション (Edit/Add/Delete)
   * @param {Array<Object>} rows - 行データ
   * @return {Object} APIレスポンス
   */
  updateAppSheetWithFileInfo: function(config, action, rows) {
    const payload = {
      Action: action,
      Properties: {
        Locale: "ja-JP",
        Timezone: "Asia/Tokyo"
      },
      Rows: rows
    };

    const apiUrl = `https://api.appsheet.com/api/v2/apps/${config.appId}/tables/${config.tableName}/Action`;

    const options = {
      method: 'post',
      contentType: 'application/json',
      headers: {
        'ApplicationAccessKey': config.accessKey
      },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    };

    try {
      this.log_('INFO', `AppSheet API呼び出し`, {
        table: config.tableName,
        action: action,
        rowCount: rows.length
      });

      const response = UrlFetchApp.fetch(apiUrl, options);
      const statusCode = response.getResponseCode();
      const responseText = response.getContentText();

      if (statusCode >= 200 && statusCode < 300) {
        this.log_('INFO', `AppSheet API成功`, { statusCode });
        return {
          success: true,
          statusCode: statusCode,
          response: responseText
        };
      } else {
        throw new Error(`API Error: ${statusCode} - ${responseText}`);
      }

    } catch (error) {
      this.log_('ERROR', `AppSheet APIエラー: ${error.message}`);
      throw new Error(`AppSheet API呼び出しに失敗しました: ${error.message}`);
    }
  },

  /**
   * デバッグ用: テスト関数
   */
  test: function() {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🧪 FileIdUtilities テスト');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    // テスト設定（実際の値に置き換えてください）
    const testConfig = {
      baseFolderId: '1234567890ABCDEF', // 実際のフォルダーIDに置き換え
      filePath: '2024/10/test.m4a',
      searchString: 'test'
    };

    try {
      // テスト1: ファイルパスからID取得
      console.log('\n📁 テスト1: ファイルパスからID取得');
      const fileInfo = this.getFileIdFromPath(
        testConfig.filePath,
        testConfig.baseFolderId,
        { throwOnNotFound: false }
      );
      console.log('結果:', fileInfo);

      // テスト2: フォルダー内検索
      console.log('\n🔍 テスト2: フォルダー内検索');
      const searchResult = this.findFileInFolder(
        testConfig.baseFolderId,
        testConfig.searchString,
        { recursive: true, returnLatest: true }
      );
      console.log('結果:', searchResult);

      // テスト3: ファイル形式検証
      console.log('\n✅ テスト3: ファイル形式検証');
      const validation = this.validateFileFormat(
        'recording.m4a',
        ['m4a', 'mp3', 'wav']
      );
      console.log('結果:', validation);

    } catch (error) {
      console.error('❌ テストエラー:', error.message);
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  }
};
