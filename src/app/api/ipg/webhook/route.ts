import { NextRequest, NextResponse } from "next/server";
import { apiStatus } from "../../helpers/apiStatus";
import handleError from "../../helpers/handleError";
import {
  getPaymentSession,
  updatePaymentSession,
} from "@/lib/repositories/paymentSessions";
import { createShipmentForSession } from "@/lib/prontoOrderService";

type WebhookPayload = Record<string, unknown>;

function getString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function extractSessionId(payload: WebhookPayload): string | null {
  const direct = getString(payload.sessionId);
  if (direct) {
    return direct;
  }

  const session = payload.session;
  if (session && typeof session === "object") {
    const nested = (session as { id?: unknown }).id;
    const nestedValue = getString(nested);
    if (nestedValue) {
      return nestedValue;
    }
  }

  const data = payload.data;
  if (data && typeof data === "object") {
    const nestedSession = (data as { session?: { id?: unknown } }).session;
    if (nestedSession && typeof nestedSession === "object") {
      const nestedValue = getString(
        (nestedSession as { id?: unknown }).id
      );
      if (nestedValue) {
        return nestedValue;
      }
    }
  }

  return null;
}

function isPaymentSuccessful(payload: WebhookPayload): boolean {
  const candidates: Array<unknown> = [
    payload.result,
    payload.status,
    payload.paymentStatus,
  ];

  if (payload.transaction && typeof payload.transaction === "object") {
    candidates.push((payload.transaction as { status?: unknown }).status);
  }

  const successValues = new Set(["SUCCESS", "CAPTURED", "APPROVED"]);
  return candidates.some((candidate) => {
    if (typeof candidate !== "string") {
      return false;
    }
    return successValues.has(candidate.toUpperCase());
  });
}

async function processWebhook(request: NextRequest) {
  console.log("🔔 IPG Webhook: Received payment webhook request");
  try {
    const secret = request.headers.get("x-notification-secret");
    if (!secret || secret !== process.env.IPG_WEBHOOK_SECRET) {
      console.log("❌ IPG Webhook: Invalid webhook secret");
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "UNAUTHORIZED",
            message: "Invalid webhook secret",
          },
        },
        { status: apiStatus.UNAUTHORIZED }
      );
    }

    console.log("✅ IPG Webhook: Secret validated successfully");

    const payload: WebhookPayload = await request
      .json()
      .catch(() => ({} as WebhookPayload));
    const sessionId = extractSessionId(payload);

    if (!sessionId) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "INVALID_PAYLOAD",
            message: "Missing MPGS session identifier",
          },
        },
        { status: apiStatus.BAD_REQUEST }
      );
    }

    const session = await getPaymentSession(sessionId);
    if (!session) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "SESSION_NOT_FOUND",
            message: `No local session for ${sessionId}`,
          },
        },
        { status: apiStatus.NOT_FOUND }
      );
    }

    const success = isPaymentSuccessful(payload);
    const metadata = {
      ...(session.metadata || {}),
      lastWebhookAt: new Date().toISOString(),
      lastWebhookPayload: payload,
    };

    await updatePaymentSession(sessionId, {
      status: success ? "COMPLETED" : "FAILED",
      metadata,
    });

    if (!success) {
      return NextResponse.json(
        {
          success: true,
          data: {
            sessionId,
            orderId: session.orderId,
            paymentStatus: "FAILED",
          },
        },
        { status: apiStatus.OK }
      );
    }

    let shipment;
    try {
      shipment = await createShipmentForSession(sessionId);
    } catch (shipmentError) {
      console.error("❌ IPG Webhook: Shipment creation failed", shipmentError);
      await updatePaymentSession(sessionId, {
        prontoStatus: "FAILED",
        metadata: {
          ...metadata,
          lastShipmentError:
            shipmentError instanceof Error
              ? shipmentError.message
              : String(shipmentError),
        },
      });
      throw shipmentError;
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          sessionId,
          orderId: session.orderId,
          paymentStatus: "COMPLETED",
          shipment,
        },
      },
      { status: apiStatus.OK }
    );
  } catch (error) {
    console.error("❌ IPG Webhook: Error processing payment webhook", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return handleError(error, "Failed to process payment webhook");
  }
}

export async function PATCH(request: NextRequest) {
  return processWebhook(request);
}

export async function POST(request: NextRequest) {
  return processWebhook(request);
}
