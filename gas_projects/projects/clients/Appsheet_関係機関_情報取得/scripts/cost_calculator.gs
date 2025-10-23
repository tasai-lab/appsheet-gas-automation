/**
 * Places API コスト計算サービス
 *
 * Google Places API (New) の料金を計算
 * 公式ドキュメント: https://developers.google.com/maps/documentation/places/web-service/usage-and-billing
 */

/**
 * Places API (New) の料金テーブル（2025年1月時点）
 *
 * 参考: https://developers.google.com/maps/documentation/places/web-service/usage-and-billing
 */
const PLACES_API_PRICING = {
  // Text Search (New) - テキスト検索
  TEXT_SEARCH: {
    pricePerRequest: 0.032, // USD per request
    priceUSD: 32.00, // USD per 1,000 requests
    freeTier: 0 // 無料枠なし（月額$200クレジットは新規ユーザーのみ）
  },

  // Place Details (New) - 詳細情報取得
  PLACE_DETAILS: {
    pricePerRequest: 0.017, // USD per request
    priceUSD: 17.00, // USD per 1,000 requests
    freeTier: 0
  }
};

/**
 * Places API Text Search のコストを計算
 * @param {number} apiCallCount - API呼び出し回数
 * @returns {Object} { costUSD: ドル, costJPY: 日本円, exchangeRate: 為替レート }
 */
function calculatePlacesAPICost(apiCallCount) {
  if (!apiCallCount || apiCallCount === 0) {
    return {
      costUSD: 0,
      costJPY: 0,
      exchangeRate: EXCHANGE_RATE_USD_TO_JPY
    };
  }

  // Text Search (New) の料金計算
  const costUSD = apiCallCount * PLACES_API_PRICING.TEXT_SEARCH.pricePerRequest;
  const costJPY = costUSD * EXCHANGE_RATE_USD_TO_JPY;

  return {
    costUSD: parseFloat(costUSD.toFixed(4)),
    costJPY: parseFloat(costJPY.toFixed(2)),
    exchangeRate: EXCHANGE_RATE_USD_TO_JPY
  };
}

/**
 * コスト情報を含む詳細レポートを生成
 * @param {number} apiCallCount - API呼び出し回数
 * @param {boolean} cacheUsed - キャッシュ使用フラグ
 * @returns {Object} コストレポート
 */
function generateCostReport(apiCallCount, cacheUsed) {
  const cost = calculatePlacesAPICost(apiCallCount);

  return {
    apiCallCount: apiCallCount,
    cacheUsed: cacheUsed,
    costUSD: cost.costUSD,
    costJPY: cost.costJPY,
    exchangeRate: cost.exchangeRate,
    costSummary: `¥${cost.costJPY.toFixed(2)} ($${cost.costUSD.toFixed(4)})`,
    pricingDetails: {
      apiType: 'Places API (New) - Text Search',
      pricePerRequest: `$${PLACES_API_PRICING.TEXT_SEARCH.pricePerRequest} / request`,
      pricePer1000: `$${PLACES_API_PRICING.TEXT_SEARCH.priceUSD} / 1,000 requests`,
      exchangeRate: `1 USD = ${EXCHANGE_RATE_USD_TO_JPY} JPY`
    }
  };
}

/**
 * 月間コスト見積もりを計算
 * @param {number} dailyRequests - 1日あたりのリクエスト数
 * @returns {Object} 月間コスト見積もり
 */
function estimateMonthlyCost(dailyRequests) {
  const monthlyRequests = dailyRequests * 30;
  const cost = calculatePlacesAPICost(monthlyRequests);

  return {
    dailyRequests: dailyRequests,
    monthlyRequests: monthlyRequests,
    monthlyCostUSD: cost.costUSD,
    monthlyCostJPY: cost.costJPY,
    summary: `月間見積もり: ¥${cost.costJPY.toFixed(2)} (${cost.costUSD.toFixed(2)} USD) / ${monthlyRequests}リクエスト`
  };
}

/**
 * テスト関数: コスト計算
 */
function testCostCalculation() {
  console.log('=== Places API コスト計算テスト ===\n');

  // 単一リクエストのコスト
  const singleCost = calculatePlacesAPICost(1);
  console.log('1リクエストのコスト:');
  console.log(`  USD: $${singleCost.costUSD}`);
  console.log(`  JPY: ¥${singleCost.costJPY}`);
  console.log('');

  // 100リクエストのコスト
  const cost100 = calculatePlacesAPICost(100);
  console.log('100リクエストのコスト:');
  console.log(`  USD: $${cost100.costUSD}`);
  console.log(`  JPY: ¥${cost100.costJPY}`);
  console.log('');

  // 月間見積もり（1日100リクエスト）
  const monthly = estimateMonthlyCost(100);
  console.log('月間コスト見積もり（1日100リクエスト）:');
  console.log(`  月間リクエスト: ${monthly.monthlyRequests}`);
  console.log(`  月間コストUSD: $${monthly.monthlyCostUSD.toFixed(2)}`);
  console.log(`  月間コストJPY: ¥${monthly.monthlyCostJPY.toFixed(2)}`);
  console.log('');

  // コストレポート生成
  const report = generateCostReport(1, false);
  console.log('コストレポート:');
  console.log(JSON.stringify(report, null, 2));
}
