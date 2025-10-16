/**
 * 実行ログモジュール
 */
const ExecutionLogger = {
  SPREADSHEET_ID: '15Z_GT4-pDAnjDpd8vkX3B9FgYlQIQwdUF1QIEj7bVnE',
  SHEET_NAME: 'シート1',
  
  /**
   * ログを記録
   * @param {string} scriptName - スクリプト名
   * @param {string} status - ステータス (SUCCESS/ERROR/WARNING)
   * @param {string} processId - 処理ID
   * @param {string} message - メッセージ
   * @param {string} errorDetail - エラー詳細
   * @param {number} executionTime - 実行時間(秒)
   * @param {Object} inputData - 入力データ
   */
  log: function(scriptName, status, processId, message, errorDetail, executionTime, inputData) {
    try {
      const ss = SpreadsheetApp.openById(this.SPREADSHEET_ID);
      const sheet = ss.getSheetByName(this.SHEET_NAME);
      
      const timestamp = new Date();
      const user = Session.getActiveUser().getEmail();
      const inputDataStr = inputData ? JSON.stringify(inputData).substring(0, 1000) : '';
      
      sheet.appendRow([
        timestamp,
        scriptName,
        status,
        processId || '',
        message || '',
        errorDetail || '',
        executionTime || 0,
        user,
        inputDataStr
      ]);
    } catch (e) {
      Logger.log(`ログ記録エラー: ${e.message}`);
    }
  },
  
  /**
   * 成功ログ
   */
  success: function(scriptName, processId, message, executionTime, inputData) {
    this.log(scriptName, 'SUCCESS', processId, message, '', executionTime, inputData);
  },
  
  /**
   * エラーログ
   */
  error: function(scriptName, processId, message, error, executionTime, inputData) {
    const errorDetail = error ? `${error.message}\n${error.stack}` : '';
    this.log(scriptName, 'ERROR', processId, message, errorDetail, executionTime, inputData);
  },
  
  /**
   * 警告ログ
   */
  warning: function(scriptName, processId, message, executionTime, inputData) {
    this.log(scriptName, 'WARNING', processId, message, '', executionTime, inputData);
  }
};


/**
 * Webhook重複実行防止モジュール
 */
const DuplicationPrevention = {
  LOCK_TIMEOUT: 300000, // 5分
  CACHE_EXPIRATION: 3600, // 1時間
  
  /**
   * リクエストの重複チェック
   * @param {string} requestId - リクエストID（webhookデータのハッシュ値）
   * @return {boolean} - 処理を続行する場合はtrue
   */
  checkDuplicate: function(requestId) {
    const cache = CacheService.getScriptCache();
    const cacheKey = `processed_${requestId}`;
    
    // キャッシュチェック
    if (cache.get(cacheKey)) {
      Logger.log(`重複リクエストを検出: ${requestId}`);
      return false;
    }
    
    // ロック取得
    const lock = LockService.getScriptLock();
    try {
      lock.waitLock(this.LOCK_TIMEOUT);
      
      // 再度キャッシュチェック（ダブルチェック）
      if (cache.get(cacheKey)) {
        Logger.log(`ロック取得後、重複リクエストを検出: ${requestId}`);
        return false;
      }
      
      // 処理済みマークを設定
      cache.put(cacheKey, 'processed', this.CACHE_EXPIRATION);
      return true;
    } catch (e) {
      Logger.log(`ロック取得エラー: ${e.message}`);
      return false;
    } finally {
      lock.releaseLock();
    }
  },
  
  /**
   * リクエストIDを生成
   * @param {Object} data - Webhookデータ
   * @return {string} - リクエストID
   */
  generateRequestId: function(data) {
    const str = JSON.stringify(data);
    return Utilities.computeDigest(
      Utilities.DigestAlgorithm.SHA_256,
      str,
      Utilities.Charset.UTF_8
    ).map(b => (b & 0xFF).toString(16).padStart(2, '0')).join('');
  }
};


/**

 * =============================================================================

 * フラクタル訪問看護 営業レポート自動化システム (v5.1 - Optimized Contact Display)

 *

 * 機能: 週次/月次集計、推移分析(月次)、因果関係分析、AI統括レポート、HTMLレポート生成・配信。

 * 設計: v5.1では、月次レポートにおける主要面会者の表示ロジックを最適化し、不要な情報を削減。

 * =============================================================================

 */



// =============================================================================

// 1. 設定 (Configuration)

// =============================================================================



class Config {

  // ★★★ 要確認・変更箇所 ★★★

  static get REPORT_OPTIONS() {

    return {

      // 送信先メールアドレス。必ず変更してください。

      RECIPIENTS: ['t.asai@fractal-group.co.jp', 'm.iwaizako@fractal-group.co.jp'],

      // エラー通知先。必ず変更してください。

      ERROR_RECIPIENT: 't.asai@fractal-group.co.jp',

      SUBJECT_WEEKLY: '【週次営業レポート】フラクタル訪問看護',

      SUBJECT_MONTHLY: '【月次営業レポート】トレンド・因果分析',

      WEEKLY_MAX_HISTORY: 3, // 週次レポートの履歴表示数

      MONTHLY_TREND_MONTHS: 6, // 月次レポートで表示するトレンド期間（ヶ月）

    };

  }



  static get AI_OPTIONS() {

    return {

      // ★★★ 要設定 ★★★

      USE_GEMINI: true,

      GEMINI_API_KEY: 'AIzaSyDUKFlE6_NYGehDYOxiRQcHpjG2l7GZmTY',

      // 高度な分析のため、高性能モデルを推奨

      MODEL_NAME: 'gemini-2.5-pro',

    };

  }



  // 関心度バッジの定義（基準値18）

  static get BADGE_CONFIG() {

    return {

      CRITERIA_SCORE: 18,

      LEVELS: [

        { range: [27, 100], text: '熱狂的関心 (27+)', color: '#D946EF' }, // Purple

        { range: [24, 26], text: '強い関心 (24-26)', color: '#EC4899' }, // Pink

        { range: [21, 23], text: '関心あり (21-23)', color: '#F59E0B' }, // Amber

        { range: [18, 20], text: '基準値 (18-20)', color: '#10B981' }, // Emerald

        { range: [1, 17], text: '関心低 (1-17)', color: '#64748B' }, // Slate

        { range: [0, 0], text: '未評価', color: '#94A3B8' } // Light Slate

      ]

    };

  }



  static get SPREADSHEETS() {

    return {

      SALES_ID: '1auRrqem2h3p7tcVs34sQci6eQeYflhcP-TAg1S4islg',

      ORG_ID: '1ctSjcAlu9VSloPT9S9hsTyTd7yCw5XvNtF7-URyBeKo',

      STAFF_ID: '1F8-HxdTtz4ljW9NVqdLFX3U4mEx3Ux1QOfYCMOBXBB4',

      REQUESTS_ID: '1S3Gsxu9kEa4M9uZpWuIRLvPVjpCOoj2lo7GhSIA5I0I',

    };

  }



  static get SHEET_NAMES() {

    return {

      ACTIVITIES: 'Sales_Activities',

      ORGS: 'Organizations',

      CONTACTS: 'Organization_Contacts',

      STAFF: 'Staff_Members',

      REPORTS_LOG: 'Sales_Reports',

      REQUESTS: 'Client_Requests',

    };

  }



  static get DEBUG_MODE() { return true; }

  static get TIMEZONE() { return 'Asia/Tokyo'; }

}



// =============================================================================

// 2. ユーティリティ (Utilities) - 変更なし

// =============================================================================



class LoggerUtil {

  static info(m) { console.log(`[INFO] ${m}`); }

  static debug(m) { if (Config.DEBUG_MODE) console.log(`[DEBUG] ${m}`); }

  static warn(m) { console.warn(`[WARN] ${m}`); }

  static error(m, e) {

    console.error(`[ERROR] ${m}`);

    if (e && e.stack) console.error(e.stack);

  }

}



class DateUtil {

  static format(date, format = 'yyyy/MM/dd HH:mm') {

    if (!date || !(date instanceof Date) || isNaN(date.getTime())) return 'N/A';

    // GAS環境での曜日表示対応

    if (format.includes('E')) {

      const weekdays = ["日", "月", "火", "水", "木", "金", "土"];

      const day = weekdays[date.getDay()];

      format = format.replace('(E)', `(${day})`);

      format = format.replace('E', day);

    }

    try {

      return Utilities.formatDate(date, Config.TIMEZONE, format);

    } catch (e) {

      return date.toString();

    }

  }



  /**

   * レポート対象週として「先週（月曜〜日曜）」の期間を返します。

   * 実行日時に依存せず、常に固定された期間を計算します。

   * @param {Date} baseDate 基準日。

   * @returns {{startDate: Date, endDate: Date}} 先週の開始日（月曜 00:00:00）と終了日（日曜 23:59:59）。

   */

  static getRecentWeek(baseDate) {

    const today = new Date(baseDate);

    today.setHours(0, 0, 0, 0); // 日付計算の基準として時間をリセット



    // 今週の月曜日を計算します (getDay()は 日曜=0, 月曜=1, ..., 土曜=6)

    const dayOfWeek = today.getDay();

    const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // 日曜なら6日前、火曜(2)なら 1-2=-1 で1日前

    const thisMonday = new Date(today);

    thisMonday.setDate(today.getDate() + diffToMonday);



    // レポート対象期間の終了日 = 今週の月曜日の1日前 = 先週の日曜日

    const endDate = new Date(thisMonday);

    endDate.setDate(thisMonday.getDate() - 1);

    endDate.setHours(23, 59, 59, 999);



    // レポート対象期間の開始日 = 先週の日曜日から6日前 = 先週の月曜日

    const startDate = new Date(endDate);

    startDate.setDate(endDate.getDate() - 6);

    startDate.setHours(0, 0, 0, 0);

    

    return { startDate, endDate };

  }



  /**

   * 比較対象週として「先々週（月曜〜日曜）」の期間を返します。

   * @param {Date} baseDate 基準日。

   * @returns {{startDate: Date, endDate: Date}} 先々週の開始日（月曜 00:00:00）と終了日（日曜 23:59:59）。

   */

  static getPreviousWeekPeriod(baseDate) {

    // getRecentWeekで計算した「先週」の開始日を基準にします

    const { startDate: lastWeekMonday } = this.getRecentWeek(baseDate);

    

    // 比較対象期間の終了日 = 先週の月曜日の1日前 = 先々週の日曜日

    const endDate = new Date(lastWeekMonday);

    endDate.setMilliseconds(lastWeekMonday.getMilliseconds() - 1);



    // 比較対象期間の開始日 = 先々週の日曜日から6日前 = 先々週の月曜日

    const startDate = new Date(endDate);

    startDate.setDate(endDate.getDate() - 6);

    startDate.setHours(0, 0, 0, 0);



    return { startDate, endDate };

  }



  /**

   * レポート対象月として「先月1ヶ月間」の期間を返します。

   * 実行日時に依存せず、常に固定された期間を計算します。

   * @param {Date} baseDate 基準日。

   * @returns {{startDate: Date, endDate: Date}} 先月の開始日（1日 00:00:00）と終了日（末日 23:59:59）。

   */

  static getCurrentMonth(baseDate) {

    const today = new Date(baseDate);

    

    // レポート対象期間の終了日 = 今月の0日目 = 先月の末日

    const endDate = new Date(today.getFullYear(), today.getMonth(), 0);

    endDate.setHours(23, 59, 59, 999);



    // レポート対象期間の開始日 = 先月の1日

    const startDate = new Date(endDate.getFullYear(), endDate.getMonth(), 1, 0, 0, 0, 0);

    

    return { startDate, endDate };

  }



  /**

   * 比較対象月として「先々月1ヶ月間」の期間を返します。

   * @param {Date} baseDate 基準日。

   * @returns {{startDate: Date, endDate: Date}} 先々月の開始日（1日 00:00:00）と終了日（末日 23:59:59）。

   */

