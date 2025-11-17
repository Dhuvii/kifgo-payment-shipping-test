import https from "node:https";
import { URL } from "node:url";

/**
 * Pronto Lanka API Service
 *
 * This service handles all interactions with the Pronto Lanka TrackerFE Customer Portal API
 * for cost estimation and shipment creation in Sri Lanka.
 *
 * Based on Pronto Lanka API Technical Specification v3.1
 */

// Note: We dynamically import 'undici' inside the request to avoid hard ESM import at module load.

interface ProntoApiConfig {
  baseUrl: string;
  username: string;
  password: string;
  customerCode: string;
}

interface ProntoApiResponse {
  status: string;
  status_ref?: string;
  [key: string]: unknown;
}

interface CostEstimationRequest {
  customerCode: string;
  pkgWeight: number;
  prontoAc: string; // Area code (1-5)
}

interface CostEstimationResponse {
  live_amount: {
    amount: string;
  };
  [key: string]: unknown;
}

interface TrackingNumberRequest {
  customerCode: string;
  tnoCode: string; // "1" for non-COD, "2" for COD
}

interface TrackingNumberResponse {
  emp_trackingno: {
    tno: string;
  };
  [key: string]: unknown;
}

interface ShipmentInsertRequest {
  tno: string;
  senName?: string;
  senPhone?: string;
  senAddress?: string;
  recName: string;
  recAddress: string;
  recPhone: string;
  prontoLc?: string;
  ivalue: string; // Item value for COD
  samedayDel?: string; // "yes" or "no"
  senc?: string; // "yes" or "no" for sensitive items
  spNote?: string; // Special notes
}

interface ShipmentInsertResponse {
  insertion_fb: string;
  status: string;
  status_ref?: string;
  [key: string]: unknown;
}

interface TrackingDetailRequest {
  customerCode: string;
  tno: string;
}

interface TrackingDetailResponse {
  emp_tracking: Array<{
    status: string;
    date: string;
    time: string;
    location?: string;
    remarks?: string;
  }>;
  [key: string]: unknown;
}

interface ProntoHttpResponse<T> {
  ok: boolean;
  status: number;
  body: ProntoApiResponse & T;
}

export class ProntoApiService {
  private config: ProntoApiConfig;
  private authHeader: string;

  constructor(config: ProntoApiConfig) {
    this.config = config;
    this.authHeader = Buffer.from(`${config.username}:${config.password}`).toString('base64');
  }

  /**
   * Get all rate structure for the customer code
   */
  async getRateStructure(): Promise<ProntoApiResponse> {
    const response = await this.makeRequest<ProntoApiResponse>('calc.method', {
      customer_code: this.config.customerCode
    });

    return response;
  }

  /**
   * Calculate shipping cost for a specific package
   */
  async calculateShippingCost(request: CostEstimationRequest): Promise<CostEstimationResponse> {
    const response = await this.makeRequest<CostEstimationResponse>('pkg.amount', {
      customer_code: request.customerCode,
      pkg_weight: request.pkgWeight,
      pronto_ac: request.prontoAc
    });

    return response;
  }

  /**
   * Request a tracking number
   */
  async requestTrackingNumber(request: TrackingNumberRequest): Promise<TrackingNumberResponse> {
    const response = await this.makeRequest<TrackingNumberResponse>('tno.request', {
      tno_code: request.tnoCode,
      customer_code: request.customerCode
    });

    return response;
  }

  /**
   * Insert shipment details
   */
  async insertShipment(request: ShipmentInsertRequest): Promise<ShipmentInsertResponse> {
    const response = await this.makeRequest<ShipmentInsertResponse>('tno.insert', {
      tno: request.tno,
      sen_name: request.senName || null,
      sen_phone: request.senPhone || null,
      sen_address: request.senAddress || null,
      rec_name: request.recName,
      rec_address: request.recAddress,
      rec_phone: request.recPhone,
      pronto_lc: request.prontoLc || "0001",
      ivalue: request.ivalue,
      sameday_del: request.samedayDel || "no",
      senc: request.senc || "no",
      sp_note: request.spNote || null
    });

    return response;
  }

