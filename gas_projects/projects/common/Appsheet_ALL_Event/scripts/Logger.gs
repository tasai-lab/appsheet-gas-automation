const Logger = {

  /**

   * 情報レベルのログを出力する

   * @param {string} message - ログメッセージ

   * @param {Object} [context={}] - 追加情報（オブジェクト形式）

   */

  info(message, context = {}) {

    console.info(JSON.stringify({

      severity: 'INFO',

      message: message,

      context: context,

    }));

  },


  /**

   * エラーレベルのログを出力する

   * @param {string} message - エラーメッセージ

   * @param {Error} error - エラーオブジェクト

   * @param {Object} [context={}] - 追加情報（オブジェクト形式）

   */

  error(message, error, context = {}) {

    console.error(JSON.stringify({

      severity: 'ERROR',

      message: message,

      error: {

        name: error.name,

        message: error.message,

        stack: error.stack,

      },

      context: context,

    }));

  }

};