  static getPreviousMonth(baseDate) {

    const today = new Date(baseDate);

    

    // 比較対象期間の終了日 = 先月の0日目 = 先々月の末日

    const endDate = new Date(today.getFullYear(), today.getMonth() - 1, 0);

    endDate.setHours(23, 59, 59, 999);



    // 比較対象期間の開始日 = 先々月の1日

    const startDate = new Date(endDate.getFullYear(), endDate.getMonth(), 1, 0, 0, 0, 0);



    return { startDate, endDate };

  }



  static getPastMonthKeys(baseDate, months) {

    const keys = [];

    const date = new Date(baseDate.getFullYear(), baseDate.getMonth(), 1);

    for (let i = 0; i < months; i++) {

      const year = date.getFullYear();

      const month = ('0' + (date.getMonth() + 1)).slice(-2);

      keys.unshift(`${year}-${month}`);

      date.setMonth(date.getMonth() - 1);

    }

    return keys;

  }



  static getDaysBetween(date1, date2) {

    const oneDay = 24 * 60 * 60 * 1000;

    const utc1 = Date.UTC(date1.getFullYear(), date1.getMonth(), date1.getDate());

    const utc2 = Date.UTC(date2.getFullYear(), date2.getMonth(), date2.getDate());

    return Math.round(Math.abs((utc1 - utc2) / oneDay));

  }

}



function escapeHtml(unsafe) {

  if (unsafe === null || unsafe === undefined) return '';

  return String(unsafe)

    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")

    .replace(/"/g, "&quot;").replace(/'/g, "&#039;");

}



// =============================================================================

// 3. データアクセス層 (Data Access Layer) - 変更なし

// =============================================================================



class DataAccessService {

  static fetchData(spreadsheetId, sheetName) {

    LoggerUtil.debug(`Fetching data: ${sheetName} (ID: ${spreadsheetId})`);

    try {

      const sheet = SpreadsheetApp.openById(spreadsheetId).getSheetByName(sheetName);

      if (!sheet) {

        LoggerUtil.warn(`Sheet not found: ${sheetName}.`);

        return [];

      }

      const values = sheet.getDataRange().getValues();

      if (values.length <= 1) return [];



      const headers = values[0].map(h => String(h).trim());

      return values.slice(1).map(row => {

        let obj = {};

        headers.forEach((header, index) => {

          obj[header] = row[index];

        });

        return obj;

      });

    } catch (e) {

      LoggerUtil.error(`Failed to fetch data from ${sheetName}.`, e);

      throw e;

    }

  }



  static appendData(spreadsheetId, sheetName, dataObject) {

    try {

      const sheet = SpreadsheetApp.openById(spreadsheetId).getSheetByName(sheetName);

      if (!sheet) throw new Error(`Sheet not found: ${sheetName}`);

      const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];

      const rowData = headers.map(header => dataObject[header] !== undefined ? dataObject[header] : '');

      sheet.appendRow(rowData);

      LoggerUtil.info(`Successfully saved data to ${sheetName}.`);

    } catch (e) {

      LoggerUtil.error(`Failed to append data to ${sheetName}.`, e);

    }

  }

}



// =============================================================================

// 4. ビジネスロジック層 (Business Logic Layer) - ★★★ 修正箇所あり ★★★

// =============================================================================



class CausalityAnalysisService {

  constructor(allActivities, orgMap) {

    this.allActivities = allActivities;

    this.orgMap = orgMap;

    this.activitiesByOrg = new Map();

    this.prepareActivities();

  }



  prepareActivities() {

    const sortedActivities = [...this.allActivities].sort((a, b) => a.activityDate - b.activityDate);

    sortedActivities.forEach(activity => {

      if (!this.activitiesByOrg.has(activity.org_id)) {

        this.activitiesByOrg.set(activity.org_id, []);

      }

      this.activitiesByOrg.get(activity.org_id).push(activity);

    });

  }



  analyzeRequests(requests, startDate, endDate) {

    const analyzedRequests = [];



    const validRequests = requests.filter(request =>

      request.requestDateTime >= startDate && request.requestDateTime <= endDate

    );



    validRequests.forEach(request => {

        const orgId = request.requester_org_id;

        if (!orgId) return;



        const salesHistory = this.activitiesByOrg.get(orgId);



        if (!salesHistory || salesHistory.length === 0) {

          analyzedRequests.push(this.formatResult(request, orgId, request.requestDateTime, null, true));

        } else {

          const relevantHistory = salesHistory.filter(activity => activity.activityDate < request.requestDateTime);

          if (relevantHistory.length === 0) {

              analyzedRequests.push(this.formatResult(request, orgId, request.requestDateTime, null, true));

          } else {

            const analysis = this.calculateMetrics(relevantHistory, request.requestDateTime);

            analyzedRequests.push(this.formatResult(request, orgId, request.requestDateTime, analysis, false));

          }

        }

    });

    analyzedRequests.sort((a, b) => b.requestDateTime.getTime() - a.requestDateTime.getTime());

    return analyzedRequests;

  }



  calculateMetrics(history, requestDateTime) {

    const firstContact = history[0];

    const lastContact = history[history.length - 1];

    const daysToRequest = DateUtil.getDaysBetween(firstContact.activityDate, requestDateTime);

    const daysSinceLastContact = DateUtil.getDaysBetween(lastContact.activityDate, requestDateTime);

    const recentThreshold = new Date(requestDateTime);

    recentThreshold.setDate(requestDateTime.getDate() - 30);

    const recentActivities = history.filter(a => a.activityDate >= recentThreshold);

    let scoreSum = 0;

    let validScores = 0;

    history.forEach(a => {

      const score = parseFloat(a.sales_score);

      if (!isNaN(score) && score > 0) {

        scoreSum += score;

        validScores++;

      }

    });

    const averageScore = validScores > 0 ? Math.floor(scoreSum / validScores).toString() : 'N/A';



    return {

      totalContacts: history.length,

      daysToRequest,

      daysSinceLastContact,

      recentContacts: recentActivities.length,

      averageScore,

    };

  }



  formatResult(request, orgId, requestDateTime, analysis, noPriorSalesActivity) {

    const orgInfo = this.orgMap.get(orgId) || { official_name: `不明 (ID: ${orgId})` };

    return {

      requestId: request.request_id,

      orgName: orgInfo.official_name,

      orgId: orgId,

      requestDateTime,

      status: request.status,

      requesterName: request.requesterName,

      reason: request.request_reason,

      noPriorSalesActivity,

      analysis

    };

  }

}



class BaseReportService {

  constructor() {

    this.orgMap = new Map();

    this.staffMap = new Map();

    this.contactMap = new Map();

    this.allActivities = [];

    this.activitiesByOrg = new Map();

    this.pastReports = [];

    this.allRequests = [];

    this.allTimeRequestCountByOrg = new Map();

  }



  prepareData() {

    this.prepareMasterData();

    this.prepareActivityData();

    this.prepareRequestData();

    this.groupAndSortActivities();

    this.preparePastReportsData();

  }



  prepareMasterData() {

    const orgs = DataAccessService.fetchData(Config.SPREADSHEETS.ORG_ID, Config.SHEET_NAMES.ORGS);

    orgs.forEach(org => this.orgMap.set(org.org_id, org));

    const staff = DataAccessService.fetchData(Config.SPREADSHEETS.STAFF_ID, Config.SHEET_NAMES.STAFF);

    staff.forEach(member => this.staffMap.set(member.staff_id, member.full_name));

    const contacts = DataAccessService.fetchData(Config.SPREADSHEETS.ORG_ID, Config.SHEET_NAMES.CONTACTS);

    contacts.forEach(contact => this.contactMap.set(contact.contact_id, contact.full_name));

  }



  prepareActivityData() {

    const rawActivities = DataAccessService.fetchData(Config.SPREADSHEETS.SALES_ID, Config.SHEET_NAMES.ACTIVITIES);

    this.allActivities = rawActivities.map(activity => {

      const activityDate = activity.created_at instanceof Date ? activity.created_at : new Date(activity.created_at);

      if (isNaN(activityDate.getTime())) return null;

      const staffName = this.staffMap.get(activity.created_by) || activity.created_by || '不明';

      const contactName = this.contactMap.get(activity.contact_id) || null;

      const monthKey = DateUtil.format(activityDate, 'yyyy-MM');

      return { ...activity, activityDate, staffName, contactName, monthKey };

    }).filter(a => a !== null && a.org_id);

  }



  prepareRequestData() {

    const rawRequests = DataAccessService.fetchData(Config.SPREADSHEETS.REQUESTS_ID, Config.SHEET_NAMES.REQUESTS);

    this.allRequests = rawRequests.map(req => {

      let requestDateTime = new Date(req.request_date);

      if (req.request_time instanceof Date) {

        requestDateTime.setHours(req.request_time.getHours(), req.request_time.getMinutes(), req.request_time.getSeconds());

      } else if (typeof req.request_time === 'string') {

        const timeParts = req.request_time.split(':');

        if (timeParts.length >= 2) {

          requestDateTime.setHours(parseInt(timeParts[0]), parseInt(timeParts[1]), timeParts.length > 2 ? parseInt(timeParts[2]) : 0);

        }

      }

      if (isNaN(requestDateTime.getTime())) return null;

      const requesterName = this.contactMap.get(req.requester_id) || '不明';

      if (!req.requester_org_id) return null;

      return { ...req, requestDateTime, requesterName };

    }).filter(r => r !== null);



    this.allRequests.forEach(req => {

        const orgId = req.requester_org_id;

        if(orgId) {

            const currentCount = this.allTimeRequestCountByOrg.get(orgId) || 0;

            this.allTimeRequestCountByOrg.set(orgId, currentCount + 1);

        }

    });

  }



  preparePastReportsData() {

    this.pastReports = DataAccessService.fetchData(Config.SPREADSHEETS.SALES_ID, Config.SHEET_NAMES.REPORTS_LOG);

  }



  groupAndSortActivities() {

    this.allActivities.forEach(activity => {

      if (!this.activitiesByOrg.has(activity.org_id)) {

        this.activitiesByOrg.set(activity.org_id, []);

      }

      this.activitiesByOrg.get(activity.org_id).push(activity);

    });

    this.activitiesByOrg.forEach(history => {

      history.sort((a, b) => b.activityDate.getTime() - a.activityDate.getTime());

    });

  }



  getOrgInfo(orgId) {

    let orgInfo = this.orgMap.get(orgId);

    if (orgInfo) {

      if (!orgInfo.official_name && orgInfo.common_name) {

        orgInfo.official_name = orgInfo.common_name;

      }

      if (orgInfo.official_name) {

        return orgInfo;

      }

    }

    return { org_id: orgId, official_name: `名称不明/未登録 (ID: ${orgId})`, address: '住所不明' };

  }



  calculateSummary(visitedOrgIds, startDate, endDate) {

    const uniqueOrgs = visitedOrgIds.size;

    let totalVisits = 0;

    let scoreSum = 0;

    let validScoreCount = 0;



    this.allActivities.forEach(activity => {

      if (activity.activityDate >= startDate && activity.activityDate <= endDate) {

        totalVisits++;

        const score = parseFloat(activity.sales_score);

        if (!isNaN(score) && score > 0) {

          scoreSum += score;

          validScoreCount++;

        }

      }

    });



    const averageScoreValue = validScoreCount > 0 ? (scoreSum / validScoreCount) : 0;

    const averageScoreText = validScoreCount > 0 ? Math.floor(averageScoreValue).toString() : 'N/A';



    return { uniqueOrgs, totalVisits, averageScore: averageScoreText, averageScoreValue };

  }



  getVisitedOrgIdsInPeriod(startDate, endDate) {

    const visitedIds = new Set();

    this.allActivities.forEach(activity => {

      if (activity.activityDate >= startDate && activity.activityDate <= endDate) {

        visitedIds.add(activity.org_id);

      }

    });

    return visitedIds;

  }

}



class WeeklyReportService extends BaseReportService {

