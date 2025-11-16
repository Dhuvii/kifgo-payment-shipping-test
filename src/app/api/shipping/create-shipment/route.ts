import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { ProntoCreateShipmentSchema } from "@/schemas/pronto.schema";
import {
  createProntoShipment,
  createShipmentForSession,
} from "@/lib/prontoOrderService";

const CreateShipmentRequestSchema = z.union([
  z.object({
    sessionId: z.string().min(1),
  }),
  ProntoCreateShipmentSchema,
]);

/**
 * @swagger
 * /api/shipping/create-shipment:
 *   post:
 *     summary: Create a shipment with Pronto Lanka
 *     tags: [Shipping]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - orderId
 *               - receiverName
 *               - receiverAddress
 *               - receiverPhone
 *               - itemValue
 *               - weight
 *               - location
 *             properties:
 *               orderId:
 *                 type: string
 *                 description: Order ID for tracking
 *                 example: "ORD-2024-001"
 *               senderName:
 *                 type: string
 *                 description: Sender name (optional, uses default if not provided)
 *                 example: "John Doe"
 *               senderPhone:
 *                 type: string
 *                 description: Sender phone (optional)
 *                 example: "0771234567"
 *               senderAddress:
 *                 type: string
 *                 description: Sender address (optional, uses default if not provided)
 *                 example: "123 Main St, Colombo"
 *               receiverName:
 *                 type: string
 *                 description: Receiver name
 *                 example: "Jane Smith"
 *               receiverAddress:
 *                 type: string
 *                 description: Receiver address
 *                 example: "456 High St, Kandy"
 *               receiverPhone:
 *                 type: string
 *                 description: Receiver phone
 *                 example: "0779876543"
 *               itemValue:
 *                 type: number
 *                 description: Item value for COD (in LKR)
 *                 example: 5000.00
 *               weight:
 *                 type: number
 *                 description: Package weight in kg
 *                 example: 2.5
 *               location:
 *                 type: string
 *                 description: Delivery location
 *                 example: "Kandy"
 *               isCod:
 *                 type: boolean
 *                 description: Whether this is a COD shipment
 *                 default: true
 *               sameDayDelivery:
 *                 type: boolean
 *                 description: Whether to request same-day delivery
 *                 default: false
 *               isSensitive:
 *                 type: boolean
 *                 description: Whether the item is sensitive
 *                 default: false
 *               specialNotes:
 *                 type: string
 *                 description: Special handling notes
 *                 example: "Handle with care"
 *               customerCode:
 *                 type: string
 *                 description: Optional customer code override
 *                 example: "A001"
 *     responses:
 *       200:
 *         description: Shipment created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     trackingNumber:
 *                       type: string
 *                       description: Pronto tracking number
 *                       example: "COD0000120"
 *                     orderId:
 *                       type: string
 *                       description: Order ID
 *                       example: "ORD-2024-001"
 *                     status:
 *                       type: string
 *                       description: Shipment status
 *                       example: "success"
 *                     cost:
 *                       type: number
 *                       description: Shipping cost in LKR
 *                       example: 450.00
 *       400:
 *         description: Invalid request data
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const payload = CreateShipmentRequestSchema.parse(body);

    if ("sessionId" in payload) {
      const result = await createShipmentForSession(payload.sessionId);
      return NextResponse.json({
        success: true,
        data: {
          trackingNumber: result.trackingNumber,
          orderId: result.orderId,
          status: result.status,
          cost: result.cost,
          areaCode: result.areaCode,
          currency: "LKR",
          sessionId: result.sessionId,
        },
      });
    }

    const shipmentPayload = ProntoCreateShipmentSchema.parse(payload);
    const result = await createProntoShipment(shipmentPayload);
    return NextResponse.json({
      success: true,
      data: {
        trackingNumber: result.trackingNumber,
        orderId: shipmentPayload.orderId,
        status: result.status,
        cost: result.cost,
        areaCode: result.areaCode,
        currency: "LKR",
      },
    });
  } catch (error) {
    console.error("Shipment creation error:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid request data",
            details: error.issues,
          },
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: {
          code: "SHIPMENT_CREATION_FAILED",
          message: error instanceof Error ? error.message : "Failed to create shipment. Please try again later.",
        },
      },
      { status: 500 }
    );
  }
}