  /**
   * Get tracking details for a shipment
   */
  async getTrackingDetails(request: TrackingDetailRequest): Promise<TrackingDetailResponse> {
    const response = await this.makeRequest<TrackingDetailResponse>('tno.detail', {
      customer_code: request.customerCode,
      tno: request.tno
    });

    return response;
  }

  /**
   * Make a request to the Pronto API
   */
  private async makeRequest<T extends Record<string, unknown>>(
    method: string,
    data: Record<string, unknown>,
    retryCount = 0,
    forceInsecureTls = false
  ): Promise<ProntoApiResponse & T> {
    const url = `${this.config.baseUrl}?method=${method}`;

    const requestBody: Record<string, unknown> = {
      request: method,
      data,
    };

    console.log(`🚚 Pronto API Request: ${method} (attempt ${retryCount + 1})`, {
      url,
      requestBody,
    });

    const allowInsecureTls = this.shouldAllowInsecureTls();
    const shouldUseInsecureTransport = allowInsecureTls && forceInsecureTls;

    if (shouldUseInsecureTransport) {
      console.warn(
        `⚠️ Pronto API: using insecure TLS transport for ${method} due to certificate issues.`
      );
    }

    try {
      const httpResponse = shouldUseInsecureTransport
        ? await this.sendRequestWithHttpsFallback<T>(
            url,
            requestBody,
            allowInsecureTls
          )
        : await this.sendRequestWithFetch<T>(
            url,
            requestBody,
            allowInsecureTls
          );

      return this.processResponse(method, httpResponse);
    } catch (error) {
      if (
        allowInsecureTls &&
        !shouldUseInsecureTransport &&
        isCertificateError(error)
      ) {
        console.warn(
          `⚠️ Pronto API TLS validation failed for ${method}; retrying without certificate verification.`
        );
        return this.makeRequest(method, data, retryCount, true);
      }

      console.error(
        `❌ Pronto API request failed for method ${method} (attempt ${retryCount + 1}):`,
        error
      );

      if (retryCount < 2 && shouldRetryRequest(error)) {
        const delay = (retryCount + 1) * 2000;
        console.log(`🔄 Retrying Pronto API request in ${delay}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
        return this.makeRequest(method, data, retryCount + 1, forceInsecureTls);
      }

      throw error;
    }
  }

  private async sendRequestWithFetch<T extends Record<string, unknown>>(
    url: string,
    requestBody: Record<string, unknown>,
    allowInsecureTls: boolean
  ): Promise<ProntoHttpResponse<T>> {
    type AgentFactory = new (options: {
      connect?: {
        timeout?: number;
        tls?: { rejectUnauthorized?: boolean };
      };
    }) => { close: () => void };

    let dispatcher: { close?: () => void } | undefined;
    try {
      const mod = (await (0, eval)("import('undici')")) as {
        Agent: AgentFactory;
      };
      const Agent = mod.Agent;
      dispatcher = new Agent({
        connect: {
          timeout: 30000,
          tls: allowInsecureTls ? { rejectUnauthorized: false } : undefined,
        },
      });
    } catch {
      dispatcher = undefined;
    }

    const controller = new AbortController();
    const totalTimeout = setTimeout(() => controller.abort(), 45000);

    type ExtendedRequestInit = RequestInit & {
      dispatcher?: { close?: () => void };
    };

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Basic ${this.authHeader}`,
        },
        body: JSON.stringify(requestBody),
        dispatcher,
        signal: controller.signal,
      } as ExtendedRequestInit);

      const body = (await response.json()) as ProntoApiResponse & T;
      return {
        ok: response.ok,
        status: response.status,
        body,
      };
    } finally {
      clearTimeout(totalTimeout);
      dispatcher?.close?.();
    }
  }

  private async sendRequestWithHttpsFallback<
    T extends Record<string, unknown>
  >(
    url: string,
    requestBody: Record<string, unknown>,
    allowInsecureTls: boolean
  ): Promise<ProntoHttpResponse<T>> {
    const parsedUrl = new URL(url);
    const bodyPayload = JSON.stringify(requestBody);

    const agent = new https.Agent({
      rejectUnauthorized: !allowInsecureTls,
    });

    return new Promise((resolve, reject) => {
      const requestOptions: https.RequestOptions = {
        method: "POST",
        hostname: parsedUrl.hostname,
        port:
          parsedUrl.port ||
          (parsedUrl.protocol === "https:" ? 443 : 80),
        path: `${parsedUrl.pathname}${parsedUrl.search}`,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Basic ${this.authHeader}`,
        },
        agent,
      };

      const req = https.request(requestOptions, (res) => {
        const chunks: Array<string> = [];
        res.on("data", (chunk) =>
          chunks.push(
            typeof chunk === "string" ? chunk : chunk.toString("utf8")
          )
        );
        res.on("end", () => {
          const raw = chunks.join("");
          try {
            const body = raw
              ? (JSON.parse(raw) as ProntoApiResponse & T)
              : ({ status: "0" } as ProntoApiResponse & T);
            resolve({
              ok:
                !!res.statusCode &&
                res.statusCode >= 200 &&
                res.statusCode < 300,
              status: res.statusCode ?? 0,
              body,
            });
          } catch (parseError) {
            reject(parseError);
          } finally {
            agent.destroy();
          }
        });
      });

      req.on("error", (error) => {
        agent.destroy();
        reject(error);
      });

      req.setTimeout(45000, () => {
        req.destroy(new Error("HTTPS request timeout"));
      });

      req.write(bodyPayload);
      req.end();
    });
  }

  private processResponse<T extends Record<string, unknown>>(
    method: string,
    response: ProntoHttpResponse<T>
  ): ProntoApiResponse & T {
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = response.body;

    console.log(`🚚 Pronto API Response: ${method}`, result);

    if (result.status === "0") {
      throw new Error(
        `Pronto API error: ${result.status_ref || "Unknown error"}`
      );
    }

    return result;
  }

  private shouldAllowInsecureTls(): boolean {
    if (process.env.PRONTO_ALLOW_INSECURE_TLS === "true") {
      return true;
    }

    return (
      process.env.NODE_ENV === "development" ||
      this.config.baseUrl.includes("uat-api")
    );
  }
}

function shouldRetryRequest(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message || "";

  return (
    message.includes("Connect Timeout") ||
    message.includes("fetch failed") ||
    message.includes("ECONNRESET") ||
    message.includes("ENOTFOUND") ||
    message.includes("request timeout")
  );
}

function isCertificateError(error: unknown): boolean {
  const seen = new Set<unknown>();
  let current: unknown = error;

  while (current && typeof current === "object" && !seen.has(current)) {
    seen.add(current);

    const err = current as NodeJS.ErrnoException & { cause?: unknown };
    const message = err.message || "";
    const code = err.code || "";

    if (
      code === "CERT_HAS_EXPIRED" ||
      code === "DEPTH_ZERO_SELF_SIGNED_CERT" ||
      code === "UNABLE_TO_VERIFY_LEAF_SIGNATURE" ||
      message.includes("CERT_HAS_EXPIRED") ||
      message.includes("self signed certificate") ||
      message.includes("unable to verify the first certificate")
    ) {
      return true;
    }

    current = err.cause;
  }

  return false;
}

/**
 * Area Code Mapping for Sri Lankan Locations
 * 
 * Based on Pronto Lanka's location matrix:
 * 1: CITY (e.g., Colombo core areas)
 * 2: GREATER CITY (e.g., suburbs like Dehiwala)
 * 3: OUTSTATION (e.g., regional towns like Kandy)
 * 4: HIGH SECURITY (e.g., restricted zones)
 * 5: SPECIAL AREA (e.g., remote or custom zones)
 */
export const PRONTO_AREA_CODES = {
  // CITY (Code 1) - Colombo core areas
  'Colombo': '1',
  'Colombo 01': '1',
  'Colombo 02': '1',
  'Colombo 03': '1',
  'Colombo 04': '1',
  'Colombo 05': '1',
  'Colombo 06': '1',
  'Colombo 07': '1',
  'Colombo 08': '1',
  'Colombo 09': '1',
  'Colombo 10': '1',
  'Colombo 11': '1',
  'Colombo 12': '1',
  'Colombo 13': '1',
  'Colombo 14': '1',
  'Colombo 15': '1',

  // GREATER CITY (Code 2) - Suburbs
  'Dehiwala': '2',
  'Mount Lavinia': '2',
  'Moratuwa': '2',
  'Kaduwela': '2',
  'Maharagama': '2',
  'Kesbewa': '2',
  'Homagama': '2',
  'Padukka': '2',
  'Seethawaka': '2',
  'Gampaha': '2',
  'Negombo': '2',
  'Wattala': '2',
  'Katana': '2',
  'Divulapitiya': '2',
  'Mirigama': '2',
  'Minuwangoda': '2',
  'Attanagalla': '2',
  'Biyagama': '2',
  'Dompe': '2',
  'Ja-Ela': '2',
  'Kelaniya': '2',
  'Mahara': '2',
  'Peliyagoda': '2',
  'Kalutara': '2',
  'Beruwala': '2',
  'Dodangoda': '2',
  'Horana': '2',
  'Ingiriya': '2',
  'Mathugama': '2',
  'Panadura': '2',
  'Walallavita': '2',

  // OUTSTATION (Code 3) - Regional towns
  'Kandy': '3',
  'Matale': '3',
  'Nuwara Eliya': '3',
  'Galle': '3',
  'Matara': '3',
  'Hambantota': '3',
  'Jaffna': '3',
  'Kilinochchi': '3',
  'Mullaitivu': '3',
  'Vavuniya': '3',
  'Mannar': '3',
  'Batticaloa': '3',
  'Ampara': '3',
  'Trincomalee': '3',
  'Kurunegala': '3',
  'Puttalam': '3',
  'Anuradhapura': '3',
  'Polonnaruwa': '3',
  'Badulla': '3',
  'Monaragala': '3',
  'Ratnapura': '3',
  'Kegalle': '3',

  // HIGH SECURITY (Code 4) - Restricted zones
  'High Security Zone': '4',
  'Military Area': '4',
  'Restricted Zone': '4',

  // SPECIAL AREA (Code 5) - Remote or custom zones
  'Special Area': '5',
  'Remote Area': '5',
  'Custom Zone': '5'
} as const;

/**
 * Get area code for a given location
 */
export function getAreaCodeForLocation(location: string): string {
  // Normalize the location string
  const normalizedLocation = location.trim();
  
  // Try exact match first
  if (PRONTO_AREA_CODES[normalizedLocation as keyof typeof PRONTO_AREA_CODES]) {
    return PRONTO_AREA_CODES[normalizedLocation as keyof typeof PRONTO_AREA_CODES];
  }

  // Try partial match for common patterns
  const lowerLocation = normalizedLocation.toLowerCase();
  
  if (lowerLocation.includes('colombo')) {
    return '1'; // CITY
  }
  
  if (lowerLocation.includes('dehiwala') || lowerLocation.includes('mount lavinia') || 
      lowerLocation.includes('moratuwa') || lowerLocation.includes('gampaha') || 
      lowerLocation.includes('negombo') || lowerLocation.includes('kalutara')) {
    return '2'; // GREATER CITY
  }
  
  if (lowerLocation.includes('kandy') || lowerLocation.includes('galle') || 
      lowerLocation.includes('matara') || lowerLocation.includes('jaffna') || 
      lowerLocation.includes('kurunegala') || lowerLocation.includes('anuradhapura')) {
    return '3'; // OUTSTATION
  }
  
  // Default to OUTSTATION for unknown locations
  return '3';
}

/**
 * Create Pronto API service instance
 */
export function createProntoApiService(): ProntoApiService {
  const config: ProntoApiConfig = {
    baseUrl: process.env.PRONTO_API_BASE_URL || 'https://uat-api.prontolanka.lk:18443/PR_API.aspx',
    username: process.env.PRONTO_API_USERNAME || 'apiuatuser',
    password: process.env.PRONTO_API_PASSWORD || 'a7xJ#uj.',
    customerCode: process.env.PRONTO_CUSTOMER_CODE || 'A001'
  };

  console.log('🚚 Pronto API Service Config:', {
    baseUrl: config.baseUrl,
    username: config.username,
    customerCode: config.customerCode,
    hasPassword: !!config.password
  });

  return new ProntoApiService(config);
}

export default ProntoApiService;