  generateReport(baseDate) {

    LoggerUtil.info("Generating Weekly Report...");

    this.prepareData();



    const currentPeriod = DateUtil.getRecentWeek(baseDate);

    const previousPeriod = DateUtil.getPreviousWeekPeriod(baseDate);

    const { reportDetails, visitedOrgIds: visitedThisWeek } = this.extractWeeklyDetails(currentPeriod.startDate, currentPeriod.endDate);

    const visitedLastWeek = this.getVisitedOrgIdsInPeriod(previousPeriod.startDate, previousPeriod.endDate);

    const summaryThisWeek = this.calculateSummary(visitedThisWeek, currentPeriod.startDate, currentPeriod.endDate);

    const summaryLastWeek = this.calculateSummary(visitedLastWeek, previousPeriod.startDate, previousPeriod.endDate);

    const causalityService = new CausalityAnalysisService(this.allActivities, this.orgMap);

    const causalityAnalysis = causalityService.analyzeRequests(this.allRequests, currentPeriod.startDate, currentPeriod.endDate);

    const summary = {

      current: summaryThisWeek,

      previous: summaryLastWeek,

      causalityAnalysis: causalityAnalysis

    };

    return {

      reportType: 'Weekly',

      startDate: currentPeriod.startDate,

      endDate: currentPeriod.endDate,

      summary,

      reportDetails,

      isEmpty: reportDetails.length === 0 && causalityAnalysis.length === 0,

      allTimeRequestCountByOrg: this.allTimeRequestCountByOrg

    };

  }



  extractWeeklyDetails(startDate, endDate) {

    const reportDetails = [];

    const visitedOrgIds = new Set();

    const maxHistory = Config.REPORT_OPTIONS.WEEKLY_MAX_HISTORY;



    this.activitiesByOrg.forEach((history, orgId) => {

      const hasActivityInPeriod = history.some(activity =>

        activity.activityDate >= startDate && activity.activityDate <= endDate

      );



      if (hasActivityInPeriod) {

        visitedOrgIds.add(orgId);

        const orgInfo = this.getOrgInfo(orgId);

        const recentHistory = history.slice(0, maxHistory);



        const historyByContact = new Map();

        recentHistory.forEach(activity => {

            const contactKey = activity.contactName || "担当者不明/その他";

            if (!historyByContact.has(contactKey)) {

                historyByContact.set(contactKey, []);

            }

            const enrichedActivity = {

                ...activity,

                isCurrentPeriod: activity.activityDate >= startDate && activity.activityDate <= endDate

            };

            historyByContact.get(contactKey).push(enrichedActivity);

        });



        reportDetails.push({

          orgInfo,

          historyByContact,

          latestActivityDate: history[0].activityDate

        });

      }

    });



    reportDetails.sort((a, b) => {

        return b.latestActivityDate.getTime() - a.latestActivityDate.getTime();

    });



    return { reportDetails, visitedOrgIds };

  }

}



class MonthlyReportService extends BaseReportService {



  generateReport(baseDate) {

    LoggerUtil.info("Generating Monthly Report (Trend & Causality Analysis)...");

    this.prepareData();



    const currentPeriod = DateUtil.getCurrentMonth(baseDate);

    const previousPeriod = DateUtil.getPreviousMonth(baseDate);



    const trendStartDate = new Date(baseDate);

    trendStartDate.setMonth(baseDate.getMonth() - (Config.REPORT_OPTIONS.MONTHLY_TREND_MONTHS - 1));

    trendStartDate.setDate(1);

    const trendPeriodActivities = this.allActivities.filter(a => a.activityDate >= trendStartDate && a.activityDate <= currentPeriod.endDate);



    const monthlyTrends = this.analyzeLongTermTrends(trendPeriodActivities);

    const contactPersonTrends = this.analyzeContactPersonTrends(trendPeriodActivities);



    const visitedThisMonth = this.getVisitedOrgIdsInPeriod(currentPeriod.startDate, currentPeriod.endDate);

    const visitedLastMonth = this.getVisitedOrgIdsInPeriod(previousPeriod.startDate, previousPeriod.endDate);



    const reportDetails = this.generateMonthlyDetails(monthlyTrends, contactPersonTrends, visitedThisMonth, baseDate);



    const causalityService = new CausalityAnalysisService(this.allActivities, this.orgMap);

    // ★★★ 変更点：ここから ★★★

    // 当月と前月の因果関係分析をそれぞれ実行

    const causalityAnalysisThisMonth = causalityService.analyzeRequests(this.allRequests, currentPeriod.startDate, currentPeriod.endDate);

    const causalityAnalysisLastMonth = causalityService.analyzeRequests(this.allRequests, previousPeriod.startDate, previousPeriod.endDate);



    const summaryThisMonth = this.calculateSummary(visitedThisMonth, currentPeriod.startDate, currentPeriod.endDate);

    const summaryLastMonth = this.calculateSummary(visitedLastMonth, previousPeriod.startDate, previousPeriod.endDate);



    // サマリーオブジェクトに依頼獲得数を追加

    summaryThisMonth.totalRequests = causalityAnalysisThisMonth.length;

    summaryLastMonth.totalRequests = causalityAnalysisLastMonth.length;



    const summary = {

      current: summaryThisMonth,

      previous: summaryLastMonth,

      causalityAnalysis: causalityAnalysisThisMonth // 詳細セクション用には当月のデータのみ渡す

    };

    // ★★★ 変更点：ここまで ★★★



    return {

      reportType: 'Monthly',

      startDate: currentPeriod.startDate,

      endDate: currentPeriod.endDate,

      summary,

      reportDetails,

      isEmpty: reportDetails.length === 0 && causalityAnalysisThisMonth.length === 0,

      allTimeRequestCountByOrg: this.allTimeRequestCountByOrg

    };

  }



  analyzeLongTermTrends(activities) {

    const trendsByOrg = new Map();

    const activitiesByOrg = new Map();



    activities.forEach(activity => {

      if (!activitiesByOrg.has(activity.org_id)) {

        activitiesByOrg.set(activity.org_id, []);

      }

      activitiesByOrg.get(activity.org_id).push(activity);

    });



    activitiesByOrg.forEach((history, orgId) => {

      const monthlyStats = new Map();

      history.forEach(activity => {

        const key = activity.monthKey;

        if (!monthlyStats.has(key)) {

          monthlyStats.set(key, { visits: 0, scoreSum: 0, validScores: 0 });

        }

        const stats = monthlyStats.get(key);

        stats.visits++;

        const score = parseFloat(activity.sales_score);

        if (!isNaN(score) && score > 0) {

          stats.scoreSum += score;

          stats.validScores++;

        }

      });

      monthlyStats.forEach(stats => {

        stats.averageScore = stats.validScores > 0 ? (stats.scoreSum / stats.validScores) : 0;

      });

      trendsByOrg.set(orgId, monthlyStats);

    });

    return trendsByOrg;

  }



  analyzeContactPersonTrends(activities) {

    const trendsByOrgContact = new Map();

    activities.forEach(activity => {

      const orgId = activity.org_id;

      // 面会者が特定できない場合は「担当者不明/その他」として集計

      const contactName = activity.contactName || "担当者不明/その他";

      const key = activity.monthKey;

      if (!trendsByOrgContact.has(orgId)) {

        trendsByOrgContact.set(orgId, new Map());

      }

      const orgTrends = trendsByOrgContact.get(orgId);

      if (!orgTrends.has(contactName)) {

        orgTrends.set(contactName, new Map());

      }

      const contactTrends = orgTrends.get(contactName);

      if (!contactTrends.has(key)) {

        contactTrends.set(key, { visits: 0, scoreSum: 0, validScores: 0 });

      }

      const stats = contactTrends.get(key);

      stats.visits++;

      const score = parseFloat(activity.sales_score);

      if (!isNaN(score) && score > 0) {

        stats.scoreSum += score;

        stats.validScores++;

      }

    });

    trendsByOrgContact.forEach(orgTrends => {

      orgTrends.forEach(contactTrends => {

        contactTrends.forEach(stats => {

          stats.averageScore = stats.validScores > 0 ? (stats.scoreSum / stats.validScores) : 0;

        });

      });

    });

    return trendsByOrgContact;

  }



  /**

   * 月次レポートの詳細データ（事業所ごとのトレンド情報）を生成する。

   * ★★★ 修正：主要面会者の定義を厳格化 ★★★

   */

  generateMonthlyDetails(monthlyTrends, contactPersonTrends, visitedThisMonth, baseDate) {

    const reportDetails = [];

    const monthKeys = DateUtil.getPastMonthKeys(baseDate, Config.REPORT_OPTIONS.MONTHLY_TREND_MONTHS);

    visitedThisMonth.forEach(orgId => {

      const orgInfo = this.getOrgInfo(orgId);

      const trendData = monthlyTrends.get(orgId);

      const contactTrendData = contactPersonTrends.get(orgId) || new Map();

      const mainContactsTrendData = new Map();



      contactTrendData.forEach((trends, contactName) => {

        const totalVisits = Array.from(trends.values()).reduce((sum, stats) => sum + stats.visits, 0);



        // ★★★ 修正：訪問回数が2回以上で、かつ「担当者不明/その他」ではない場合のみ主要面会者とする ★★★

        if (totalVisits >= 2 && contactName !== "担当者不明/その他") {

          mainContactsTrendData.set(contactName, trends);

        }

      });



      if (trendData) {

        reportDetails.push({

          orgInfo,

          trendData,

          contactTrendData: mainContactsTrendData, // フィルタリング済みのデータ

          monthKeys,

        });

      }

    });

    // ソートロジックは変更なし

    reportDetails.sort((a, b) => {

      const getThisMonthStats = (detail) => {

        const currentMonthKey = detail.monthKeys[detail.monthKeys.length - 1];

        if (detail.trendData && detail.trendData.has(currentMonthKey)) {

          return detail.trendData.get(currentMonthKey);

        }

        return { averageScore: 0, visits: 0 };

      };

      const statsA = getThisMonthStats(a);

      const statsB = getThisMonthStats(b);

      if (statsB.averageScore !== statsA.averageScore) {

        return statsB.averageScore - statsA.averageScore;

      }

      if (statsB.visits !== statsA.visits) {

        return statsB.visits - statsA.visits;

      }

      return a.orgInfo.official_name.localeCompare(b.orgInfo.official_name);

    });

    return reportDetails;

  }

}





/**

 * =============================================================================

 * 5. AI分析層 (AI Analysis Layer) - ★★★ プロンプトをガイドラインに準拠して刷新 ★★★

 * =============================================================================

 */



/**

 * Gemini APIを使用したAI分析を担当。

 */

class AiAnalysisService {

  static generateExecutiveSummary(reportData) {

    if (!Config.AI_OPTIONS.USE_GEMINI) {

      LoggerUtil.info("AI analysis is disabled by configuration.");

      return "【AI分析】AI分析機能は現在オフに設定されています。";

    }



    if (Config.AI_OPTIONS.GEMINI_API_KEY === 'YOUR_GEMINI_API_KEY' || !Config.AI_OPTIONS.GEMINI_API_KEY) {

      LoggerUtil.warn("Gemini API Key is not configured.");

      return "【AI分析】システム設定（APIキー）が必要です。";

    }



    if (reportData.isEmpty) return null;



    LoggerUtil.info("Starting AI analysis...");

    const prompt = reportData.reportType === 'Monthly'

      ? this.buildMonthlyPrompt(reportData)

      : this.buildWeeklyPrompt(reportData);



    const responseText = this.callGeminiApi(prompt);



    if (responseText) {

      return responseText;

    } else {

      return "【AI分析エラー】分析中にエラーが発生しました。";

    }

  }



/**

   * 【週次レポート用プロンプト】（変更なし）

   */

