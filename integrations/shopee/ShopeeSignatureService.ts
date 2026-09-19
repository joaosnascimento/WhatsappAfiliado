import crypto from 'crypto';

export interface ShopeeSignaturePayload {
  appId: string;
  secret: string;
  timestamp: number;
  payload: string; // Minified/raw JSON payload
}

export interface ShopeeAuthHeaders {
  [key: string]: string;
  'Content-Type': string;
  Authorization: string;
}

export class ShopeeSignatureService {
  /**
   * Generates timestamp in seconds (Unix epoch)
   */
  public static generateTimestamp(): number {
    return Math.floor(Date.now() / 1000);
  }

  /**
   * Computes SHA-256 signature for Shopee Affiliate Open API
   * Formula: SHA256(AppId + Timestamp + Payload + Secret)
   */
  public static calculateSignature(params: ShopeeSignaturePayload): string {
    const { appId, secret, timestamp, payload } = params;
    const factor = `${appId}${timestamp}${payload}${secret}`;
    return crypto.createHash('sha256').update(factor, 'utf8').digest('hex');
  }

  /**
   * Builds Authorization header required by Shopee Affiliate Open API
   * Format: SHA256 Credential={AppId}, Timestamp={Timestamp}, Signature={Signature}
   */
  public static buildAuthHeaders(params: ShopeeSignaturePayload): ShopeeAuthHeaders {
    const signature = this.calculateSignature(params);
    const authValue = `SHA256 Credential=${params.appId}, Timestamp=${params.timestamp}, Signature=${signature}`;

    return {
      'Content-Type': 'application/json',
      Authorization: authValue,
    };
  }

  /**
   * Validates if a signature matches expected calculation
   */
  public static validateSignature(
    params: ShopeeSignaturePayload,
    receivedSignature: string
  ): boolean {
    const expected = this.calculateSignature(params);
    return crypto.timingSafeEqual(
      Buffer.from(expected, 'utf8'),
      Buffer.from(receivedSignature, 'utf8')
    );
  }
}
