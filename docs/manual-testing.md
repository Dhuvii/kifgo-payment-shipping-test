# Manual Testing Guide

This project is a sandbox for validating the MPGS → IPG webhook → Pronto shipping flow without depending on Prisma. Follow the steps below to exercise the full path end-to-end.

---

## 1. Prerequisites

1. **Node & npm**  
   Ensure Node 18+ and npm 9+ are available (`node -v`, `npm -v`).

2. **Dependencies**  
   Install packages once per clone:
   ```bash
   npm install
   ```

3. **Environment Variables**  
   Copy `.env.example` → `.env.local`. The template already contains the latest **MPGS UAT** and **Pronto** sandbox values:
   - `MPGS_API_BASE_URL=https://cbcmpgs.gateway.mastercard.com`
   - `MPGS_API_VERSION=61` (remember to keep the checkout script URL in sync: `/checkout/version/61/checkout.js`)
   - `MPGS_MERCHANT_ID=TESTKIFGOPVTLLKR`
   - `MPGS_API_PASSWORD=ab3369518df97337f1af8b3154831e21`
   - `IPG_WEBHOOK_SECRET=17D991DFF7604C39D39BF497EECC0F6B`
   - `PRONTO_API_PASSWORD="a7xJ#uj."` with customer code `A001`
   Update the file if you have different credentials, then restart `npm run dev`.

4. **Static assets**  
   No extra steps; sql.js stores data under `data/app.db` automatically.

---

## 2. Start the Dev Server

```bash
npm run dev
```

The UI will be available at `http://localhost:3000`. All API routes are hosted from the same dev server.

---

## 3. Create MPGS Sessions (UI)

1. Open the root page (`/`). It renders the “MPGS Session Playground”.
2. Fill in:
   - Payment amount, currency, description.
   - Sender / receiver contact info (required by Pronto).
   - Parcel metadata (location, weight, COD flags, etc.).
3. Click **Create MPGS Session**.
4. On success:
   - The backend calls MPGS (`/api/payments/create-session`), stores the request in the sqlite DB, and returns the session ID.
   - The dashboard table below the form refreshes with the new entry. You can copy the session ID or open the checkout in a new tab via `Open Checkout`.

Troubleshooting tips:
- Missing environment vars cause `400` responses – check the toast/error block.
- If MPGS credentials are wrong, the API response will mention the gateway error.

---

## 4. Launch Checkout (Payment Test Page)

1. Navigate to `/payment-test`.
2. Paste a session ID (or open `/payment-test?sessionId=...` from the dashboard link).
3. Click **Load Session Details**. The page fetches `/api/payments/sessions/[sessionId]` and shows the stored sender/receiver details so you can verify you’re using the right payload.
4. Once MPGS checkout script has loaded (`MPGS Status: Loaded`), click **Show Payment Page**. The hosted payment popup appears.
5. Complete the card entry using the MPGS sandbox test cards (Visa 4111111111111111, etc.). The MPGS callbacks are logged in the browser console.

Notes:
- The UI simply opens the hosted checkout; it does **not** confirm success – that happens via the webhook.
- Keep the session ID handy for the next step.

---

## 5. Trigger the IPG Webhook (Manual)

The webhook endpoint (`PATCH /api/ipg/webhook`) verifies an `x-notification-secret` header, checks the session status, and, on success, creates a Pronto shipment. To simulate a gateway callback:

```bash
curl -X PATCH http://localhost:3000/api/ipg/webhook \
  -H "Content-Type: application/json" \
  -H "x-notification-secret: YOUR_SECRET" \
  -d '{
    "result": "SUCCESS",
    "sessionId": "SESSION_ID_FROM_UI"
  }'
```

Replace `YOUR_SECRET` with `IPG_WEBHOOK_SECRET` and `SESSION_ID_FROM_UI` with the session you just completed. Customize the payload if you want to mimic the real MPGS schema (e.g., nest session information under `session.id`). The handler accepts:
- `sessionId`
- or `session.id`
- or `data.session.id`

If the payload indicates success (`result`, `status`, or `paymentStatus` equal to `SUCCESS`, `CAPTURED`, or `APPROVED`), the webhook:
1. Marks the local payment session as `COMPLETED`.
2. Calls Pronto via `createShipmentForSession`.
3. Stores tracking details + cost in sqlite.

Errors will be returned as JSON. Common cases:
- `UNAUTHORIZED` – wrong secret header.
- `SESSION_NOT_FOUND` – session ID does not exist locally.
- `SHIPMENT_FAILED` – Pronto API rejection; usually due to invalid sender/receiver data.

---

## 6. Verify Results

1. Return to `/`. The dashboard table now shows:
   - `status = COMPLETED`
   - `Tracking` column with the Pronto tracking number.
2. To inspect raw data, call:
   ```bash
   curl http://localhost:3000/api/payments/sessions/SESSION_ID
   ```
   You’ll see the stored record including `prontoPayload` + `prontoResponse`.
3. To re-track the shipment (optional), POST to `/api/shipping/track` with `trackingNumber`.

---

## 7. Resetting Between Tests

1. Delete the sqlite file if you want a clean slate:
   ```bash
   rm -f data/app.db
   ```
2. Restart `npm run dev` to ensure sql.js creates a fresh DB.
3. Alternatively, expose a helper to call `resetDatabase()` from `src/lib/database.ts` (only in dev).

---

## 8. Common Pitfalls

| Issue | How to Diagnose | Fix |
| --- | --- | --- |
| Checkout script never loads | `/payment-test` shows “MPGS checkout failed to load” | Ensure `NEXT_PUBLIC_MPGS_CHECKOUT_SRC` points to the correct MPGS environment URL |
| Webhook returns 401 | `curl` response `{"code":"UNAUTHORIZED"}` | Header `x-notification-secret` mismatched |
| Shipment creation fails | Webhook response includes `lastShipmentError` note | Check Pronto credentials and sender/receiver data; see logs in server console |
| Lint/type errors | `npm run lint` / `npx tsc --noEmit` failures | Run `npm install`, confirm tsconfig `paths` and env files exist |

---

## 9. Automation Ideas (Optional)

- Script the webhook trigger in `package.json`:
  ```json
  "scripts": {
    "test:webhook": "node scripts/trigger-webhook.mjs SESSION_ID"
  }
  ```
- Add Playwright/Cypress tests to submit the session form and verify DB output (not provided here, but the API endpoints are test-friendly).

---

By following the sections above, you can reliably test every stage: MPGS session creation, checkout, webhook, and Pronto shipment creation. Let me know if you’d like to automate any part of this flow further. 