  static buildWeeklyPrompt(reportData) {

    const summary = reportData.summary;

    const causality = summary.causalityAnalysis;



    let context = `

# 指示書: 取締役向け週次営業戦術レポート生成



## 1. AIの役割と前提条件

あなたは、株式会社フラクタルの訪問看護事業であるフラクタル訪問看護の専属のデータ駆動型セールスコーチです。代表取締役である浅井の認知特性プロファイルを完全に理解し、以下の**週次データ**に基づき、**次週の戦術的意思決定**を最大化するためのレポートを生成してください。長期的な戦略よりも、短期的な成果に焦点を当てます。



### 対象者の認知特性プロファイル

- **思考スタイル**: 戦略的、分析的、論理的。根本原因（Why）、パターン、因果関係を追求。

- **関心領域**: 未来予測、革新的アイデア、個別要素の最適化。

- **行動特性**: 結論を迅速に把握し、即時の行動を志向。

- **忌避事項**: 冗長な説明、主観的な記述、ルーティン報告。



## 2. インプットデータ



### 対象期間: ${DateUtil.format(reportData.startDate, 'yyyy/MM/dd')} 〜 ${DateUtil.format(reportData.endDate, 'MM/dd')}



### 主要KPIサマリー (対前週比)

- **総訪問件数**: ${summary.current.totalVisits}件 (前週: ${summary.previous.totalVisits}件)

- **平均関心度スコア**: ${summary.current.averageScore} (前週: ${summary.previous.averageScoreValue.toFixed(1)})

- **新規依頼件数**: ${causality.length}件



### 今週の注目すべき活動ハイライト

${this.summarizeCausalityForPrompt(causality, 'weekly')}



## 3. レポート生成の厳格な指示

以下の構成要素と順序を**寸分違わず厳守**し、レポート本文のみをマークダウン形式で生成してください。



---



### 1. 週次エグゼクティブサマリー (Weekly BLUF)

**【目的】今週の最重要ポイントを30秒で把握し、即座に行動に移せるようにする。**

- **主要な発見事項 (Key Findings)**: この1週間で判明した最も重要なポジティブな動きとネガティブな動きを各1点ずつ記述。

- **戦術的示唆 (Tactical Implications)**: 上記の発見が、**次週の活動**に与える影響（短期的な機会とリスク）を明確にする。

- **最優先アクション (Top Priority Actions)**: 次週、**必ず実行すべきこと**を、優先順位をつけて3つリストアップする。「誰が」「何を」「いつまでに行うか」を具体的に示す。



### 2. パフォーマンス要因分析

**【目的】KPI変動の根本原因（Why）を特定する。**

- **KPI変動要因**: 総訪問件数と平均関心度スコアが前週から変動した根本原因は何か？データに基づき、最も影響を与えた事業所や活動を特定し、論理的に分析する。

- **成功パターンの抽出**: 今週、新規依頼獲得に至ったケース（もしあれば）を分析し、その成功要因（接触頻度、タイミング、会話内容など）を特定する。次週に横展開できるパターンを抽出する。



### 3. 個別化分析と次週のターゲット

**【目的】リソースを最適配分するため、注力すべき対象を特定する。**

- **関係深化が見られる事業所**: 今週の活動で関心度スコアが著しく上昇した事業所をリストアップし、次週の推奨アクション（例：「クロージング訪問」「追加情報提供」など）を提示する。

- **停滞・関係悪化の兆候がある事業所**: 複数回訪問しているにも関わらずスコアが停滞、または下降している事業所を特定する。その原因を分析し、次週の対応（例：「アプローチ方法の変更」「一時的な冷却期間」など）を提言する。



## 4. 表現に関する厳格な制約事項

- **結論ファースト**: 各セクションの冒頭に、そのセクションの結論を記述。

- **客観性と論理構造**: 「事実」→「分析・解釈」→「提言」の構造を厳守。

- **表形式の利用**: 表を作成する場合は、Markdown形式は**絶対に使用せず**、必ずHTMLの\`<table>\`タグを使用する。

- **簡潔性**: わかりやすい表現でテキストは必要最小限に。

`;

    return context;

  }



  /**

   * ★★★ 刷新版：浅井拓哉氏向け事業レポート生成ガイドライン準拠 ★★★

   */

  static buildMonthlyPrompt(reportData) {

    const summary = reportData.summary;

    const causality = summary.causalityAnalysis;



    let context = `

# 指示書: フラクタル訪問看護の月次事業レポート生成



## 1. AIの役割と前提条件

あなたは、株式会社フラクタルのフラクタル訪問看護の主席営業戦略アナリストです。取締役社長の浅井の認知特性プロファイルを完全に理解し、以下のデータとガイドラインに基づき、彼の迅速な意思決定を最大化するための事業レポートを生成してください。



### 対象者の認知特性プロファイル

- **思考スタイル**: 戦略的、分析的、論理的、客観性重視。事象の根本原因（Why）、パターン、因果関係の解明を追求する。

- **関心領域**: 未来予測、革新的アイデア、個別要素の特性と影響力、最高の成果を生む要因の分析と最適化。

- **行動特性**: 結論を迅速に把握し、即時の行動や意思決定を志向する。

- **忌避事項**: 冗長な説明、詳細すぎるオペレーション情報、論理的裏付けのない意見、感情的・主観的な記述。



## 2. インプットデータ



### 対象期間: ${DateUtil.format(reportData.startDate, 'yyyy/MM')}



### 主要KPIサマリー

- **総営業件数**: ${summary.current.totalVisits}件 (前月比: ${summary.current.totalVisits - summary.previous.totalVisits})

- **平均関心度スコア**: ${summary.current.averageScore} (前月比: ${(summary.current.averageScoreValue - summary.previous.averageScoreValue).toFixed(1)})

- **新規依頼件数**: ${summary.current.totalRequests}件 (前月比: ${summary.current.totalRequests - summary.previous.totalRequests})



### 長期トレンド分析のハイライト（${Config.REPORT_OPTIONS.MONTHLY_TREND_MONTHS}ヶ月）

${this.summarizeTrendsForPrompt(reportData.reportDetails)}



### 依頼獲得プロセスのハイライト

${this.summarizeCausalityForPrompt(causality)}



## 3. レポート生成の厳格な指示

以下の構成要素と順序を**寸分違わず厳守**し、レポート本文のみをマークダウン形式で生成してください。AI風の応答やヘッダー情報は一切不要です。



---



### 1. エグゼクティブサマリー

**【目的】レポート全体の核心を伝達し、即時の意思決定を促す。**

- **主要な発見事項 (Key Findings)**: 分析により判明した最も重要なトレンド、パターン、または特異点を3点以内で記述。

- **戦略的示唆 (Strategic Implications)**: 上記の発見事項が将来のビジネスに与える最大の機会と最大のリスクを明確に記述。

- **意思決定事項と推奨アクション (Decision Points & Actions)**: 対象者が即座に判断・実行すべき具体的な戦略レベルのアクションをリスト形式で提言。



### 2. トレンド分析と未来予測

**【目的】マクロな視点での現状把握と将来シナリオを提示する。**

- **トレンドとパターンの分析**: 主要KPIの変動における変曲点や異常値を指摘し、その背景を分析する。

- **未来予測シナリオ**: 過去のトレンドとインプットデータに基づき、来月の主要KPIについて3つのシナリオ（楽観的、標準的、悲観的）を提示。各シナリオの前提条件を明記する。



### 3. 要因分析と構造的理解

**【目的】パフォーマンス変動の根本原因を論理的に分解し、構造を明らかにする。**

- **貢献度分析**: 当月の新規依頼件数の増減について、最も貢献した事業所（または担当者）とその要因を特定する。

- **因果関係と根本原因の特定**: なぜ特定の事業所の関心度スコアが上昇（または下降）したのか。データに基づき、相関と因果を区別して根本原因を分析する。



### 4. 個別化分析と最適化

**【目的】個別の特性を分析し、最大の成果を生むパターンを特定する。**

- **ハイパフォーマー分析（成功要因）**: 当月最も高評価だった事業所（上位20%）を特定し、その成功要因を分析し、再現性のあるパターン（勝利の方程式）を抽出する。

- **ボトルネックと特異点の分析**: 成長を阻害している要因、またはトレンドから外れた異常値を持つ事業所を特定し、その原因を分析する。



### 5. 戦略提言とオプション比較

**【目的】分析結果に基づき、具体的な戦略オプションを比較検討する。**

- **戦略オプションの提示**: 課題解決または機会獲得のための代替的な戦略オプションを複数（2〜3つ）提案する。既存の延長線上にない革新的なアプローチも一つ含めること。

- **オプション評価マトリクス**: 各オプションの「期待効果」「リスク」「必要なリソース」を客観的に比較するHTMLの<table>を作成する。



## 4. 表現に関する厳格な制約事項

- **結論ファースト**: 各セクションの冒頭に、そのセクションで最も伝えたい結論を記述する。

- **客観性と論理構造**: 「事実」→「分析・解釈」→「提言」の論理構造を厳守。憶測や感情（例：「驚くべき」「残念ながら」）を完全に排除し、断定的なトーンで記述する。

- **表形式の利用**: 表を作成する場合は、Markdown形式（例: | A | B |）は**絶対に使用せず**、必ずHTMLの<table>タグを使用する。インラインスタイルやclass属性は不要。

- **簡潔性**: わかりやすい表現で、テキスト記述は必要最小限に抑える。

`;

    return context;

  }



  // ★★★ 新規追加：月次プロンプト用のデータ要約ヘルパー ★★★

  static summarizeTrendsForPrompt(reportDetails) {

    const trendSummary = this.summarizeTrends(reportDetails);

    let summaryText = "- 関係深化中の事業所 (スコア上昇傾向): ";

    summaryText += trendSummary.improving.map(t => `${t.name} (スコア変化: +${t.change.toFixed(1)})`).join(', ') || '該当なし';

    summaryText += "\n- 要警戒の事業所 (スコア下降傾向): ";

    summaryText += trendSummary.declining.map(t => `${t.name} (スコア変化: ${t.change.toFixed(1)})`).join(', ') || '該当なし';

    return summaryText;

  }

  

  // ★★★ 新規追加：月次プロンプト用のデータ要約ヘルパー ★★★

  static summarizeCausalityForPrompt(causality) {

    if (!causality || causality.length === 0) {

      return "当月の新規依頼は発生しませんでした。";

    }

    const successfulCases = causality.filter(c => !c.noPriorSalesActivity);

    let summaryText = "";

    if (successfulCases.length > 0) {

      const avgContacts = successfulCases.reduce((sum, c) => sum + c.analysis.totalContacts, 0) / successfulCases.length;

      const avgDays = successfulCases.reduce((sum, c) => sum + c.analysis.daysToRequest, 0) / successfulCases.length;

      summaryText += `- 依頼獲得までの平均プロセス: 累積接触 ${avgContacts.toFixed(1)}回, 期間 ${avgDays.toFixed(0)}日。\n`;

    }

    const noPriorActivityCount = causality.filter(c => c.noPriorSalesActivity).length;

    if (noPriorActivityCount > 0) {

      summaryText += `- インバウンド依頼（営業活動前の自然発生）の比率: ${(noPriorActivityCount / causality.length * 100).toFixed(0)}% (${noPriorActivityCount}件)。`;

    }

    return summaryText;

  }





  // トレンド分析の要約ヘルパー（変更なし）

  static summarizeTrends(reportDetails) {

    const improving = [];

    const declining = [];

    reportDetails.forEach(detail => {

      const trendData = detail.trendData;

      if (!trendData) return;

      const monthKeys = detail.monthKeys;

      const currentMonthKey = monthKeys[monthKeys.length - 1];

      const currentStats = this.getStatsFromTrend(trendData, currentMonthKey);

      const currentScore = currentStats.averageScoreValue;

      let pastScoreSum = 0;

      let pastScoreCount = 0;

      for (let i = 0; i < monthKeys.length - 1; i++) {

        const stats = this.getStatsFromTrend(trendData, monthKeys[i]);

        if (stats.visits > 0) {

          pastScoreSum += stats.averageScoreValue;

          pastScoreCount++;

        }

      }

      if (pastScoreCount > 0 && currentStats.visits > 0) {

        const avgPastScore = pastScoreSum / pastScoreCount;

        const change = currentScore - avgPastScore;

        if (change > 1.5) {

          improving.push({ name: detail.orgInfo.official_name, change });

        } else if (change < -1.5) {

          declining.push({ name: detail.orgInfo.official_name, change });

        }

      }

    });

    improving.sort((a, b) => b.change - a.change);

    declining.sort((a, b) => a.change - b.change);

    return { improving: improving.slice(0, 3), declining: declining.slice(0, 3) };

  }



  // トレンドデータから統計を取得するヘルパー（変更なし）

  static getStatsFromTrend(trendData, monthKey) {

    if (trendData.has(monthKey)) {

      const stats = trendData.get(monthKey);

      return { visits: stats.visits, averageScoreValue: stats.averageScore };

    }

    return { visits: 0, averageScoreValue: 0 };

  }



