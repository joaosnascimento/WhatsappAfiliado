import { ShopeeAffiliateApiClient } from './ShopeeAffiliateApiClient.ts';
import type { ShopeeReportData } from '../../src/graphql/types.ts';
import type { Conversion } from '../../src/types/affiliate.ts';

const CONVERSION_REPORT_QUERY = `
  query affiliateReport(
    $purchaseTimeStart: Int
    $purchaseTimeEnd: Int
    $page: Int
    $limit: Int
    $subIds: [String]
  ) {
    conversionReport(
      purchaseTimeStart: $purchaseTimeStart
      purchaseTimeEnd: $purchaseTimeEnd
      page: $page
      limit: $limit
      subIds: $subIds
    ) {
      nodes {
        conversionId
        purchaseTime
        orderId
        subIds
        shopId
        itemId
        itemPrice
        commissionRate
        commission
        orderStatus
        productName
      }
      pageInfo {
        page
        limit
        hasNextPage
        totalCount
      }
    }
  }
`;

export interface ReportFilter {
  startTime?: number; // Unix timestamp in seconds
  endTime?: number;
  subIds?: string[];
  page?: number;
  limit?: number;
}

export class ShopeeReportService {
  private client: ShopeeAffiliateApiClient;

  constructor(client: ShopeeAffiliateApiClient) {
    this.client = client;
  }

  /**
   * Fetches real conversions from Shopee Affiliate Open API
   */
  public async getConversions(
    affiliateAccountId: string,
    filter: ReportFilter = {}
  ): Promise<Conversion[]> {
    const defaultEndTime = Math.floor(Date.now() / 1000);
    const defaultStartTime = defaultEndTime - 30 * 24 * 3600; // 30 days

    const variables = {
      purchaseTimeStart: filter.startTime || defaultStartTime,
      purchaseTimeEnd: filter.endTime || defaultEndTime,
      page: filter.page || 1,
      limit: filter.limit || 50,
      subIds: filter.subIds && filter.subIds.length > 0 ? filter.subIds : undefined,
    };

    const data = await this.client.executeGraphQL<ShopeeReportData>(
      CONVERSION_REPORT_QUERY,
      variables
    );

    const nodes = data?.conversionReport?.nodes || [];

    return nodes.map((node) => {
      // Map Shopee status to system Conversion status
      const normalizedStatus: 'PENDING' | 'APPROVED' | 'CANCELLED' =
        node.orderStatus?.toUpperCase().includes('COMPLETE') ||
        node.orderStatus?.toUpperCase().includes('PAID')
          ? 'APPROVED'
          : node.orderStatus?.toUpperCase().includes('CANCEL')
          ? 'CANCELLED'
          : 'PENDING';

      const primarySubId = node.subIds && node.subIds.length > 0 ? node.subIds[0] : undefined;

      return {
        id: `shopee_conv_${node.conversionId || node.orderId}`,
        marketplace: 'SHOPEE',
        affiliate_account_id: affiliateAccountId,
        external_id: String(node.orderId || node.conversionId),
        sub_id: primarySubId,
        commission: Number(node.commission || 0),
        order_amount: Number(node.itemPrice || 0),
        status: normalizedStatus,
        created_at: new Date(
          (node.purchaseTime || Math.floor(Date.now() / 1000)) * 1000
        ).toISOString(),
      };
    });
  }

  /**
   * Aggregates sales summary
   */
  public async getSalesSummary(affiliateAccountId: string, filter: ReportFilter = {}) {
    const conversions = await this.getConversions(affiliateAccountId, filter);
    const totalSales = conversions.reduce((sum, c) => sum + (c.order_amount || 0), 0);
    const totalCommission = conversions.reduce((sum, c) => sum + (c.commission || 0), 0);
    const approvedCommission = conversions
      .filter((c) => c.status === 'APPROVED')
      .reduce((sum, c) => sum + (c.commission || 0), 0);

    return {
      totalConversions: conversions.length,
      totalSales: Number(totalSales.toFixed(2)),
      totalCommission: Number(totalCommission.toFixed(2)),
      approvedCommission: Number(approvedCommission.toFixed(2)),
      conversions,
    };
  }

  /**
   * Calculates performance broken down by subId
   */
  public async getAffiliatePerformance(affiliateAccountId: string) {
    const conversions = await this.getConversions(affiliateAccountId);
    const bySubId: Record<string, { count: number; commission: number; sales: number }> = {};

    for (const c of conversions) {
      const key = c.sub_id || 'unattributed';
      if (!bySubId[key]) {
        bySubId[key] = { count: 0, commission: 0, sales: 0 };
      }
      bySubId[key].count++;
      bySubId[key].commission += c.commission || 0;
      bySubId[key].sales += c.order_amount || 0;
    }

    return bySubId;
  }
}
