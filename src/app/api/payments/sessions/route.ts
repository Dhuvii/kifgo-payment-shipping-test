import { NextRequest, NextResponse } from "next/server";
import { listPaymentSessions } from "@/lib/repositories/paymentSessions";
import handleError from "../../helpers/handleError";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limitParam = searchParams.get("limit");
    const limit = limitParam ? Math.min(parseInt(limitParam, 10) || 50, 100) : 50;
    const sessions = await listPaymentSessions(limit);

    return NextResponse.json({
      success: true,
      data: sessions,
    });
  } catch (error) {
    return handleError(error, "Failed to list payment sessions");
  }
}