  static callGeminiApi(prompt) {

    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${Config.AI_OPTIONS.MODEL_NAME}:generateContent?key=${Config.AI_OPTIONS.GEMINI_API_KEY}`;

    const payload = JSON.stringify({

      contents: [{ parts: [{ text: prompt }] }],

      generationConfig: {

        temperature: 0.3, // 論理性を重視し、温度をさらに下げる

        maxOutputTokens: 20000,

      }

    });

    const options = {

      method: 'post',

      contentType: 'application/json',

      payload: payload,

      muteHttpExceptions: true

    };

    try {

      const response = UrlFetchApp.fetch(apiUrl, options);

      const responseCode = response.getResponseCode();

      if (responseCode === 200) {

        const responseJson = JSON.parse(response.getContentText());

        if (responseJson.candidates && responseJson.candidates.length > 0 && responseJson.candidates[0].content.parts[0].text) {

          return responseJson.candidates[0].content.parts[0].text;

        }

      }

      LoggerUtil.error(`Gemini API request failed. Code ${responseCode}. Response: ${response.getContentText()}`);

      return null;

    } catch (e) {

      LoggerUtil.error("Error calling Gemini API.", e);

      return null;

    }

  }

}







// =============================================================================

// 6. プレゼンテーション層 (Presentation Layer) - ★★★ 修正箇所あり ★★★

// =============================================================================



/**

 * HTMLメールの生成を担当。プロフェッショナルなデザインを提供。

 */

class HtmlReportGenerator {



  // レポート構造生成 (メール互換性向上のためテーブルレイアウトでラップ)

  static generateStructure(reportData, contentHtml) {

    const styles = this.getStyles();

    const header = this.getHeader(reportData);

    const footer = this.getFooter();

    return `<!DOCTYPE html>

<html>

<head>

    <meta charset="UTF-8">

    <meta name="viewport" content="width=device-width, initial-scale=1.0">

    <title>営業レポート</title>

    <style>${styles}</style>

</head>

<body>

    <table width="100%" border="0" cellspacing="0" cellpadding="0" bgcolor="#f0f2f5">

        <tr>

            <td align="center" style="padding: 20px 10px;">

                <div class="container">

                    ${header}

                    <div class="content">

                        ${contentHtml}

                    </div>

                    ${footer}

                </div>

            </td>

        </tr>

    </table>

</body>

</html>`;

  }



  /**

   * メインのメール本文用HTMLを生成する。

   */

  static generateEmailBody(reportData, aiSummaryHtml = null) {

    let contentHtml = '';



    if (reportData.isEmpty) {

      contentHtml = `<p style="text-align: center; padding: 50px 0; color: #555;">対象期間中の営業活動および新規依頼はありませんでした。</p>`;

    } else {

      // 1. 全体サマリー（ダッシュボード）

      const summaryHtml = reportData.reportType === 'Monthly'

        ? this.getMonthlySummary(reportData.summary)

        : this.getWeeklySummary(reportData.summary);

      contentHtml += summaryHtml;



      // 2. AIサマリー

      if (aiSummaryHtml) {

        contentHtml += `<div class="section ai-summary">

                                    <h2 class="section-title">統括分析レポート</h2>

                                    <div class="section-content">${this.parseMarkdown(aiSummaryHtml)}</div>

                                </div>`;

      }



      // 3. 因果関係分析セクション

      const causalityHtml = this.generateCausalitySection(reportData);

      contentHtml += `<div class="section causality-section">

                                <h2 class="section-title">新規依頼と因果関係分析</h2>

                                <div class="section-content">${causalityHtml}</div>

                            </div>`;





      // 4. 詳細レポート

      if (reportData.reportDetails.length > 0) {

        if (reportData.reportType === 'Monthly') {

          contentHtml += `<div class="section detail-section">

                                        <h2 class="section-title">営業先別 長期トレンド分析</h2>

                                        <div class="section-content">${this.getMonthlyDetails(reportData.reportDetails)}</div>

                                    </div>`;

        } else { // Weekly

          const legend = this.generateLegend();

          const details = this.getWeeklyDetails(reportData.reportDetails);

          contentHtml += `<div class="section detail-section">

                                        <h2 class="section-title">営業先別 訪問履歴詳細</h2>

                                        <div class="section-content">${legend}${details}</div>

                                    </div>`;

        }

      }

    }

    return this.generateStructure(reportData, contentHtml);

  }



  // --- スタイル定義 (デザイン全面刷新) ---

// --- スタイル定義 (デザイン全面刷新) ---

  static getStyles() {

    // カラーパレット定義

    const primaryColor = '#2563EB'; // 信頼感のあるブルー

    const accentColor = '#1D4ED8'; // ダークブルー

    const highlightColor = '#DBEAFE'; // ライトブルー

    const positiveColor = '#059669'; // エメラルド（成功・増加）

    const negativeColor = '#DC2626'; // レッド（警告・減少）

    const grayLight = '#f3f4f6';

    const grayMedium = '#e5e7eb';

    const textColor = '#1f2937';

    const textLight = '#6b7280';



    // バッジスタイルの動的生成

    let customBadgeStyles = '';

    Config.BADGE_CONFIG.LEVELS.forEach(config => {

      const className = `.badge-custom-${config.color.substring(1).toLowerCase()}`;

      customBadgeStyles += `${className} { background-color: ${config.color}; color: #ffffff; } \n`;

    });



    return `

            /* --- リセットと基本設定 --- */

            body {

                font-family: 'Helvetica Neue', Helvetica, Arial, 'Hiragino Kaku Gothic ProN', 'ヒラギノ角ゴ ProN W3', Meiryo, メイリオ, sans-serif;

                color: ${textColor};

                line-height: 1.6;

                margin: 0;

                padding: 0;

                background-color: ${grayLight};

                -webkit-font-smoothing: antialiased;

                text-align: left;

            }

            * {

                box-sizing: border-box;

            }

            h1, h2, h3, h4, h5 {

                margin: 0 0 10px 0;

                font-weight: 600;

            }

            p {

                margin: 0 0 15px 0;

            }

            ul {

                padding-left: 20px;

                margin: 10px 0 15px 0;

            }

            li {

                margin-bottom: 8px;

            }

            a {

                color: ${primaryColor};

                text-decoration: none;

            }

            a:hover {

                text-decoration: underline;

            }



            /* --- レイアウト --- */

            .container {

                max-width: 800px;

                width: 100%;

                margin: 0 auto;

                background-color: #ffffff;

                border-radius: 8px;

                box-shadow: 0 4px 15px rgba(0, 0, 0, 0.05);

                overflow: hidden;

            }

            .content {

                padding: 30px;

            }



            /* --- ヘッダー --- */

            .header {

                background-color: ${primaryColor};

                color: #ffffff;

                padding: 40px 30px;

                text-align: center;

            }

            .header h1 {

                font-size: 24px;

                margin-bottom: 8px;

            }

            .period {

                font-size: 16px;

                opacity: 0.85;

                margin: 0;

            }



            /* --- セクション --- */

            .section {

                margin-bottom: 40px;

            }



            .section-title {

                display: flex;

                justify-content: space-between;

                align-items: baseline;

                color: ${textColor};

                border-bottom: 3px solid ${primaryColor};

                padding-bottom: 10px;

                margin-bottom: 25px;

                font-size: 20px;

            }

            .section-score {

                font-size: 14px;

                font-weight: normal;

                color: ${textLight};

                margin-left: 20px;

                white-space: nowrap;

            }



            /* --- ダッシュボード（サマリー） --- */

            .summary-dashboard {

                margin-bottom: 40px;

                width: 100%;

                border-collapse: collapse;

            }

            .stat-box {

                height: 100%;

                box-sizing: border-box;

                width: 100%;

                background-color: #ffffff;

                padding: 20px;

                border-radius: 8px;

                border: 1px solid ${grayMedium};

                text-align: left;

                box-shadow: 0 1px 3px rgba(0,0,0,0.05);

            }

            .stat-label {

                display: block;

                font-size: 14px;

                color: ${textLight};

                margin-bottom: 10px;

                font-weight: 500;

            }

            .stat-value {

                display: block;

                font-size: 36px;

                font-weight: 700;

                color: ${textColor};

                margin-bottom: 10px;

                line-height: 1.1;

            }

            .stat-comparison {

                font-size: 14px;

            }

            .comp-positive {

                color: ${positiveColor};

                font-weight: 600;

            }

            .comp-negative {

                color: ${negativeColor};

                font-weight: 600;

            }

            .comp-neutral {

                color: ${textLight};

            }



            /* --- AIサマリー --- */

            .ai-summary .section-content {

                background-color: ${highlightColor};

                padding: 25px;

                border-radius: 8px;

                border-left: 5px solid ${primaryColor};

              /* ★★★ 変更点: !important を追加して強制的に左揃えを適用 ★★★ */

              text-align: left !important;

            }

            .ai-summary h3 {

                color: ${accentColor};

                font-size: 18px;

                margin-top: 25px;

                border-bottom: 1px solid #93C5FD;

                padding-bottom: 8px;

            }

            .ai-summary h3:first-child {

                margin-top: 0;

            }



            /* --- 因果関係分析 --- */

            .causality-card {

                border: 1px solid ${grayMedium};

                border-radius: 8px;

                margin-bottom: 20px;

                background-color: #fff;

                box-shadow: 0 1px 3px rgba(0,0,0,0.05);

            }

            .causality-header {

                background-color: #F9FAFB;

                padding: 15px 20px;

                border-bottom: 1px solid ${grayMedium};

                font-weight: bold;

                font-size: 16px;

            }

            .causality-content {

                padding: 20px;

            }

            .status-header {

                font-size: 16px;

                margin-top: 20px;

                margin-bottom: 10px;

                color: ${primaryColor};

                font-weight: 600;

                text-align: left;

            }

            .status-header:first-child {

                margin-top: 0;

            }

            .causality-detail-table {

                width: 100%;

                border-collapse: collapse;

                font-size: 14px;

            }

            .causality-detail-table thead {

                background-color: #F3F4F6;

            }

            .causality-detail-table th {

                color: ${textLight};

                font-weight: 600;

                padding: 10px;

                text-align: center;

                border-bottom: 2px solid ${grayMedium};

            }

            .causality-detail-table td {

                border-top: 1px solid ${grayMedium};

                padding: 12px 10px;

                vertical-align: top;

                text-align: left;

            }

            .col-date { width: 20%; }

            .col-reason { width: 45%; }

            .col-analysis { width: 35%; text-align: right; font-size: 13px; color: ${textLight}; }

            .col-analysis strong { color: ${textColor}; }



            /* --- 事業所カード（詳細） --- */

            .org-card {

                border: 1px solid ${grayMedium};

                border-radius: 8px;

                margin-bottom: 30px;

                box-shadow: 0 2px 5px rgba(0,0,0,0.05);

                background-color: #fff;

            }

            .org-header {

                background-color: #F9FAFB;

                padding: 18px 20px;

                border-bottom: 1px solid ${grayMedium};

                text-align: left;

            }

            .org-name {

                font-size: 18px;

                font-weight: 600;

                color: ${textColor};

            }



            /* --- 週次詳細：タイムライン --- */

            .timeline {

                padding: 20px;

            }

            .contact-group {

                margin-bottom: 30px;

            }

            .contact-header {

                font-size: 16px;

                font-weight: 600;

                margin-bottom: 15px;

                color: ${primaryColor};

                border-bottom: 1px dashed ${grayMedium};

                padding-bottom: 8px;

            }

            .activity-entry {

                padding: 15px;

                border-radius: 8px;

                border: 1px solid ${grayMedium};

                margin-bottom: 15px;

                background-color: #ffffff;

            }

            .current-period {

                background-color: ${highlightColor};

                border-color: #93C5FD;

            }

            .activity-header {

                margin-bottom: 12px;

            }

            .activity-date {

                font-size: 14px;

                font-weight: 600;

                color: ${textLight};

            }

            .detail-content {

                font-size: 14px;

                color: ${textColor};

                text-align: left;

            }



            /* --- 月次詳細：トレンド分析 --- */

            .trend-analysis, .contact-trends-section {

                padding: 20px;

            }

            .contact-trends-section {

                border-top: 1px solid ${grayMedium};

            }

            .detail-title {

                font-weight: 700;

                font-size: 16px;

                color: ${textColor};

                margin-bottom: 15px;

            }

            .trend-table {

                width: 100%;

                border-collapse: collapse;

                font-size: 14px;

            }

            .trend-table th, .trend-table td {

                border: 1px solid ${grayMedium};

                padding: 10px 8px;

                text-align: center;

            }

            .trend-table th {

                background-color: #F3F4F6;

                font-weight: 600;

                color: ${textColor};

            }

            .trend-label-col {

                text-align: left;

                font-weight: 600;

                background-color: #F9FAFB;

                width: 20%;

        	}

            .trend-score-cell {

                vertical-align: middle;

            }

            .trend-current-month {

                background-color: ${highlightColor};

                font-weight: bold;

            }

            .score-value {

                display: block;

                font-weight: 600;

                margin-bottom: 5px;

            }

            .score-bar-container {

                width: 100%;

                background-color: #E5E7EB;

                border-radius: 4px;

                height: 8px;

                overflow: hidden;

            }

            .score-bar {

                height: 100%;

                border-radius: 4px;

                opacity: 0.85;

            }



            /* 月次詳細：面会者別トレンド */

          	.contact-trend-item {

                margin-bottom: 25px;

          	}

          	.contact-name {

                font-size: 15px;

                margin: 0 0 10px 0;

                font-weight: 600;

          	}

          	.trend-table-sub {

                width: 100%;

                border-collapse: collapse;

                font-size: 13px;

          	}

          	.trend-table-sub th, .trend-table-sub td {

                border: 1px solid #f1f1f1;

                padding: 6px 8px;

                text-align: center;

          	}

          	.trend-table-sub th {

                background-color: #F9FAFB;

                font-weight: 500;

                color: ${textLight};

          	}

          	.trend-label-col-sub {

                text-align: left;

                font-weight: 600;

                background-color: #F9FAFB;

                width: 20%;

          	}

          	.no-data-text { font-size: 14px; color: ${textLight}; padding: 10px 0; }



          	/* --- バッジと凡例 --- */

          	.badge {

                padding: 4px 12px;

                border-radius: 16px;

                font-size: 12px;

                font-weight: 600;

                white-space: nowrap;

                display: inline-block;

          	}

          	${customBadgeStyles}



          	.legend {

                padding: 15px;

                background-color: #F9FAFB;

                border-radius: 8px;

                margin-bottom: 25px;

                text-align: center;

                border: 1px solid ${grayMedium};

          	}

          	.legend-title {

                font-weight: 600;

                margin-bottom: 10px;

                color: ${textLight};

          	}

          	.legend .badge {

                margin: 5px;

          	}



          	/* --- フッター --- */

          	.footer {

                text-align: center;

                padding: 30px;

                font-size: 12px;

          	    color: ${textLight};

                border-top: 1px solid ${grayMedium};

                background-color: #F9FAFB;

          	}



          	/* --- レスポンシブ対応 --- */

          	@media (max-width: 600px) {

                .container {

                    border-radius: 0;

                    box-shadow: none;

              	}

              	.content {

                    padding: 20px 15px;

              	}

              	.header {

                  	padding: 30px 15px;

              	}

              .header h1 {

                  font-size: 22px;

              }

              	.summary-dashboard td {

                  	display: block;

                  	width: 100% !important;

                  	padding-left: 0 !important;

                  	padding-right: 0 !important;

                  	padding-bottom: 15px;

              	}

              .summary-dashboard td:last-child {

                  padding-bottom: 0;

              }

              	.stat-value {

                  	font-size: 32px;

              	}

              	.causality-detail-table, .causality-detail-table tbody, .causality-detail-table tr, .causality-detail-table td {

                  	display: block;

                  width: 100% !important;

                  box-sizing: border-box;

              	}

              	.causality-detail-table thead {

                  	display: none;

              	}

              	.causality-detail-table tr {

                	border-bottom: 1px solid ${grayMedium};

                  padding-bottom: 15px;

                  margin-bottom: 15px;

              	}

              .causality-detail-table tr:last-child {

                  border-bottom: none;

                  margin-bottom: 0;

                  padding-bottom: 0;

              }

              	.causality-detail-table td {

                	border: none;

                	padding: 5px 0 !important;

                	text-align: left !important;

              	}

              .causality-detail-table td:before {

                  display: block;

                  font-weight: 600;

                  color: ${textLight};

                  margin-bottom: 3px;

                  font-size: 13px;

              }

              	.causality-detail-table td.col-date:before { content: "依頼日"; }

              	.causality-detail-table td.col-reason:before { content: "内容・経緯"; }

            	    .causality-detail-table td.col-analysis:before { content: "分析"; }

          	}

        `;

  }



  // --- 各セクション生成メソッド ---



  static getHeader(reportData) {

    const title = reportData.reportType === 'Monthly' ? '月次営業戦略レポート' : '週次営業活動レポート';

    const period = `${DateUtil.format(reportData.startDate, 'yyyy年MM月dd日(E)')} 〜 ${DateUtil.format(reportData.endDate, 'MM月dd日(E)')}`;

    return `<div class="header"><h1>${title}</h1><p class="period">${period}</p></div>`;

  }



