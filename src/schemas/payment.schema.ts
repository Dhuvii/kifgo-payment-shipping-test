import { z } from "zod";

export const ShipmentPartySchema = z.object({
  name: z.string().min(1, "Name is required"),
  phone: z.string().min(3, "Phone is required"),
  address: z.string().min(3, "Address is required"),
});

export const ShipmentDetailsSchema = z.object({
  location: z.string().min(1, "Delivery location is required"),
  weight: z.number().min(0.1, "Weight must be at least 0.1kg").max(100),
  isCod: z.boolean().default(true),
  sameDayDelivery: z.boolean().default(false),
  isSensitive: z.boolean().default(false),
  specialNotes: z.string().optional(),
  customerCode: z.string().optional(),
});

/**
 * Schema for creating a payment session
 */
export const CreatePaymentSessionSchema = z.object({
  amount: z.number().positive("Amount must be a positive number"),
  currency: z.string().length(3, "Currency must be a 3-letter ISO code").optional(),
  description: z
    .string()
    .min(1, "Description is required")
    .max(127, "Description is too long."),
  orderId: z.string().optional(),
  sender: ShipmentPartySchema,
  receiver: ShipmentPartySchema,
  shipment: ShipmentDetailsSchema,
});

/**
 * Schema for payment session response
 */
export const PaymentSessionResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: z.object({
    orderId: z.string(),
    sessionId: z.string(),
    amount: z.number(),
    currency: z.string(),
    deliveryCharge: z.number(),
    pricing: z.object({
      itemAmount: z.number(),
      deliveryCharge: z.number(),
      totalAmount: z.number(),
      currency: z.string(),
    }),
    gatewayResponse: z.any(),
    shipping: z.object({
      sender: ShipmentPartySchema,
      receiver: ShipmentPartySchema,
      shipment: ShipmentDetailsSchema,
    }),
  }),
});

/**
 * Schema for MPGS payment processing
 */
export const MPGSPaymentSchema = z.object({
  internalOrderId: z.string().min(1, "Internal order ID is required"),
  mpgsTransactionId: z.string().min(1, "MPGS transaction ID is required"),
  amount: z.number().positive("Amount must be a positive number"),
  currency: z.string().min(1, "Currency is required"),
  sessionId: z.string().min(1, "Session ID is required"),
});

/**
 * Schema for MPGS payment result
 */
export const MPGSPaymentResultSchema = z.object({
  success: z.boolean(),
  data: z.object({
    transactionId: z.string().optional(),
    isConfirmedImmediately: z.boolean().optional(),
    gatewayResponse: z.any().optional(),
    error: z.string().optional(),
  }),
});

/**
 * Schema for payment error response
 */
export const PaymentErrorSchema = z.object({
  success: z.literal(false),
  error: z.object({
    code: z.string(),
    message: z.string(),
    fields: z.array(z.string()).optional(),
  }),
});

/**
 * Schema for payment status
 */
export const PaymentStatusSchema = z.enum([
  "PENDING",
  "PROCESSING", 
  "COMPLETED",
  "FAILED",
  "CANCELLED",
  "REFUNDED",
]);

/**
 * Schema for payment method
 */
export const PaymentMethodSchema = z.enum([
  "CREDIT_CARD",
  "DEBIT_CARD", 
  "BANK_TRANSFER",
  "DIGITAL_WALLET",
  "CRYPTO",
  "KIFGO_CREDITS",
]);

/**
 * Schema for payment transaction
 */
export const PaymentTransactionSchema = z.object({
  id: z.string(),
  orderId: z.string(),
  amount: z.number(),
  currency: z.string(),
  status: PaymentStatusSchema,
  method: PaymentMethodSchema,
  sessionId: z.string().optional(),
  transactionId: z.string().optional(),
  gatewayResponse: z.any().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

/**
 * Schema for payment session details
 */
export const PaymentSessionDetailsSchema = z.object({
  sessionId: z.string(),
  orderId: z.string(),
  amount: z.number(),
  currency: z.string(),
  description: z.string(),
  status: PaymentStatusSchema,
  returnUrl: z.string(),
  createdAt: z.date(),
  expiresAt: z.date().optional(),
});

export type CreatePaymentSession = z.infer<typeof CreatePaymentSessionSchema>;
export type PaymentSessionResponse = z.infer<typeof PaymentSessionResponseSchema>;
export type MPGSPayment = z.infer<typeof MPGSPaymentSchema>;
export type MPGSPaymentResult = z.infer<typeof MPGSPaymentResultSchema>;
export type PaymentError = z.infer<typeof PaymentErrorSchema>;
export type PaymentStatus = z.infer<typeof PaymentStatusSchema>;
export type PaymentMethod = z.infer<typeof PaymentMethodSchema>;
export type PaymentTransaction = z.infer<typeof PaymentTransactionSchema>;
export type PaymentSessionDetails = z.infer<typeof PaymentSessionDetailsSchema>; 
