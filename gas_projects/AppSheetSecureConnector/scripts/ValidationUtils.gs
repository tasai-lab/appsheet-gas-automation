/**
 * 入力検証ユーティリティモジュール
 *
 * パラメータ検証と変換処理を標準化
 *
 * @author Fractal Group
 * @version 1.0.0
 * @date 2025-10-17
 */

const ValidationUtils = {
  /**
   * 必須パラメータを検証
   * @param {Object} params - パラメータオブジェクト
   * @param {Array<string>} requiredFields - 必須フィールド名の配列
   * @param {Object} [options] - オプション
   * @return {Object} 検証結果 {isValid: boolean, errors: Array}
   */
  validateRequired: function(params, requiredFields, options = {}) {
    const errors = [];

    if (!params || typeof params !== 'object') {
      return {
        isValid: false,
        errors: ['パラメータオブジェクトが無効です']
      };
    }

    for (const field of requiredFields) {
      if (field.includes('.')) {
        // ネストされたフィールドの検証
        const value = this.getNestedValue(params, field);
        if (value === undefined || value === null || value === '') {
          errors.push(`必須パラメータ '${field}' が不足しています`);
        }
      } else {
        // 通常のフィールド検証
        if (params[field] === undefined || params[field] === null || params[field] === '') {
          errors.push(`必須パラメータ '${field}' が不足しています`);
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors: errors
    };
  },

  /**
   * パラメータの型を検証
   * @param {Object} params - パラメータオブジェクト
   * @param {Object} typeSchema - 型定義 {fieldName: 'string'|'number'|'boolean'|'object'|'array'}
   * @return {Object} 検証結果
   */
  validateTypes: function(params, typeSchema) {
    const errors = [];

    for (const field in typeSchema) {
      if (params.hasOwnProperty(field)) {
        const value = params[field];
        const expectedType = typeSchema[field];

        if (value !== null && value !== undefined) {
          const actualType = Array.isArray(value) ? 'array' : typeof value;

          if (actualType !== expectedType) {
            errors.push(`パラメータ '${field}' の型が不正です (期待: ${expectedType}, 実際: ${actualType})`);
          }
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors: errors
    };
  },

  /**
   * 文字列パラメータを検証
   * @param {string} value - 値
   * @param {Object} constraints - 制約
   * @return {Object} 検証結果
   */
  validateString: function(value, constraints = {}) {
    const errors = [];

    if (typeof value !== 'string') {
      return {
        isValid: false,
        errors: ['値が文字列ではありません']
      };
    }

    // 最小長
    if (constraints.minLength && value.length < constraints.minLength) {
      errors.push(`文字列が短すぎます (最小: ${constraints.minLength}文字)`);
    }

    // 最大長
    if (constraints.maxLength && value.length > constraints.maxLength) {
      errors.push(`文字列が長すぎます (最大: ${constraints.maxLength}文字)`);
    }

    // パターン
    if (constraints.pattern && !new RegExp(constraints.pattern).test(value)) {
      errors.push(`文字列がパターンに一致しません: ${constraints.pattern}`);
    }

    // 列挙値
    if (constraints.enum && !constraints.enum.includes(value)) {
      errors.push(`許可されていない値です。許可値: ${constraints.enum.join(', ')}`);
    }

    return {
      isValid: errors.length === 0,
      errors: errors
    };
  },

  /**
   * 数値パラメータを検証
   * @param {number} value - 値
   * @param {Object} constraints - 制約
   * @return {Object} 検証結果
   */
  validateNumber: function(value, constraints = {}) {
    const errors = [];

    if (typeof value !== 'number' || isNaN(value)) {
      return {
        isValid: false,
        errors: ['値が数値ではありません']
      };
    }

    // 最小値
    if (constraints.min !== undefined && value < constraints.min) {
      errors.push(`数値が小さすぎます (最小: ${constraints.min})`);
    }

    // 最大値
    if (constraints.max !== undefined && value > constraints.max) {
      errors.push(`数値が大きすぎます (最大: ${constraints.max})`);
    }

    // 整数チェック
    if (constraints.integer && !Number.isInteger(value)) {
      errors.push('整数である必要があります');
    }

    return {
      isValid: errors.length === 0,
      errors: errors
    };
  },

  /**
   * 日付パラメータを検証
   * @param {string|Date} value - 値
   * @param {Object} constraints - 制約
   * @return {Object} 検証結果
   */
  validateDate: function(value, constraints = {}) {
    const errors = [];

    let date;
    if (value instanceof Date) {
      date = value;
    } else if (typeof value === 'string') {
      date = new Date(value);
    } else {
      return {
        isValid: false,
        errors: ['値が日付として解釈できません']
      };
    }

    if (isNaN(date.getTime())) {
      return {
        isValid: false,
        errors: ['無効な日付形式です']
      };
    }

    // 最小日付
    if (constraints.minDate) {
      const minDate = new Date(constraints.minDate);
      if (date < minDate) {
        errors.push(`日付が古すぎます (最小: ${minDate.toISOString()})`);
      }
    }

    // 最大日付
    if (constraints.maxDate) {
      const maxDate = new Date(constraints.maxDate);
      if (date > maxDate) {
        errors.push(`日付が新しすぎます (最大: ${maxDate.toISOString()})`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors: errors,
      value: date
    };
  },

  /**
   * メールアドレスを検証
   * @param {string} email - メールアドレス
   * @return {Object} 検証結果
   */
  validateEmail: function(email) {
    const pattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    const isValid = pattern.test(email);

    return {
      isValid: isValid,
      errors: isValid ? [] : ['無効なメールアドレス形式です']
    };
  },

  /**
   * URLを検証
   * @param {string} url - URL
   * @return {Object} 検証結果
   */
  validateUrl: function(url) {
    try {
      new URL(url);
      return {
        isValid: true,
        errors: []
      };
    } catch (e) {
      return {
        isValid: false,
        errors: ['無効なURL形式です']
      };
    }
  },

  /**
   * ファイルIDを検証（Google Drive）
   * @param {string} fileId - ファイルID
   * @return {Object} 検証結果
   */
  validateFileId: function(fileId) {
    // Google DriveのファイルIDは通常33文字の英数字と記号
    const pattern = /^[a-zA-Z0-9_-]{20,100}$/;
    const isValid = pattern.test(fileId);

    return {
      isValid: isValid,
      errors: isValid ? [] : ['無効なファイルID形式です']
    };
  },

  /**
   * スプレッドシートIDを検証
   * @param {string} spreadsheetId - スプレッドシートID
   * @return {Object} 検証結果
   */
  validateSpreadsheetId: function(spreadsheetId) {
    // Google SheetsのIDは通常44文字
    const pattern = /^[a-zA-Z0-9_-]{20,100}$/;
    const isValid = pattern.test(spreadsheetId);

    return {
      isValid: isValid,
      errors: isValid ? [] : ['無効なスプレッドシートID形式です']
    };
  },

  /**
   * パラメータをサニタイズ
   * @param {Object} params - パラメータ
   * @param {Object} [options] - オプション
   * @return {Object} サニタイズされたパラメータ
   */
  sanitizeParams: function(params, options = {}) {
    const sanitized = {};

    for (const key in params) {
      const value = params[key];

      if (value === null || value === undefined) {
        continue;
      }

      if (typeof value === 'string') {
        // 文字列のトリミング
        sanitized[key] = value.trim();

        // HTMLエスケープ（オプション）
        if (options.escapeHtml) {
          sanitized[key] = this.escapeHtml(sanitized[key]);
        }
      } else if (typeof value === 'object') {
        // オブジェクトの再帰的サニタイズ
        sanitized[key] = this.sanitizeParams(value, options);
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  },

  /**
   * HTMLエスケープ
   * @param {string} str - 文字列
   * @return {string} エスケープされた文字列
   */
  escapeHtml: function(str) {
    const escapeMap = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    };

    return str.replace(/[&<>"']/g, char => escapeMap[char]);
  },

  /**
   * ネストされた値を取得
   * @param {Object} obj - オブジェクト
   * @param {string} path - パス（例: 'user.profile.name'）
   * @return {*} 値
   */
  getNestedValue: function(obj, path) {
    const keys = path.split('.');
    let value = obj;

    for (const key of keys) {
      if (value && typeof value === 'object' && key in value) {
        value = value[key];
      } else {
        return undefined;
      }
    }

    return value;
  },

  /**
   * パラメータスキーマを検証
   * @param {Object} params - パラメータ
   * @param {Object} schema - スキーマ定義
   * @return {Object} 検証結果
   */
  validateSchema: function(params, schema) {
    const errors = [];

    // 必須フィールド検証
    if (schema.required) {
      const requiredResult = this.validateRequired(params, schema.required);
      errors.push(...requiredResult.errors);
    }

    // 型検証
    if (schema.types) {
      const typeResult = this.validateTypes(params, schema.types);
      errors.push(...typeResult.errors);
    }

    // カスタム検証
    if (schema.custom) {
      for (const field in schema.custom) {
        if (params[field] !== undefined) {
          const validator = schema.custom[field];
          const result = validator(params[field], params);
          if (!result.isValid) {
            errors.push(...result.errors);
          }
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors: errors
    };
  }
};
