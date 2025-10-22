/**
 * Vertex AI音声解析のテスト関数
 * AppSheet API呼び出しなし、Vertex AIと実行ログのみテスト
 *
 * @author Fractal Group
 * @version 1.0.0
 * @date 2025-10-19
 */

/**
 * テスト用関数: Vertex AI音声解析
 * 実際の音声ファイルを使用してテスト
 * AppSheet API呼び出しはスキップ
 *
 * 【使用方法】
 * 1. この関数内の FILE_PATH を実際のファイルパスに変更
 * 2. GASエディタで実行
 * 3. 実行ログで結果を確認
 * 4. 実行ログスプレッドシートで確認
 *
 * @return {Object} 処理結果
 */
function testVertexAIWithFile() {
  // ========================================
  // ここにテスト用の音声ファイルパスを設定
  // ========================================
  const FILE_PATH = "通話ファイル保管/2025-05-09/202505091630_担当者_新規-問い合わせ.通話ファイル.074638.mp3";

  const logger = createLogger('通話要約生成_テスト');
  let recordId = null;
  let status = '成功';

  try {
    const testCallId = 'test_vertex_' + new Date().getTime();
    recordId = testCallId;

    logger.info('[テスト] Vertex AI音声解析モード');
    logger.info(`音声ファイル: ${FILE_PATH}`);

    // ファイルパスからファイルIDを取得
    const config = getConfig();
    const resolvedFileId = getFileIdFromPath(FILE_PATH, config.baseFolderId);
    const fileUrl = `https://drive.google.com/file/d/${resolvedFileId}/view?usp=drivesdk`;

    logger.info(`ファイルID: ${resolvedFileId}`);

    // Vertex AI音声解析を直接呼び出し
    const callDatetime = new Date().toISOString();
    const callContextText = 'テスト通話: Vertex AI音声解析のテスト実行';
    const userInfoText = 'テスト担当者';

    // 依頼情報抽出を無効化
    const requestOptions = {
      enable: false
    };

    const analysisResult = analyzeAudioWithVertexAI(
      resolvedFileId,
      callDatetime,
      callContextText,
      userInfoText,
      config,
      requestOptions
    );

    logger.success('Vertex AI音声解析成功');
    logger.info('処理結果:', {
      callId: testCallId,
      summary_length: analysisResult.summary.length,
      actions_count: analysisResult.actions.length,
      transcript_length: analysisResult.transcript ? analysisResult.transcript.length : 0
    });

    // API使用量情報をloggerに記録
    if (analysisResult.usageMetadata) {
      logger.setUsageMetadata(analysisResult.usageMetadata);
      logger.info('API使用量情報を記録しました');
    }

    // AppSheet APIはスキップ
    logger.info('[テスト] AppSheet API更新はスキップしました');

    return {
      success: true,
      callId: testCallId,
      summary: analysisResult.summary,
      transcript: analysisResult.transcript,
      actions: analysisResult.actions,
      usageMetadata: analysisResult.usageMetadata
    };

  } catch (error) {
    status = 'エラー';
    logger.error(`テストエラー: ${error.toString()}`, { stack: error.stack });
    throw error;

  } finally {
    logger.saveToSpreadsheet(status, recordId);
    logger.info('テスト完了 - 実行ログをスプレッドシートに保存しました');
  }
}

/**
 * ファイルパスを引数で指定できるバージョン
 *
 * @param {string} filePath - 音声ファイルのパス（共有ドライブ内）
 * @return {Object} 処理結果
 */
