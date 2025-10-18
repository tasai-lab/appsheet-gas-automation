/**

 * AppSheetSecureConnector Library

 * AppSheet APIキーを安全に管理し、API呼び出しを仲介します。

 */


// =====================================================================================

// 設定 (Configuration) - このライブラリ内でのみ保持・使用

// =====================================================================================

const CONFIG = {

  APPSHEET: {

    APP_ID: 'f40c4b11-b140-4e31-a60c-600f3c9637c8',

    // ★★★ 重要: APIキーはここに記述され、安全に保護されます ★★★

    ACCESS_KEY: 'V2-s6fif-zteYn-AGhoC-EhNLX-NNwgP-nHXAr-hHGZp-XxyPY',

    PLAN_TABLE_NAME: 'Schedule_Plan',

    getEndpoint: function() {

        return `https://api.appsheet.com/api/v2/apps/${this.APP_ID}/tables/${encodeURIComponent(this.PLAN_TABLE_NAME)}/Action`;

    }

  },

  TIMEZONE: 'Asia/Tokyo',

  LOCALE: 'ja-JP',

  PLAN_ID_HEADER: 'plan_id' // キー列名

};


/**

 * 【公開関数】AppSheet APIを使用してテーブルを一括更新（Edit）する。

 * この関数はフロントエンドスクリプトから呼び出されます。

 * @param {Array<object>} updateRows 更新するRowオブジェクトの配列

 * @returns {Array<object>} 各Rowの更新結果 [{planId, status}]

 */

function updateAppSheetPlanTable(updateRows) {

    if (!updateRows || updateRows.length === 0) {

        return [];

    }

    const endpoint = CONFIG.APPSHEET.getEndpoint();

    const payload = {

        Action: "Edit",

        Properties: {

            Locale: CONFIG.LOCALE,

            Timezone: CONFIG.TIMEZONE

        },

        Rows: updateRows

    };

    const options = {

        method: "post",

        contentType: "application/json",

        headers: {

            // APIキーはサーバーサイドでのみ使用されます

            "ApplicationAccessKey": CONFIG.APPSHEET.ACCESS_KEY

        },

        payload: JSON.stringify(payload),

        muteHttpExceptions: true

    };

    console.log(`[Library] AppSheet APIリクエスト送信 (${updateRows.length}件)`);

    // 結果オブジェクトの初期化

    const results = updateRows.map(row => ({

        planId: row[CONFIG.PLAN_ID_HEADER],

        status: 'Error: Unknown'

    }));

    try {

        const response = UrlFetchApp.fetch(endpoint, options);

        const responseCode = response.getResponseCode();

        const responseBody = response.getContentText();

        if (responseCode === 200) {

            console.log("[Library] AppSheet APIリクエスト成功。");

            results.forEach(r => r.status = 'Success');

        } else {

            console.error(`[Library] AppSheet APIリクエスト失敗。Code: ${responseCode}. Response: ${responseBody.substring(0, 500)}...`);

            let errorReason = `Error: HTTP ${responseCode}`;

            if (responseCode === 400 && (responseBody.includes("is not found") || responseBody.includes("key"))) {

                errorReason = 'Error: Record/Key Not Found in AppSheet';

            } else {

                errorReason = `Error: HTTP ${responseCode} (See logs)`;

            }

            results.forEach(r => r.status = errorReason);

        }

    } catch (e) {

        console.error("[Library] AppSheet API呼び出し中に例外が発生しました。", e);

        results.forEach(r => r.status = `Error: Exception - ${e.message}`);

    }

    return results;

}
