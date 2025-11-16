import { NextRequest, NextResponse } from "next/server";
import { createProntoApiService } from "@/lib/prontoApiService";
import { z } from "zod";

const TrackShipmentSchema = z.object({
  trackingNumber: z.string().min(1),
  customerCode: z.string().optional(),
});

/**
 * @swagger
 * /api/shipping/track:
 *   post:
 *     summary: Track a shipment using Pronto tracking number
 *     tags: [Shipping]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - trackingNumber
 *             properties:
 *               trackingNumber:
 *                 type: string
 *                 description: Pronto tracking number
 *                 example: "COD0000120"
 *               customerCode:
 *                 type: string
 *                 description: Optional customer code override
 *                 example: "A001"
 *     responses:
 *       200:
 *         description: Tracking information retrieved successfully
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
 *                     status:
 *                       type: string
 *                       description: Current status
 *                       example: "A"
 *                     statusDescription:
 *                       type: string
 *                       description: Human-readable status description
 *                       example: "Accepted by Pronto Branch"
 *                     trackingHistory:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           status:
 *                             type: string
 *                             example: "A"
 *                           statusDescription:
 *                             type: string
 *                             example: "Accepted by Pronto Branch"
 *                           date:
 *                             type: string
 *                             example: "2024-01-15"
 *                           time:
 *                             type: string
 *                             example: "10:30:00"
 *                           location:
 *                             type: string
 *                             example: "Colombo Branch"
 *                           remarks:
 *                             type: string
 *                             example: "Package received"
 *       400:
 *         description: Invalid request data
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
    const { trackingNumber, customerCode } = TrackShipmentSchema.parse(body);

    // Create Pronto API service
    const prontoApi = createProntoApiService();

    // Get tracking details
    const response = await prontoApi.getTrackingDetails({
      customerCode: customerCode || process.env.PRONTO_CUSTOMER_CODE || 'A001',
      tno: trackingNumber
    });

    // Map status codes to descriptions
    const statusDescriptions: Record<string, string> = {
      'A': 'Accepted by Pronto Branch',
      'I': 'Data Entry to System',
      'S': 'Scanned Out to Delivery Route',
      'C': 'Consignment Delivery Complete',
      'M': 'Interbranch Transit',
      'Delivered': 'Consignment Delivered',
      'Reject': 'Consignment Rejected',
      'Return': 'Consignment Returned'
    };

    type ProntoTrackingEntry = {
      status: string;
      date: string;
      time: string;
      location?: string;
      remarks?: string;
    };

    // Process tracking history
    const trackingHistory = response.emp_tracking.map((entry: ProntoTrackingEntry) => ({
      status: entry.status,
      statusDescription: statusDescriptions[entry.status] || entry.status,
      date: entry.date,
      time: entry.time,
      location: entry.location || '',
      remarks: entry.remarks || ''
    }));

    // Get current status (latest entry)
    const currentStatus = trackingHistory.length > 0 ? trackingHistory[trackingHistory.length - 1] : null;

    return NextResponse.json({
      success: true,
      data: {
        trackingNumber,
        status: currentStatus?.status || 'Unknown',
        statusDescription: currentStatus?.statusDescription || 'Status unknown',
        trackingHistory
      }
    });

  } catch (error) {
    console.error('Shipment tracking error:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid request data",
            details: error.issues
          }
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: {
          code: "TRACKING_FAILED",
          message: "Failed to track shipment. Please check the tracking number and try again."
        }
      },
      { status: 500 }
    );
  }
}
