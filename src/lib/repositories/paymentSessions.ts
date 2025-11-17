import { runRead, runWrite } from "@/lib/database";
import type { BindParams, SqlValue } from "sql.js";

export type PaymentSessionStatus =
  | "PENDING"
  | "COMPLETED"
  | "FAILED";

export interface PaymentSessionRecord {
  sessionId: string;
  orderId: string;
  amount: number;
  currency: string;
  description: string;
  status: PaymentSessionStatus;
  senderName: string;
  senderPhone: string;
  senderAddress: string;
  receiverName: string;
  receiverPhone: string;
  receiverAddress: string;
  location: string;
  weight: number;
  isCod: boolean;
  sameDayDelivery: boolean;
  isSensitive: boolean;
  specialNotes?: string | null;
  prontoCustomerCode?: string | null;
  metadata?: Record<string, unknown> | null;
  prontoTrackingNumber?: string | null;
  prontoStatus?: string | null;
  prontoAreaCode?: string | null;
  prontoCost?: number | null;
  prontoPayload?: Record<string, unknown> | null;
  prontoResponse?: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePaymentSessionInput {
  sessionId: string;
  orderId: string;
  amount: number;
  currency: string;
  description: string;
  senderName: string;
  senderPhone: string;
  senderAddress: string;
  receiverName: string;
  receiverPhone: string;
  receiverAddress: string;
  location: string;
  weight: number;
  isCod: boolean;
  sameDayDelivery: boolean;
  isSensitive: boolean;
  specialNotes?: string;
  prontoCustomerCode?: string;
  prontoAreaCode?: string;
  prontoCost?: number;
  metadata?: Record<string, unknown>;
}

export type UpdatePaymentSessionInput = Partial<
  Omit<CreatePaymentSessionInput, "sessionId">
> & {
  status?: PaymentSessionStatus;
  prontoTrackingNumber?: string | null;
  prontoStatus?: string | null;
  prontoAreaCode?: string | null;
  prontoCost?: number | null;
  prontoPayload?: Record<string, unknown> | null;
  prontoResponse?: Record<string, unknown> | null;
};

const baseSelect = `
  SELECT
    session_id AS sessionId,
    order_id AS orderId,
    amount,
    currency,
    description,
    status,
    sender_name AS senderName,
    sender_phone AS senderPhone,
    sender_address AS senderAddress,
    receiver_name AS receiverName,
    receiver_phone AS receiverPhone,
    receiver_address AS receiverAddress,
    location,
    weight,
    is_cod AS isCod,
    same_day AS sameDayDelivery,
    is_sensitive AS isSensitive,
    special_notes AS specialNotes,
    pronto_customer_code AS prontoCustomerCode,
    metadata AS metadataJson,
    pronto_tracking_number AS prontoTrackingNumber,
    pronto_status AS prontoStatus,
    pronto_area_code AS prontoAreaCode,
    pronto_cost AS prontoCost,
    pronto_payload AS prontoPayloadJson,
    pronto_response AS prontoResponseJson,
    created_at AS createdAt,
    updated_at AS updatedAt
  FROM payment_sessions
`;

function mapRow(row: Record<string, unknown>): PaymentSessionRecord {
  return {
    sessionId: String(row.sessionId),
    orderId: String(row.orderId),
    amount: Number(row.amount),
    currency: String(row.currency),
    description: String(row.description),
    status: row.status as PaymentSessionStatus,
    senderName: String(row.senderName),
    senderPhone: String(row.senderPhone),
    senderAddress: String(row.senderAddress),
    receiverName: String(row.receiverName),
    receiverPhone: String(row.receiverPhone),
    receiverAddress: String(row.receiverAddress),
    location: String(row.location),
    weight: Number(row.weight),
    isCod: Boolean(row.isCod),
    sameDayDelivery: Boolean(row.sameDayDelivery),
    isSensitive: Boolean(row.isSensitive),
    specialNotes: row.specialNotes ? String(row.specialNotes) : null,
    prontoCustomerCode: row.prontoCustomerCode
      ? String(row.prontoCustomerCode)
      : null,
    metadata: row.metadataJson ? JSON.parse(String(row.metadataJson)) : null,
    prontoTrackingNumber: row.prontoTrackingNumber
      ? String(row.prontoTrackingNumber)
      : null,
    prontoStatus: row.prontoStatus ? String(row.prontoStatus) : null,
    prontoAreaCode: row.prontoAreaCode ? String(row.prontoAreaCode) : null,
    prontoCost:
      row.prontoCost === null || row.prontoCost === undefined
        ? null
        : Number(row.prontoCost),
    prontoPayload: row.prontoPayloadJson
      ? JSON.parse(String(row.prontoPayloadJson))
      : null,
    prontoResponse: row.prontoResponseJson
      ? JSON.parse(String(row.prontoResponseJson))
      : null,
    createdAt: String(row.createdAt),
    updatedAt: String(row.updatedAt),
  };
}

export async function createPaymentSession(
  data: CreatePaymentSessionInput
): Promise<PaymentSessionRecord> {
  const now = new Date().toISOString();
  await runWrite((db) => {
    db.run(
      `
        INSERT INTO payment_sessions (
          session_id,
          order_id,
          amount,
          currency,
          description,
          status,
          sender_name,
          sender_phone,
          sender_address,
          receiver_name,
          receiver_phone,
          receiver_address,
          location,
          weight,
          is_cod,
          same_day,
          is_sensitive,
          special_notes,
          pronto_customer_code,
          pronto_area_code,
          pronto_cost,
          metadata,
          created_at,
          updated_at
        ) VALUES (
          $sessionId,
          $orderId,
          $amount,
          $currency,
          $description,
          $status,
          $senderName,
          $senderPhone,
          $senderAddress,
          $receiverName,
          $receiverPhone,
          $receiverAddress,
          $location,
          $weight,
          $isCod,
          $sameDayDelivery,
          $isSensitive,
          $specialNotes,
          $prontoCustomerCode,
          $prontoAreaCode,
          $prontoCost,
          $metadata,
          $createdAt,
          $updatedAt
        )
      `,
      {
        $sessionId: data.sessionId,
        $orderId: data.orderId,
        $amount: data.amount,
        $currency: data.currency,
        $description: data.description,
        $status: "PENDING",
        $senderName: data.senderName,
        $senderPhone: data.senderPhone,
        $senderAddress: data.senderAddress,
        $receiverName: data.receiverName,
        $receiverPhone: data.receiverPhone,
        $receiverAddress: data.receiverAddress,
        $location: data.location,
        $weight: data.weight,
        $isCod: data.isCod ? 1 : 0,
        $sameDayDelivery: data.sameDayDelivery ? 1 : 0,
        $isSensitive: data.isSensitive ? 1 : 0,
        $specialNotes: data.specialNotes ?? null,
        $prontoCustomerCode: data.prontoCustomerCode ?? null,
        $prontoAreaCode: data.prontoAreaCode ?? null,
        $prontoCost:
          typeof data.prontoCost === "number" ? data.prontoCost : null,
        $metadata: data.metadata ? JSON.stringify(data.metadata) : null,
        $createdAt: now,
        $updatedAt: now,
      }
    );
  });

  const created = await getPaymentSession(data.sessionId);
  if (!created) {
    throw new Error("Failed to create payment session");
  }
  return created;
}

export async function updatePaymentSession(
  sessionId: string,
  updates: UpdatePaymentSessionInput
): Promise<PaymentSessionRecord> {
  const fields: string[] = [];
  const params: BindParams = { $sessionId: sessionId };

  const fieldMap: Record<string, string> = {
    orderId: "order_id",
    amount: "amount",
    currency: "currency",
    description: "description",
    status: "status",
    senderName: "sender_name",
    senderPhone: "sender_phone",
    senderAddress: "sender_address",
    receiverName: "receiver_name",
    receiverPhone: "receiver_phone",
    receiverAddress: "receiver_address",
    location: "location",
    weight: "weight",
    specialNotes: "special_notes",
    prontoCustomerCode: "pronto_customer_code",
    prontoTrackingNumber: "pronto_tracking_number",
    prontoStatus: "pronto_status",
    prontoAreaCode: "pronto_area_code",
    prontoCost: "pronto_cost",
  };

  (Object.entries(fieldMap) as Array<
    [keyof UpdatePaymentSessionInput, string]
  >).forEach(([key, column]) => {
    if (Object.prototype.hasOwnProperty.call(updates, key)) {
      const paramKey = `$${key}`;
      const value = updates[key];
      if (value !== undefined) {
        params[paramKey] = value as SqlValue;
        fields.push(`${column} = ${paramKey}`);
      }
    }
  });

  if ("isCod" in updates) {
    params.$isCod = updates.isCod ? 1 : 0;
    fields.push("is_cod = $isCod");
  }

  if ("sameDayDelivery" in updates) {
    params.$sameDay = updates.sameDayDelivery ? 1 : 0;
    fields.push("same_day = $sameDay");
  }

  if ("isSensitive" in updates) {
    params.$isSensitive = updates.isSensitive ? 1 : 0;
    fields.push("is_sensitive = $isSensitive");
  }

  if ("metadata" in updates) {
    params.$metadata = updates.metadata
      ? JSON.stringify(updates.metadata)
      : null;
    fields.push("metadata = $metadata");
  }

  if ("prontoPayload" in updates) {
    params.$prontoPayload = updates.prontoPayload
      ? JSON.stringify(updates.prontoPayload)
      : null;
    fields.push("pronto_payload = $prontoPayload");
  }

  if ("prontoResponse" in updates) {
    params.$prontoResponse = updates.prontoResponse
      ? JSON.stringify(updates.prontoResponse)
      : null;
    fields.push("pronto_response = $prontoResponse");
  }

  const now = new Date().toISOString();
  params.$updatedAt = now;
  fields.push("updated_at = $updatedAt");

  if (fields.length === 0) {
    const existing = await getPaymentSession(sessionId);
    if (!existing) {
      throw new Error("Payment session not found");
    }
    return existing;
  }

  await runWrite((db) => {
    db.run(
      `UPDATE payment_sessions SET ${fields.join(", ")} WHERE session_id = $sessionId`,
      params
    );
  });

  const updated = await getPaymentSession(sessionId);
  if (!updated) {
    throw new Error("Payment session not found after update");
  }
  return updated;
}

export async function listPaymentSessions(limit = 50): Promise<PaymentSessionRecord[]> {
  const rows = await runRead((db) => {
    const stmt = db.prepare(
      `${baseSelect} ORDER BY datetime(created_at) DESC LIMIT ?`
    );
    const results: Record<string, unknown>[] = [];
    stmt.bind([limit]);
    while (stmt.step()) {
      results.push(stmt.getAsObject());
    }
    stmt.free();
    return results;
  });

  return rows.map((row) => mapRow(row));
}

export async function getPaymentSession(
  sessionId: string
): Promise<PaymentSessionRecord | null> {
  const row = await runRead((db) => {
    const stmt = db.prepare(`${baseSelect} WHERE session_id = ?`);
    stmt.bind([sessionId]);
    const result = stmt.step()
      ? (stmt.getAsObject() as Record<string, unknown>)
      : null;
    stmt.free();
    return result;
  });

  return row ? mapRow(row) : null;
}
