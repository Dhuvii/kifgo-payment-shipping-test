import { z } from "zod";

/**
 * Schema for Pronto shipping estimation request
 */
export const ProntoEstimateSchema = z.object({
  weight: z.number().min(0.1).max(100), // Weight in kg
  location: z.string().min(1), // Delivery location
  customerCode: z.string().optional(), // Optional customer code override
});

/**
 * Schema for Pronto shipment creation request
 */
export const ProntoCreateShipmentSchema = z.object({
  orderId: z.string().min(1),
  senderName: z.string().min(1),
  senderPhone: z.string().min(3),
  senderAddress: z.string().min(3),
  receiverName: z.string().min(1),
  receiverAddress: z.string().min(1),
  receiverPhone: z.string().min(1),
  itemValue: z.number().min(0), // COD amount
  weight: z.number().min(0.1).max(100),
  location: z.string().min(1),
  isCod: z.boolean().default(true),
  sameDayDelivery: z.boolean().default(false),
  isSensitive: z.boolean().default(false),
  specialNotes: z.string().optional(),
  customerCode: z.string().optional(),
});

/**
 * Schema for Pronto tracking request
 */
export const ProntoTrackingSchema = z.object({
  trackingNumber: z.string().min(1),
  customerCode: z.string().optional(),
});

/**
 * Schema for Pronto cost estimation response
 */
export const ProntoEstimateResponseSchema = z.object({
  cost: z.number(),
  weight: z.number(),
  location: z.string(),
  areaCode: z.string(),
  currency: z.string(),
});

/**
 * Schema for Pronto shipment creation response
 */
export const ProntoShipmentResponseSchema = z.object({
  trackingNumber: z.string(),
  orderId: z.string(),
  status: z.string(),
  cost: z.number(),
  areaCode: z.string(),
  currency: z.string(),
});

/**
 * Schema for Pronto tracking response
 */
export const ProntoTrackingResponseSchema = z.object({
  trackingNumber: z.string(),
  status: z.string(),
  statusDescription: z.string(),
  trackingHistory: z.array(
    z.object({
      status: z.string(),
      statusDescription: z.string(),
      date: z.string(),
      time: z.string(),
      location: z.string(),
      remarks: z.string(),
    })
  ),
});

/**
 * Schema for Pronto configuration response
 */
export const ProntoConfigResponseSchema = z.object({
  baseUrl: z.string(),
  customerCode: z.string(),
  connectionStatus: z.string(),
  rateStructure: z.string(),
});
