import { NextRequest, NextResponse } from "next/server";
import { createProntoApiService, getAreaCodeForLocation } from "@/lib/prontoApiService";
import { z } from "zod";

const EstimateShippingSchema = z.object({
  weight: z.number().min(0.1).max(100), // Weight in kg
  location: z.string().min(1), // Delivery location
  customerCode: z.string().optional(), // Optional customer code override
});

/**
 * @swagger
 * /api/shipping/estimate:
 *   post:
 *     summary: Estimate shipping cost using Pronto API
 *     tags: [Shipping]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - weight
 *               - location
 *             properties:
 *               weight:
 *                 type: number
 *                 minimum: 0.1
 *                 maximum: 100
 *                 description: Package weight in kilograms
 *                 example: 2.5
 *               location:
 *                 type: string
 *                 description: Delivery location (city/district)
 *                 example: "Colombo"
 *               customerCode:
 *                 type: string
 *                 description: Optional customer code override
 *                 example: "A001"
 *     responses:
 *       200:
 *         description: Shipping cost estimation successful
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
 *                     cost:
 *                       type: number
 *                       description: Estimated shipping cost in LKR
 *                       example: 450.00
 *                     weight:
 *                       type: number
 *                       description: Package weight in kg
 *                       example: 2.5
 *                     location:
 *                       type: string
 *                       description: Delivery location
 *                       example: "Colombo"
 *                     areaCode:
 *                       type: string
 *                       description: Pronto area code used
 *                       example: "1"
 *                     currency:
 *                       type: string
 *                       description: Currency code
 *                       example: "LKR"
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
    const { weight, location, customerCode } = EstimateShippingSchema.parse(body);

    // Get area code for the location
    const areaCode = getAreaCodeForLocation(location);

    // Create Pronto API service
    const prontoApi = createProntoApiService();

    // Calculate shipping cost
    const response = await prontoApi.calculateShippingCost({
      customerCode: customerCode || process.env.PRONTO_CUSTOMER_CODE || 'A001',
      pkgWeight: weight,
      prontoAc: areaCode
    });

    const cost = parseFloat(response.live_amount.amount);

    return NextResponse.json({
      success: true,
      data: {
        cost,
        weight,
        location,
        areaCode,
        currency: 'LKR'
      }
    });

  } catch (error) {
    console.error('Shipping estimation error:', error);

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
          code: "SHIPPING_ESTIMATION_FAILED",
          message: "Failed to estimate shipping cost. Please try again later."
        }
      },
      { status: 500 }
    );
  }
}
