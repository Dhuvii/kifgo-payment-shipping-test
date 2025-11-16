import {
  createProntoApiService,
  getAreaCodeForLocation,
} from "@/lib/prontoApiService";
import {
  getPaymentSession,
  updatePaymentSession,
} from "@/lib/repositories/paymentSessions";
import { ProntoCreateShipmentSchema } from "@/schemas/pronto.schema";
import { z } from "zod";

export type ProntoShipmentInput = z.infer<typeof ProntoCreateShipmentSchema>;

export interface ShipmentResult {
  trackingNumber: string;
  cost: number;
  status: string;
  areaCode: string;
  response: Record<string, unknown>;
  payload: Record<string, unknown>;
}

/**
 * Create a shipment directly from raw payload data.
 */
export async function createProntoShipment(
  payload: ProntoShipmentInput
): Promise<ShipmentResult> {
  const prontoApi = createProntoApiService();
  const areaCode = getAreaCodeForLocation(payload.location);

  const trackingResponse = await prontoApi.requestTrackingNumber({
    customerCode:
      payload.customerCode || process.env.PRONTO_CUSTOMER_CODE || "A001",
    tnoCode: payload.isCod ? "2" : "1",
  });

  const trackingNumber = trackingResponse.emp_trackingno.tno;

  const costResponse = await prontoApi.calculateShippingCost({
    customerCode:
      payload.customerCode || process.env.PRONTO_CUSTOMER_CODE || "A001",
    pkgWeight: payload.weight,
    prontoAc: areaCode,
  });

  const shipmentPayload = {
    tno: trackingNumber,
    senName: payload.senderName,
    senPhone: payload.senderPhone,
    senAddress: payload.senderAddress,
    recName: payload.receiverName,
    recAddress: payload.receiverAddress,
    recPhone: payload.receiverPhone,
    ivalue: payload.itemValue.toString(),
    samedayDel: payload.sameDayDelivery ? "yes" : "no",
    senc: payload.isSensitive ? "yes" : "no",
    spNote: payload.specialNotes ?? undefined,
    prontoLc: areaCode.padStart(4, "0"),
  };

  const shipmentResponse = await prontoApi.insertShipment(shipmentPayload);

  const cost = parseFloat(costResponse.live_amount.amount);
  if (shipmentResponse.status !== "1") {
    throw new Error(
      `Shipment creation failed: ${
        (shipmentResponse as Record<string, string>).status_ref ||
        "Unknown error"
      }`
    );
  }

  return {
    trackingNumber,
    cost,
    status: shipmentResponse.status,
    areaCode,
    response: shipmentResponse as Record<string, unknown>,
    payload: shipmentPayload,
  };
}

/**
 * Create a shipment using the stored payment session.
 */
export async function createShipmentForSession(sessionId: string) {
  const session = await getPaymentSession(sessionId);
  if (!session) {
    throw new Error(`Payment session not found for ${sessionId}`);
  }

  const shipmentInput = ProntoCreateShipmentSchema.parse({
    orderId: session.orderId,
    senderName: session.senderName,
    senderPhone: session.senderPhone,
    senderAddress: session.senderAddress,
    receiverName: session.receiverName,
    receiverAddress: session.receiverAddress,
    receiverPhone: session.receiverPhone,
    itemValue: session.amount,
    weight: session.weight,
    location: session.location,
    isCod: session.isCod,
    sameDayDelivery: session.sameDayDelivery,
    isSensitive: session.isSensitive,
    specialNotes: session.specialNotes ?? undefined,
    customerCode: session.prontoCustomerCode ?? undefined,
  });

  const shipment = await createProntoShipment(shipmentInput);

  await updatePaymentSession(sessionId, {
    prontoTrackingNumber: shipment.trackingNumber,
    prontoStatus:
      shipment.status === "1" ? "SHIPMENT_CREATED" : "TRACKING_GENERATED",
    prontoCost: shipment.cost,
    prontoAreaCode: shipment.areaCode,
    prontoPayload: shipment.payload,
    prontoResponse: shipment.response,
    status: "COMPLETED",
  });

  return {
    sessionId,
    orderId: session.orderId,
    ...shipment,
  };
}