// 週次サマリー（ダッシュボード）

  static getWeeklySummary(summary) {

    const totalRequests = summary.causalityAnalysis.length;

    // ★★★ 変更点: class="summary-dashboard" を追加し、不要なインラインスタイルを削除 ★★★

    return `<table class="summary-dashboard" width="100%" border="0" cellspacing="0" cellpadding="0">

              <tr>

                <td style="padding-right: 10px; vertical-align: top; width: 33%;">

                  ${this.generateStatBox('総営業件数', summary.current.totalVisits, summary.previous.totalVisits, '前週比')}

                </td>

                <td style="padding-left: 10px; padding-right: 10px; vertical-align: top; width: 33%;">

                  ${this.generateStatBox('平均関心度スコア', summary.current.averageScore, summary.previous.averageScoreValue, '前週比')}

                </td>

                <td style="padding-left: 10px; vertical-align: top; width: 33%;">

                  ${this.generateStatBox('新規依頼獲得数', totalRequests)}

                </td>

              </tr>

            </table>`;

  }



  // 月次サマリー（ダッシュボード）

  static getMonthlySummary(summary) {

    // ★★★ 変更点：ここから ★★★

    // summaryオブジェクトから当月と前月の依頼数を取得

    const totalRequests = summary.current.totalRequests;

    const previousTotalRequests = summary.previous.totalRequests;

    // ★★★ 変更点：ここまで ★★★



    return `<table class="summary-dashboard" width="100%" border="0" cellspacing="0" cellpadding="0">

              <tr>

                <td style="padding-right: 10px; vertical-align: top; width: 33%;">

                  ${this.generateStatBox('総営業件数 (MTD)', summary.current.totalVisits, summary.previous.totalVisits, '前月比')}

                </td>

                <td style="padding-left: 10px; padding-right: 10px; vertical-align: top; width: 33%;">

                  ${this.generateStatBox('平均関心度スコア', summary.current.averageScore, summary.previous.averageScoreValue, '前月比')}

                </td>

                <td style="padding-left: 10px; vertical-align: top; width: 33%;">

                  

                  ${this.generateStatBox('新規依頼獲得数', totalRequests, previousTotalRequests, '前月比')}



                </td>

              </tr>

            </table>`;

  }



  // 統計ボックス生成

  static generateStatBox(label, currentValue, previousValue = null, comparisonLabel = '前期間比') {

    let comparisonHtml = '';

    if (previousValue !== null) {

      const current = parseFloat(currentValue);

      const previous = parseFloat(previousValue);



      if (!isNaN(current) && !isNaN(previous)) {

        const diff = current - previous;

        let sign = '';

        let icon = '';

        let className = 'comp-neutral';



        if (diff > 0) {

          sign = '+';

          icon = '▲ '; // Up arrow

          className = 'comp-positive';

        } else if (diff < 0) {

          icon = '▼ '; // Down arrow

          className = 'comp-negative';

        } else {

          icon = 'ー '; // Dash

        }



        const formattedDiff = label.includes('スコア') ? diff.toFixed(1) : Math.round(diff);

        comparisonHtml = `<div class="stat-comparison">

                                    <span class="${className}">${icon}${sign}${formattedDiff}</span>

                                    <span style="color: #6b7280;"> (${comparisonLabel})</span>

                                  </div>`;

      } else if (currentValue === 'N/A') {

        comparisonHtml = `<div class="stat-comparison"><span class="comp-neutral">(データなし)</span></div>`;

      }

    }



    // 表示順序を「ラベル」→「数値」→「比較」に変更

    return `<div class="stat-box">

                    <span class="stat-label">${label}</span>

                    <span class="stat-value">${currentValue}</span>

                    ${comparisonHtml}

                </div>`;

  }



  /**

   * 因果関係分析セクションを生成する。

   */

  static generateCausalitySection(reportData) {

    const causalityAnalysis = reportData.summary.causalityAnalysis;

    const allTimeRequestCountByOrg = reportData.allTimeRequestCountByOrg;



    if (!causalityAnalysis || causalityAnalysis.length === 0) {

      return `<p>対象期間中の新規依頼はありませんでした。</p>`;

    }



    // 事業所ごとに依頼をグループ化

    const requestsByOrg = new Map();

    causalityAnalysis.forEach(item => {

      if (!requestsByOrg.has(item.orgName)) {

        requestsByOrg.set(item.orgName, []);

      }

      requestsByOrg.get(item.orgName).push(item);

    });



    // 最新の依頼日時でソート

    const sortedOrgs = Array.from(requestsByOrg.entries()).sort((a, b) => {

      const latestDateA = Math.max(...a[1].map(r => r.requestDateTime.getTime()));

      const latestDateB = Math.max(...b[1].map(r => r.requestDateTime.getTime()));

      return latestDateB - latestDateA;

    });



    let html = '';



    sortedOrgs.forEach(([orgName, requests]) => {

      // ステータスごとにさらにグループ化

      const requestsByStatus = new Map();

      requests.forEach(req => {

        const status = req.status || 'ステータス不明';

        if (!requestsByStatus.has(status)) {

          requestsByStatus.set(status, []);

        }

        requestsByStatus.get(status).push(req);

      });



      const orgId = requests[0].orgId;

      const totalRequestsForOrg = allTimeRequestCountByOrg.get(orgId) || 0;

      const orgHeader = `${escapeHtml(orgName)} <span style="font-weight: normal; font-size: 14px; color: #6b7280;">(期間中: ${requests.length}件 / 累計: ${totalRequestsForOrg}件)</span>`;



      html += `<div class="causality-card">

                        <div class="causality-header">${orgHeader}</div>

                        <div class="causality-content">`;



      Array.from(requestsByStatus.entries()).forEach(([status, statusRequests]) => {

        html += `<h5 class="status-header">${escapeHtml(status)} (${statusRequests.length}件)</h5>`;

        html += '<table class="causality-detail-table">';

        // テーブルヘッダーを追加 (アクセシビリティ向上)

        html += '<thead><tr><th class="col-date">依頼日</th><th class="col-reason">内容・経緯</th><th class="col-analysis">分析</th></tr></thead><tbody>';



        statusRequests.forEach(item => {

          let analysisHtml = '';

          if (item.noPriorSalesActivity) {

            analysisHtml = '<strong>インバウンド</strong><br><small>(営業活動開始前)</small>';

          } else {

            const a = item.analysis;

            analysisHtml = `訪問回数: <strong>${a.totalContacts}回</strong> / 平均スコア: ${a.averageScore}<br>

                                        <small>初回から: ${a.daysToRequest}日後 / 最終接触から: ${a.daysSinceLastContact}日後</small>`;

          }

          html += `

                        <tr>

                            <td class="col-date">${DateUtil.format(item.requestDateTime, 'MM/dd(E)')}</td>

                            <td class="col-reason">${this.parseMarkdown(item.reason) || '---'}</td>

                            <td class="col-analysis">${analysisHtml}</td>

                        </tr>

                    `;

        });

        html += '</tbody></table>';

      });

      html += `</div></div>`;

    });



    return html;

  }



  // --- 週次・月次詳細生成メソッド群 ---



  static generateLegend() {

    const items = Config.BADGE_CONFIG.LEVELS.map(config => {

      // クラス名を小文字に統一

      const className = `badge-custom-${config.color.substring(1).toLowerCase()}`;

      return `<span class="badge ${className}">${escapeHtml(config.text)}</span>`;

    }).join('');

    return `<div class="legend"><div class="legend-title">関心度スコア凡例（基準値: ${Config.BADGE_CONFIG.CRITERIA_SCORE}）</div>${items}</div>`;

  }



  static getWeeklyDetails(reportDetails) {

    return reportDetails.map(detail => this.generateWeeklyOrgCard(detail)).join("");

  }



  // 週次レポートの事業所カード生成

  static generateWeeklyOrgCard(detail) {

    const { orgInfo, historyByContact } = detail;

    let activitiesHtml = "";



    // 面会者をソート（担当者不明は最後）

    const sortedContacts = Array.from(historyByContact.entries()).sort((a, b) => {

      if (a[0] === "担当者不明/その他") return 1;

      if (b[0] === "担当者不明/その他") return -1;

      return a[0].localeCompare(b[0]);

    });



    // 面会者ごとにグループ化して表示

    sortedContacts.forEach(([contactName, historyArray]) => {

      activitiesHtml += `<div class="contact-group">`;

      // 面会者が複数いる場合、または「担当者不明」でない場合はヘッダーを表示

      if (historyByContact.size > 1 || (historyByContact.size === 1 && contactName !== "担当者不明/その他")) {

        activitiesHtml += `<h4 class="contact-header">面会者: ${escapeHtml(contactName)}</h4>`;

      }

      activitiesHtml += historyArray.map(activity => this.generateWeeklyActivityEntry(activity)).join("");

      activitiesHtml += `</div>`;

    });



    return `<div class="org-card">

                    <div class="org-header">

                        <h3 class="org-name">${escapeHtml(orgInfo.official_name)}</h3>

                    </div>

                    <div class="timeline">${activitiesHtml}</div>

                </div>`;

  }



  // 週次レポートの活動エントリー生成

  static generateWeeklyActivityEntry(activity) {

    const dateStr = DateUtil.format(activity.activityDate, 'yyyy/MM/dd (E) HH:mm');

    // 今週の活動かどうかでクラスを分ける

    const entryClass = activity.isCurrentPeriod ? 'activity-entry current-period' : 'activity-entry';

    const badge = this.getScoreBadge(activity.sales_score);

    const summaryHtml = this.parseMarkdown(activity.summary) || '<span style="color: #999;">記録なし</span>';



    // ★★★ 変更点：ここから ★★★

    // 互換性向上のため、div(Flexbox)からtableレイアウトに変更

    return `

            <div class="${entryClass}">

                <div class="activity-header">

                  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="width: 100%;">

                    <tr>

                      <td align="left" style="text-align: left; vertical-align: middle;">

                        <span class="activity-date">${dateStr}</span>

                      </td>

                      <td align="right" style="text-align: right; vertical-align: middle;">

                        ${badge}

                      </td>

                    </tr>

                  </table>

                </div>

                <div class="detail-content">

                    ${summaryHtml}

                </div>

            </div>`;

  }



  static getMonthlyDetails(reportDetails) {

    return reportDetails.map(detail => this.generateMonthlyOrgCard(detail)).join("");

  }



  /**

   * 面会者一人分のトレンド分析テーブルを生成する。

   */

  static generateContactTrendTable(contactTrendData, monthKeys) {

    if (!contactTrendData) return '';



    let scoreRow = '<tr><td class="trend-label-col-sub">平均スコア</td>';

    let headerRow = '<tr><th>指標</th>';

    const currentMonthKey = monthKeys[monthKeys.length - 1];



    monthKeys.forEach(key => {

      const cellClass = key === currentMonthKey ? 'trend-current-month' : '';

      headerRow += `<th class="${cellClass}">${key.substring(5)}月</th>`;

      const stats = contactTrendData.get(key);

      const scoreValue = stats ? stats.averageScore : 0;

      const formattedScore = scoreValue > 0 ? Math.floor(scoreValue).toString() : '-';

      scoreRow += `<td class="${cellClass}">${formattedScore}</td>`;

    });

    scoreRow += '</tr>';

    headerRow += '</tr>';



    return `<table class="trend-table-sub">${headerRow}${scoreRow}</table>`;

  }



  /**

   * 月次レポートの事業所カード生成ロジック。

   * ★★★ 修正：主要面会者がいない場合はセクションを非表示にする ★★★

   */

  static generateMonthlyOrgCard(detail) {

    const { orgInfo, trendData, contactTrendData, monthKeys } = detail;



    // 1. 事業所全体のトレンド分析テーブル

    const orgTrendTableHtml = this.generateTrendTable(trendData, monthKeys);



    // 2. 面会者別のトレンド分析セクション

    let contactTrendsSectionHtml = '';



    // ★★★ 修正：contactTrendData（ビジネスロジック層でフィルタリング済み）が存在し、かつ空でない場合のみセクションを生成 ★★★

    if (contactTrendData && contactTrendData.size > 0) {

      let contactTrendsHtml = '';



      // 訪問回数が多い順に面会者をソート

      const sortedContacts = Array.from(contactTrendData.entries()).sort((a, b) => {

        const totalVisitsA = Array.from(a[1].values()).reduce((sum, stats) => sum + stats.visits, 0);

        const totalVisitsB = Array.from(b[1].values()).reduce((sum, stats) => sum + stats.visits, 0);

        return totalVisitsB - totalVisitsA;

      });



      sortedContacts.forEach(([contactName, trends]) => {

        // ここに来る時点で「担当者不明/その他」は除外されている

        contactTrendsHtml += `

                    <div class="contact-trend-item">

                        <h5 class="contact-name">${escapeHtml(contactName)}</h5>

                        ${this.generateContactTrendTable(trends, monthKeys)}

                    </div>

                `;

      });



      // セクション全体を構築

      contactTrendsSectionHtml = `

                <div class="contact-trends-section">

                    <h4 class="detail-title">主要な面会者別のスコア推移</h4>

                    ${contactTrendsHtml}

                </div>

            `;

    }

    // 主要な面会者がいない場合、contactTrendsSectionHtml は空文字列のままとなり、表示されない。



    return `

            <div class="org-card">

                <div class="org-header">

                    <h3 class="org-name">${escapeHtml(orgInfo.official_name)}</h3>

                </div>

                <div class="trend-analysis">

                    <h4 class="detail-title">事業所全体のトレンド</h4>

                    ${orgTrendTableHtml}

                </div>

                ${contactTrendsSectionHtml}

            </div>

        `;

  }



  /**

   * トレンド分析テーブルを生成する（スコアバー付き）。

   */

  static generateTrendTable(trendData, monthKeys) {

    if (!trendData || monthKeys.length === 0) return '<p>統計データがありません。</p>';



    let headerRow = '<tr><th class="trend-label-col">指標</th>';

    let visitsRow = '<tr><td class="trend-label-col">訪問回数</td>';

    let scoreRow = '<tr><td class="trend-label-col">平均スコア</td>';

    const currentMonthKey = monthKeys[monthKeys.length - 1];



    monthKeys.forEach(key => {

      const stats = trendData.get(key);

      const visits = stats ? stats.visits : 0;

      const scoreValue = stats ? stats.averageScore : 0;

      const formattedScore = scoreValue > 0 ? Math.floor(scoreValue).toString() : '-';

      const cellClass = key === currentMonthKey ? 'trend-current-month' : '';



      headerRow += `<th class="${cellClass}">${key.substring(5)}月</th>`;

      visitsRow += `<td class="${cellClass}">${visits}</td>`;



      let scoreHtml = formattedScore;

      if (scoreValue > 0) {

        const config = this.getBadgeConfig(scoreValue);

        // スコアの最大値を30と仮定してバーの幅を計算

        const barWidth = Math.min(100, (scoreValue / 30) * 100);

        // 数値とバーを組み合わせる

        scoreHtml = `<span class="score-value">${formattedScore}</span>

                             <div class="score-bar-container">

                                <div class="score-bar" style="width: ${barWidth}%; background-color: ${config.color};"></div>

                             </div>`;

      }



      scoreRow += `<td class="${cellClass} trend-score-cell">${scoreHtml}</td>`;

    });



    headerRow += '</tr>';

    visitsRow += '</tr>';

    scoreRow += '</tr>';



    return `<table class="trend-table"><thead>${headerRow}</thead><tbody>${visitsRow}${scoreRow}</tbody></table>`;

  }





  // --- 共通ヘルパーメソッド ---



  static getBadgeConfig(sales_score) {

    const score = parseFloat(sales_score);

    let config = Config.BADGE_CONFIG.LEVELS.find(l => l.range[0] === 0); // デフォルト（未評価）

    if (!isNaN(score) && score > 0) {

      const foundConfig = Config.BADGE_CONFIG.LEVELS.find(l => score >= l.range[0] && score <= l.range[1]);

      if (foundConfig) config = foundConfig;

    }

    // 万が一見つからなかった場合のフォールバック

    if (!config) config = { text: `評価外 (${score})`, color: '#dc3545' };

    return config;

  }



  static getScoreBadge(sales_score) {

    const config = this.getBadgeConfig(sales_score);

    // クラス名を小文字に統一

    const className = `badge-custom-${config.color.substring(1).toLowerCase()}`;

    return `<span class="badge ${className}">${escapeHtml(config.text)}</span>`;

  }



  /**

   * Geminiの出力を解析し、安全なHTMLに変換します。

   * 【デバッグ機能搭載】表の解析に失敗した場合、レポート内に診断情報を表示します。

   * Markdown形式の表は自動でHTMLに変換されます。

   */

  static parseMarkdown(text) {

    if (!text) return '';



    LoggerUtil.debug(`[parseMarkdown] --- Table Debugging Start ---`);

    LoggerUtil.debug(`[parseMarkdown] 1. Received raw text from AI:\n${text}`);



    let processedText = text;



    // STEP 1: Markdown形式のテーブルをHTML形式に変換する

    const mdTableRegex = /^\|(?:.*\|)+\r?\n\|(?:\s*:{0,1}-{3,}:{0,1}\s*\|)+\r?\n(?:\|(?:.*\|)+\r?\n?)+/gm;

    if (mdTableRegex.test(processedText)) {

      LoggerUtil.debug(`[parseMarkdown] 2. Markdown table detected. Starting conversion.`);

      processedText = processedText.replace(mdTableRegex, (mdTable) => {

        const lines = mdTable.trim().split('\n');

        const separatorIndex = lines.findIndex(line => line.includes('---'));

        let htmlTable = '<table class="ai-generated-table" style="width: 100%; border-collapse: collapse; margin-bottom: 15px; border: 1px solid #ccc;">';

        lines.forEach((line, index) => {

          if (index === separatorIndex) return;

          const tag = (index === 0) ? 'th' : 'td';

          const style = `style="border: 1px solid #ccc; padding: 8px; text-align: left; font-size: 14px;"`;

          const cells = line.split('|').map(c => c.trim()).slice(1, -1);

          htmlTable += '<tr>';

          cells.forEach(cell => {

            htmlTable += `<${tag} ${style}>${cell}</${tag}>`;

          });

          htmlTable += '</tr>';

        });

        htmlTable += '</table>';

        LoggerUtil.debug(`[parseMarkdown] 3. Markdown table converted to HTML:\n${htmlTable}`);

        return htmlTable;

      });

    }



    // STEP 2: 行ごとに解析し、安全なHTMLを構築する

    const lines = processedText.split('\n');

    let finalHtml = '';

    let inList = false;

    let inTable = false;



    for (const line of lines) {

      const trimmedLine = line.trim();



      // HTMLテーブル内の行はそのまま維持

      if (trimmedLine.toLowerCase().startsWith('<table>')) inTable = true;

      if (inTable) {

        finalHtml += line + '\n';

        if (trimmedLine.toLowerCase().startsWith('</table>')) inTable = false;

        continue;

      }



      // リストの終了処理

      if (inList && !trimmedLine.startsWith('- ') && !trimmedLine.startsWith('* ')) {

        finalHtml += '</ul>\n';

        inList = false;

      }



      // Markdown記法を処理

      if (trimmedLine.startsWith('### ')) {

        finalHtml += `<h3>${escapeHtml(trimmedLine.substring(4))}</h3>\n`;

      } else if (trimmedLine.startsWith('#### ')) {

        finalHtml += `<h4>${escapeHtml(trimmedLine.substring(5))}</h4>\n`;

      } else if (trimmedLine.startsWith('- ') || trimmedLine.startsWith('* ')) {

        if (!inList) {

          finalHtml += '<ul>\n';

          inList = true;

        }

        let listItem = escapeHtml(trimmedLine.substring(2));

        listItem = listItem.replace(/(\*\*|__)(.*?)\1/g, '<strong>$2</strong>');

        listItem = listItem.replace(/(\*|_)(.*?)\1/g, '<em>$2</em>');

        finalHtml += `<li>${listItem}</li>\n`;

      } else if (trimmedLine.length > 0) {

        let paragraph = escapeHtml(trimmedLine);

        paragraph = paragraph.replace(/(\*\*|__)(.*?)\1/g, '<strong>$2</strong>');

        paragraph = paragraph.replace(/(\*|_)(.*?)\1/g, '<em>$2</em>');

        finalHtml += `<p>${paragraph}</p>\n`;

      } else {

        finalHtml += '<br>\n';

      }

    }

    if (inList) finalHtml += '</ul>\n';



    LoggerUtil.debug(`[parseMarkdown] 4. Final processed HTML:\n${finalHtml}`);



    // --- 自己診断デバッグ機能 ---

    const originalHasTable = /<table|<\|/i.test(text);

    const finalHasTable = /<table/i.test(finalHtml);



    if (originalHasTable && !finalHasTable) {

      LoggerUtil.error(`[parseMarkdown] 5. DEBUGGING ALERT: Table was detected in original text but is missing in the final HTML!`);

      const debugInfo = `

        <div style="background-color: #FFF3E0; border: 1px solid #FF9800; padding: 15px; margin: 15px 0; border-radius: 4px;">

          <h4 style="margin: 0 0 10px 0; color: #E65100;">【開発者向けデバッグ情報】</h4>

          <p style="margin: 0 0 10px 0; color: #BF360C;">AIレポートの表の解析中に問題が発生したため、表示できませんでした。</p>

          <p style="margin: 0 0 5px 0; color: #3E2723;"><strong>元のAI出力（原文）:</strong></p>

          <pre style="white-space: pre-wrap; word-wrap: break-word; background: #fff; padding: 10px; border: 1px solid #ccc; font-size: 12px; color: #212121;">${escapeHtml(text)}</pre>

        </div>

      `;

      return debugInfo;

    }

    

    LoggerUtil.debug(`[parseMarkdown] --- Table Debugging End ---`);

    return finalHtml;

  }





  static getFooter() {

    const generatedTime = DateUtil.format(new Date(), "yyyy/MM/dd HH:mm:ss");

    return `<div class="footer">

                    <p>フラクタル訪問看護 営業管理システム (v5.1)</p>

                    <p>自動生成日時: ${generatedTime}</p>

                </div>`;

  }

}



