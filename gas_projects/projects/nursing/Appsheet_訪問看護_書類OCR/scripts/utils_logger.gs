/**
 * Unified Logging Utility
 *
 * All logging functions unified for consistency and debuggability
 *
 * @version 1.0.0
 * @date 2025-10-18
 */

/**
 * Enhanced structured logging with debug mode support
 * @param {string} level - Log level (INFO, SUCCESS, WARNING, ERROR)
 * @param {string} message - Log message
 * @param {Object} data - Additional data to log
 */
function logStructured(level, message, data = {}) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    level: level,
    message: message,
    scriptId: ScriptApp.getScriptId(),
    ...data
  };

  // Format log based on debug mode
  const logString = SYSTEM_CONFIG.debugMode
    ? JSON.stringify(logEntry, null, 2)
    : JSON.stringify(logEntry);

  // Output based on level
  switch (level) {
    case LOG_LEVEL.ERROR:
      console.error(logString);
      Logger.log(`[${level}] ${logString}`);
      break;
    case LOG_LEVEL.WARNING:
      console.warn(logString);
      Logger.log(`[${level}] ${logString}`);
      break;
    default:
      Logger.log(`[${level}] ${logString}`);
      if (SYSTEM_CONFIG.debugMode) {
        console.log(logString);
      }
  }
}

/**
 * Processing start log
 * @param {string} reportId - Report ID
 * @param {Object} params - Parameters
 */
function logProcessingStart(reportId, params) {
  logStructured(LOG_LEVEL.INFO, '処理開始', {
    reportId: reportId,
    clientName: params.clientName,
    targetMonth: params.targetMonth,
    visitRecordsLength: params.visitRecordsLength,
    staffId: params.staffId
  });
}

/**
 * Processing complete log
 * @param {string} reportId - Report ID
 * @param {number} duration - Duration in milliseconds
 */
function logProcessingComplete(reportId, duration) {
  logStructured(LOG_LEVEL.INFO, '処理完了', {
    reportId: reportId,
    durationMs: duration,
    durationSec: (duration / 1000).toFixed(2)
  });
}

/**
 * Error log with stack trace
 * @param {string} reportId - Report ID
 * @param {Error} error - Error object
 * @param {Object} context - Error context
 */
function logError(reportId, error, context = {}) {
  logStructured(LOG_LEVEL.ERROR, 'エラー発生', {
    reportId: reportId,
    errorMessage: error.message,
    errorName: error.name,
    errorStack: error.stack,
    ...context
  });
}

/**
 * API call log
 * @param {string} apiName - API name
 * @param {string} endpoint - Endpoint URL
 * @param {number} responseCode - Response code
 * @param {number} duration - Duration in milliseconds
 */
function logApiCall(apiName, endpoint, responseCode, duration) {
  logStructured(LOG_LEVEL.INFO, `${apiName} API呼び出し`, {
    api: apiName,
    endpoint: endpoint,
    responseCode: responseCode,
    durationMs: duration,
    durationSec: (duration / 1000).toFixed(2)
  });
}

/**
 * Debug log (only shown in debug mode)
 * @param {string} message - Message
 * @param {Object} data - Data to log
 */
function logDebug(message, data = {}) {
  if (SYSTEM_CONFIG.debugMode) {
    logStructured(LOG_LEVEL.INFO, message, data);
  }
}

/**
 * Performance marker for measuring execution time
 * @param {string} label - Marker label
 * @returns {Function} Stop function that returns duration
 */
function perfStart(label) {
  const startTime = Date.now();

  return function perfStop() {
    const duration = Date.now() - startTime;

    logDebug(`Performance: ${label}`, {
      label: label,
      durationMs: duration,
      durationSec: (duration / 1000).toFixed(2)
    });

    return duration;
  };
}
