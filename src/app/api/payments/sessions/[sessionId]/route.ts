import { NextRequest, NextResponse } from "next/server";
import handleError from "../../../helpers/handleError";
import { getPaymentSession } from "@/lib/repositories/paymentSessions";
import { apiStatus } from "../../../helpers/apiStatus";

type Params =
  | { sessionId: string }
  | Promise<{ sessionId: string }>;

interface RouteContext {
  params: Params;
}

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const params = await Promise.resolve(context.params);
    const session = await getPaymentSession(params.sessionId);
    if (!session) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "SESSION_NOT_FOUND",
            message: "Payment session not found",
          },
        },
        { status: apiStatus.NOT_FOUND }
      );
    }

    return NextResponse.json({
      success: true,
      data: session,
    });
  } catch (error) {
    return handleError(error, "Failed to load payment session");
  }
}