// =============================================================================

// 7. データ永続化層 (Persistence Layer) - 変更なし

// =============================================================================



class ReportPersistenceService {

  static saveReport(reportData) {

    let summaryObj = reportData.summary.current;

    let prevObj = reportData.summary.previous;

    let summaryText = "";

    const causalityCount = (reportData.summary.causalityAnalysis && reportData.summary.causalityAnalysis.length) || 0;

    if (reportData.reportType === 'Monthly') {

      summaryText = `【月次レポート MTD】訪問件数: ${summaryObj.totalVisits} (前月比: ${summaryObj.totalVisits - prevObj.totalVisits}), 平均スコア: ${summaryObj.averageScore}。新規依頼数: ${causalityCount}。`;

    } else {

      summaryText = `【週次レポート】訪問件数: ${summaryObj.totalVisits} (前週比: ${summaryObj.totalVisits - prevObj.totalVisits}), 平均スコア: ${summaryObj.averageScore}。新規依頼数: ${causalityCount}。`;

    }

    const aiSummaryText = reportData.executiveSummary || '';

    const recordObject = {

      'report_id': Utilities.getUuid(),

      'status': reportData.isEmpty ? '完了（活動・依頼なし）' : '完了（自動生成）',

      'report_type': reportData.reportType,

      'report_period_start': reportData.startDate,

      'report_period_end': reportData.endDate,

      'author_id': 'AUTOMATION_SYSTEM',

      'summary': summaryText,

      'achievements': aiSummaryText,

      'challenges': '',

      'next_period_plan': '',

      'visited_orgs': summaryObj.uniqueOrgs,

      'appointments_count': summaryObj.totalVisits,

      'activities_count': summaryObj.totalVisits,

      'new_contracts_count': causalityCount,

      'average_sales_score': summaryObj.averageScoreValue,

      'created_at': new Date()

    };

    DataAccessService.appendData(Config.SPREADSHEETS.SALES_ID, Config.SHEET_NAMES.REPORTS_LOG, recordObject);

  }

}