function testVertexAIWithCustomPath(filePath) {
  const logger = createLogger('通話要約生成_テスト');
  let recordId = null;
  let status = '成功';

  try {
    const testCallId = 'test_vertex_custom_' + new Date().getTime();
    recordId = testCallId;

    logger.info('[テスト] Vertex AI音声解析（カスタムパス）');
    logger.info(`音声ファイル: ${filePath}`);

    // ファイルパスからファイルIDを取得
    const config = getConfig();
    const resolvedFileId = getFileIdFromPath(filePath, config.baseFolderId);
    const fileUrl = `https://drive.google.com/file/d/${resolvedFileId}/view?usp=drivesdk`;

    logger.info(`ファイルID: ${resolvedFileId}`);

    // Vertex AI音声解析を直接呼び出し
    const callDatetime = new Date().toISOString();
    const callContextText = 'カスタムパステスト: Vertex AI音声解析';
    const userInfoText = 'テスト担当者';

    // 依頼情報抽出を無効化
    const requestOptions = {
      enable: false
    };

    const analysisResult = analyzeAudioWithVertexAI(
      resolvedFileId,
      callDatetime,
      callContextText,
      userInfoText,
      config,
      requestOptions
    );

    logger.success('Vertex AI音声解析成功');
    logger.info('処理結果:', {
      callId: testCallId,
      summary_length: analysisResult.summary.length,
      actions_count: analysisResult.actions.length,
      transcript_length: analysisResult.transcript ? analysisResult.transcript.length : 0
    });

    // API使用量情報をloggerに記録
    if (analysisResult.usageMetadata) {
      logger.setUsageMetadata(analysisResult.usageMetadata);
      logger.info('API使用量情報を記録しました');
    }

    // AppSheet APIはスキップ
    logger.info('[テスト] AppSheet API更新はスキップしました');

    return {
      success: true,
      callId: testCallId,
      summary: analysisResult.summary,
      transcript: analysisResult.transcript,
      actions: analysisResult.actions,
      usageMetadata: analysisResult.usageMetadata
    };

  } catch (error) {
    status = 'エラー';
    logger.error(`テストエラー: ${error.toString()}`, { stack: error.stack });
    throw error;

  } finally {
    logger.saveToSpreadsheet(status, recordId);
    logger.info('テスト完了 - 実行ログをスプレッドシートに保存しました');
  }
}

/**
 * 実行ログスプレッドシートを開く
 * テスト実行後、この関数を実行してログを確認
 */
function openExecutionLog() {
  const spreadsheetId = '16UHnMlSUlnUy-67gbwuvjeeU73AwDomqzJwGi6L4rVA';
  const url = `https://docs.google.com/spreadsheets/d/${spreadsheetId}`;

  Logger.log('実行ログスプレッドシート:');
  Logger.log(url);
  Logger.log('');
  Logger.log('「実行履歴」シートで以下を確認してください:');
  Logger.log('1. モデル列に「vertex-ai-gemini-2.5-flash」が記録されているか');
  Logger.log('2. Input Tokens列に数値が記録されているか（音声入力のトークン数）');
  Logger.log('3. Output Tokens列に数値が記録されているか');
  Logger.log('4. Input料金(円): 音声入力 $1.00/1M tokens × 為替レート');
  Logger.log('5. Output料金(円): テキスト出力 $2.50/1M tokens × 為替レート');
  Logger.log('6. 合計料金(円)が記録されているか');

  return url;
}

/**
 * 共有ドライブ内のファイルを検索
 * テスト用の音声ファイルを探す際に使用
 *
 * @param {string} folderPath - フォルダーパス（例: "通話録音/2025/10"）
 * @param {string} extension - 拡張子（例: "m4a", "mp3"）
 */
function findAudioFiles(folderPath, extension) {
  const baseFolderId = '16swPUizvdlyPxUjbDpVl9-VBDJZO91kX';

  Logger.log(`音声ファイル検索:`);
  Logger.log(`  フォルダー: ${folderPath || 'ルート'}`);
  Logger.log(`  拡張子: ${extension || '全て'}`);
  Logger.log('');

  try {
    let folder = DriveApp.getFolderById(baseFolderId);

    // フォルダーパスを辿る
    if (folderPath) {
      const parts = folderPath.split('/');
      for (const part of parts) {
        const folders = folder.getFoldersByName(part);
        if (folders.hasNext()) {
          folder = folders.next();
        } else {
          Logger.log(`フォルダーが見つかりません: ${part}`);
          return;
        }
      }
    }

    Logger.log(`検索フォルダー: ${folder.getName()}`);
    Logger.log('');

    // ファイルを検索
    const files = folder.getFiles();
    let count = 0;

    while (files.hasNext()) {
      const file = files.next();
      const fileName = file.getName();

      if (!extension || fileName.endsWith('.' + extension)) {
        count++;
        Logger.log(`${count}. ${fileName}`);
        Logger.log(`   パス: ${folderPath ? folderPath + '/' : ''}${fileName}`);
        Logger.log(`   ID: ${file.getId()}`);
        Logger.log('');
      }
    }

    if (count === 0) {
      Logger.log('ファイルが見つかりませんでした');
    } else {
      Logger.log(`合計: ${count}件`);
    }

  } catch (error) {
    Logger.log(`エラー: ${error.toString()}`);
  }
}
