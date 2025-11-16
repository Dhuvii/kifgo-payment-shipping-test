import { NextRequest, NextResponse } from "next/server";
import { format } from "date-fns";
import crypto from "crypto";
import handleError from "../../helpers/handleError";
import { apiStatus } from "../../helpers/apiStatus";
import { CreatePaymentSessionSchema } from "@/schemas/payment.schema";
import { createPaymentSession } from "@/lib/repositories/paymentSessions";

/**
 * @route POST /api/payments/create-session
 * @desc Creates a payment session with MPGS
 * @access Private
 */
export async function POST(request: NextRequest) {
  try {
    // --- 1. Environment Variable Checks ---
    const {
      MPGS_MERCHANT_ID,
      MPGS_API_PASSWORD,
      MPGS_API_BASE_URL,
      BASE_URL,
      MPGS_CURRENCY,
    } = process.env;

    const MPGS_API_VERSION = process.env.MPGS_API_VERSION || "70";

    const requiredEnvVars = {
      MPGS_MERCHANT_ID,
      MPGS_API_PASSWORD,
      MPGS_API_BASE_URL,
      BASE_URL,
      MPGS_CURRENCY,
    };

    for (const [key, value] of Object.entries(requiredEnvVars)) {
      if (!value) {
        throw new Error(`Configuration error: Missing ${key}`);
      }
    }

    // --- 2. Input Processing and Validation ---
    const body = await request.json();
    const normalizedBody = {
      ...body,
      amount:
        typeof body.amount === "string" ? parseFloat(body.amount) : body.amount,
      shipment: body.shipment
        ? {
            ...body.shipment,
            weight:
              typeof body.shipment.weight === "string"
                ? parseFloat(body.shipment.weight)
                : body.shipment.weight,
          }
        : body.shipment,
    };

    const validatedData = CreatePaymentSessionSchema.parse(normalizedBody);

    const { amount, description, sender, receiver, shipment } = validatedData;
    const orderId = validatedData.orderId || crypto.randomUUID();
    const baseCurrency = validatedData.currency || MPGS_CURRENCY;
    const currency = baseCurrency as string;

    // --- 3. Construct API URL ---
    const apiUrl = `${MPGS_API_BASE_URL}/api/rest/version/${MPGS_API_VERSION}/merchant/${MPGS_MERCHANT_ID}/session`;

    // --- 4. Prepare Authentication Header ---
    const username = `merchant.${MPGS_MERCHANT_ID}`;
    const authHeader = `Basic ${Buffer.from(`${username}:${MPGS_API_PASSWORD}`).toString("base64")}`;

    // --- 5. Prepare Request Body ---
    const requestBody = {
      apiOperation: "CREATE_CHECKOUT_SESSION",
      interaction: {
        operation: "PURCHASE",
        merchant: {
          name: "Kifgo",
        },
        returnUrl: `${BASE_URL}/payment-success?orderId=${orderId}`,
      },
      order: {
        id: orderId,
        amount: amount.toFixed(2),
        currency,
        description: description.substring(0, 127),
        customerOrderDate: format(new Date(), "yyyy-MM-dd"),
      },
    };

    // --- 6. Make the API Call ---

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: authHeader,
      },
      body: JSON.stringify(requestBody),
    });

    const responseData = await response.json();

    if (!response.ok) {
      console.error("Failed to create MPGS session:", responseData);
      const errorMessage =
        responseData.error?.explanation ||
        responseData.error?.cause ||
        "Gateway error during session creation.";
      throw new Error(errorMessage);
    }

    if (responseData.result !== "SUCCESS" || !responseData.session?.id) {
      console.error(
        "MPGS session creation indicated failure despite HTTP OK:",
        responseData,
      );
      throw new Error(
        responseData.error?.explanation ||
          "Gateway returned non-SUCCESS result for session creation.",
      );
    }

    await createPaymentSession({
      sessionId: responseData.session.id,
      orderId,
      amount,
      currency,
      description,
      senderName: sender.name,
      senderPhone: sender.phone,
      senderAddress: sender.address,
      receiverName: receiver.name,
      receiverPhone: receiver.phone,
      receiverAddress: receiver.address,
      location: shipment.location,
      weight: shipment.weight,
      isCod: shipment.isCod,
      sameDayDelivery: shipment.sameDayDelivery,
      isSensitive: shipment.isSensitive,
      specialNotes: shipment.specialNotes,
      prontoCustomerCode: shipment.customerCode,
      metadata: {
        gatewayResponse: responseData,
      },
    });

    return NextResponse.json(
      {
        success: true,
        message: "MPGS session created successfully.",
        data: {
          orderId,
          sessionId: responseData.session.id,
          gatewayResponse: responseData,
          shipping: {
            sender,
            receiver,
            shipment,
          },
        },
      },
      { status: apiStatus.CREATED },
    );
  } catch (error) {
    return handleError(error, "Failed to create payment session");
  }
}