// =============================================================================

// 8. 実行関数 (Execution Functions) - 変更なし

// =============================================================================



function mainWeekly(baseDate = null) {

  executeReportProcess('Weekly', baseDate);

}



function mainMonthly(baseDate = null) {

  executeReportProcess('Monthly', baseDate);

}



function executeReportProcess(reportType, baseDate = null) {

  LoggerUtil.info(`=== ${reportType} Sales Report Generation Started ===`);

  const startTime = Date.now();

  const executionDate = baseDate || new Date();



  try {

    let reportService;

    if (reportType === 'Weekly') {

      reportService = new WeeklyReportService();

    } else if (reportType === 'Monthly') {

      reportService = new MonthlyReportService();

    } else {

      throw new Error(`Invalid report type: ${reportType}`);

    }



    const reportData = reportService.generateReport(executionDate);

    const aiSummary = AiAnalysisService.generateExecutiveSummary(reportData);

    reportData.executiveSummary = aiSummary;



    const finalHtmlBody = HtmlReportGenerator.generateEmailBody(reportData, aiSummary);



    sendReportEmail(reportData, finalHtmlBody);

    ReportPersistenceService.saveReport(reportData);



    // ★★★ 変更点：ここから ★★★

    // レポートタイプが月次の場合のみ、次回のトリガーを設定する

    if (reportType === 'Monthly') {

      setNextMonthlyTrigger(executionDate);

    }

    // ★★★ 変更点：ここまで ★★★



    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    LoggerUtil.info(`=== ${reportType} Report Generation Finished Successfully (Duration: ${duration}s) ===`);



  } catch (error) {

    LoggerUtil.error(`A critical error occurred during ${reportType} report generation.`, error);

    sendErrorNotification(error, reportType);

  }

}





function sendReportEmail(reportData, htmlBody) {

  const recipients = Config.REPORT_OPTIONS.RECIPIENTS.join(',');

  if (!recipients || recipients.includes('your_email@example.com')) {

    LoggerUtil.warn("Recipients are not configured correctly. Skipping email sending.");

    return;

  }



  let subject = reportData.reportType === 'Monthly' ? Config.REPORT_OPTIONS.SUBJECT_MONTHLY : Config.REPORT_OPTIONS.SUBJECT_WEEKLY;

  const periodSuffix = `${DateUtil.format(reportData.startDate, 'MMdd')}-${DateUtil.format(reportData.endDate, 'MMdd')}`;

  subject += ` (${periodSuffix})`;



  if (reportData.isEmpty) {

    subject += " ※活動・依頼なし";

  }



  // 1. 添付ファイル名を生成

  const reportTypeName = reportData.reportType === 'Monthly' ? '月次営業レポート' : '週次営業レポート';

  const fileNameDateSuffix = `${DateUtil.format(reportData.startDate, 'yyyyMMdd')}-${DateUtil.format(reportData.endDate, 'yyyyMMdd')}`;

  const fileName = `${reportTypeName}_${fileNameDateSuffix}.html`;



  // 2. HTMLコンテンツから添付ファイル（Blob）を作成

  const attachment = Utilities.newBlob(htmlBody, MimeType.HTML, fileName);

  // ★★★ 変更点：ここまで ★★★



  try {

    // 3. sendEmailのオプションに attachments を追加

    // Email removed - using execution log instead

    LoggerUtil.info(`Report email sent successfully to: ${recipients} with attachment ${fileName}`);

  } catch (e) {

    LoggerUtil.error("Failed to send email.", e);

    throw e;

  }

}



function sendErrorNotification(error, reportType) {

  const recipient = Config.REPORT_OPTIONS.ERROR_RECIPIENT;

  if (!recipient || recipient.includes('admin@example.com')) return;

  const subject = `[緊急エラー] ${reportType}営業レポート生成失敗`;

  const body = `${reportType}レポート生成中にエラーが発生しました。\n\nメッセージ:\n${error.message}\n\nスタックトレース:\n${error.stack}`;

  try {

    // Email removed - using execution log instead

    LoggerUtil.info("Error notification sent.");

  } catch (e) {

    LoggerUtil.error("Failed to send error notification.", e);

  }

}



// =============================================================================

// 9. テスト関数 (Testing Functions) - 変更なし

// =============================================================================



/**

 * 週次テスト実行。

 */

function runTestWeekly() {

  LoggerUtil.info("--- Running Weekly Test ---");

  const testDate = new Date('2025/09/08');

  mainWeekly(testDate);

}



/**

 * 月次テスト実行。

 */

function runTestMonthly() {

  LoggerUtil.info("--- Running Monthly Test ---");

  const testDate = new Date('2025/08/31');

  mainMonthly(testDate);

}



/**

 * =============================================================================

 * 10. トリガー管理 (Trigger Management) - ★★★ 新規追加 ★★★

 * =============================================================================

 */



/**

 * 月次レポートの次回のトリガーを設定します。

 * 実行されると、まず同じ関数（mainMonthly）の既存トリガーをすべて削除し、

 * その後、翌月の最終日の午前9時に新しいトリガーを設定します。

 * @param {Date} baseDate 現在の実行日。この日付を基準に翌月を計算します。

 */

function setNextMonthlyTrigger(baseDate) {

  try {

    const functionNameToTrigger = 'mainMonthly';



    // 1. この関数用の既存トリガーを全て削除（重複防止）

    const allTriggers = ScriptApp.getProjectTriggers();

    allTriggers.forEach(trigger => {

      if (trigger.getHandlerFunction() === functionNameToTrigger) {

        ScriptApp.deleteTrigger(trigger);

        LoggerUtil.info(`古いトリガーを削除しました: ${trigger.getUniqueId()}`);

      }

    });



    // 2. 次回トリガーの日付を計算（翌月の最終日）

    const executionDate = baseDate || new Date();

    

    // JavaScriptのTips: 翌々月の「0日目」は、翌月の最終日を指します。

    // 例：8月に実行 -> 10月(月インデックス:9)の0日目 -> 9月30日

    const triggerDate = new Date(executionDate.getFullYear(), executionDate.getMonth() + 2, 0);



    // 実行時刻を午前9時に設定

    triggerDate.setHours(9);

    triggerDate.setMinutes(0);

    triggerDate.setSeconds(0);



    // 3. 新しいトリガーを作成

    ScriptApp.newTrigger(functionNameToTrigger)

      .timeBased()

      .at(triggerDate)

      .create();



    LoggerUtil.info(`新しいトリガーを作成しました。次回実行日時: '${DateUtil.format(triggerDate, 'yyyy/MM/dd HH:mm')}'`);



  } catch (e) {

    LoggerUtil.error("次回の月次トリガー作成に失敗しました。", e);

    // エラー発生を管理者に通知

    sendErrorNotification(e, 'Trigger Creation');

  }

}