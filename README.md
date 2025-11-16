## Payment + Shipping Testbed

This Next.js sandbox lets you simulate the full Kifgo payment + shipping flow:

- Generate MPGS checkout sessions with sender/receiver/shipping metadata.
- Paste or select a session to launch the MPGS hosted checkout page.
- Verify the IPG webhook updates the local record and triggers Pronto shipment creation automatically.
- Track shipping metadata that is stored locally using an embedded SQLite database (`sql.js`).

Everything is self-contained so you can test without Prisma or an external database.

---

### 1. Prerequisites

- Node.js 18+ (Next 16 prefers 20+, but 18.14.2 works for local dev with a few warnings).
- npm 9+
- MPGS + Pronto sandbox credentials.

### 2. Environment Variables

Copy `.env.example` to `.env.local` and fill in the credentials:

```bash
cp .env.example .env.local
```

Key values:

- `MPGS_*` (merchant id, password, API base URL, etc.).
- `NEXT_PUBLIC_MPGS_CHECKOUT_SRC` – URL to the MPGS `checkout.js` script (exposed to the browser).
- `PRONTO_*` – API credentials + default sender info.
- `IPG_WEBHOOK_SECRET` – shared secret for the webhook endpoint.
- Optional `DATABASE_PATH` for the sqlite file (defaults to `./data/app.db`).

### 3. Install & Run

```bash
npm install
npm run dev
```

The SQL.js database file is created on demand (`data/app.db`).

### 4. Workflow

1. **Create a session** on `/`:
   - Fill sender/receiver/parcel details and click “Create MPGS Session”.
   - Records are persisted in SQLite via the new `payment_sessions` table.
2. **Launch checkout** on `/payment-test`:
   - Paste the session ID or click “Open Checkout” from the dashboard table.
   - The MPGS provider loads `checkout.js`, configures the session, and opens the hosted payment page.
3. **Simulate a webhook**:
   - Send a `PATCH /api/ipg/webhook` request with header `x-notification-secret`.
   - Body must include `sessionId` (or nested `session.id`); on success it updates the session, calls Pronto, and stores tracking info.
4. **Verify shipments** in the dashboard table – tracking number + Pronto status are displayed automatically.

### 5. Useful API Routes

- `POST /api/payments/create-session` – calls MPGS, stores payload locally.
- `GET /api/payments/sessions` – latest sessions (used by the dashboard).
- `GET /api/payments/sessions/:sessionId` – inspect a single record.
- `PATCH /api/ipg/webhook` – validates the shared secret, updates payment status, and creates Pronto shipments.
- `POST /api/shipping/create-shipment` – create a shipment either by passing `sessionId` or raw sender/receiver data.

### 6. Notes

- The lightweight data layer uses [`sql.js`](https://github.com/sql-js/sql.js) so no external database service or Prisma client is required.
- MPGS Checkout requires the script URL to be accessible from the browser. Set `NEXT_PUBLIC_MPGS_CHECKOUT_SRC` accordingly.
- Pronto shipment creation logs errors but still stores the attempted payload for debugging.
- The app is intentionally NOT production hardened (no auth, no rate limiting) – it’s for local/manual QA flows only.
