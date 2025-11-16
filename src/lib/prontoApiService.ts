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
    retryCount = 0
  ): Promise<ProntoApiResponse & T> {
    const url = `${this.config.baseUrl}?method=${method}`;
    
    const requestBody: Record<string, unknown> = {
      request: method,
      data
    };

    console.log(`🚚 Pronto API Request: ${method} (attempt ${retryCount + 1})`, {
      url,
      requestBody
    });

    try {
      // Configure dispatcher and timeout handling
      const isUat = process.env.NODE_ENV === 'development' || this.config.baseUrl.includes('uat-api');
      type AgentFactory = new (options: {
        connect?: {
          timeout?: number;
          tls?: { rejectUnauthorized?: boolean };
        };
      }) => { close: () => void };

      let dispatcher: { close?: () => void } | undefined;
      try {
        // Use eval-based dynamic import to avoid build-time resolution
        const mod = (await (0, eval)("import('undici')")) as {
          Agent: AgentFactory;
        };
        const Agent = mod.Agent;
        dispatcher = new Agent({
          connect: {
            timeout: 30000,
            tls: isUat ? { rejectUnauthorized: false } : undefined
          }
        });
      } catch {
        // If undici isn't available, proceed without custom dispatcher
        dispatcher = undefined;
      }

      const controller = new AbortController();
      const totalTimeout = setTimeout(() => controller.abort(), 45000); // 45s overall timeout

      type ExtendedRequestInit = RequestInit & {
        dispatcher?: { close?: () => void };
      };

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Basic ${this.authHeader}`
        },
        body: JSON.stringify(requestBody),
        dispatcher,
        signal: controller.signal
      } as ExtendedRequestInit);

      clearTimeout(totalTimeout);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = (await response.json()) as ProntoApiResponse & T;
      
      console.log(`🚚 Pronto API Response: ${method}`, result);
      
      // Check for API-level errors
      if (result.status === "0") {
        throw new Error(`Pronto API error: ${result.status_ref || 'Unknown error'}`);
      }

      return result;
    } catch (error) {
      console.error(`❌ Pronto API request failed for method ${method} (attempt ${retryCount + 1}):`, error);
      
      // Retry logic for connection timeouts and network errors
      if (retryCount < 2 && error instanceof Error && (
        error.message.includes('Connect Timeout') ||
        error.message.includes('fetch failed') ||
        error.message.includes('ECONNRESET') ||
        error.message.includes('ENOTFOUND')
      )) {
        const delay = (retryCount + 1) * 2000; // 2s, 4s delays
        console.log(`🔄 Retrying Pronto API request in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.makeRequest(method, data, retryCount + 1);
      }
      
      throw error;
    }
  }
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
