"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";

interface SessionRecord {
  sessionId: string;
  orderId: string;
  amount: number;
  currency: string;
  status: string;
  prontoTrackingNumber?: string | null;
  prontoStatus?: string | null;
  createdAt: string;
}

const DEFAULT_CURRENCY =
  process.env.NEXT_PUBLIC_MPGS_CURRENCY || process.env.MPGS_CURRENCY || "LKR";

const initialFormState = {
  amount: "1000",
  currency: DEFAULT_CURRENCY,
  description: "Test order from playground",
  orderId: "",
  senderName: "Kifgo Test Warehouse",
  senderPhone: "0112345678",
  senderAddress: "Kifgo HQ, Colombo",
  receiverName: "Uthay",
  receiverPhone: "0777288480",
  receiverAddress: "No 24, Sivan Kovil Rd, Thonikkal, Vavuniya",
  location: "Vavuniya",
  weight: "1",
  isCod: true,
  sameDayDelivery: false,
  isSensitive: false,
  specialNotes: "",
  customerCode: "",
};

export default function Home() {
  const [form, setForm] = useState(initialFormState);
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const isSubmitDisabled = useMemo(() => {
    return (
      loading ||
      !form.amount ||
      !form.description ||
      !form.senderName ||
      !form.senderPhone ||
      !form.senderAddress ||
      !form.receiverName ||
      !form.receiverPhone ||
      !form.receiverAddress ||
      !form.location ||
      !form.weight
    );
  }, [form, loading]);

  async function loadSessions() {
    try {
      const response = await fetch("/api/payments/sessions");
      const data = await response.json();
      if (data.success) {
        setSessions(data.data);
      }
    } catch (err) {
      console.error("Failed to fetch sessions", err);
    }
  }

  useEffect(() => {
    loadSessions();
  }, []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setSuccessMessage(null);

    const payload = {
      amount: parseFloat(form.amount),
      currency: form.currency,
      description: form.description,
      orderId: form.orderId || undefined,
      sender: {
        name: form.senderName,
        phone: form.senderPhone,
        address: form.senderAddress,
      },
      receiver: {
        name: form.receiverName,
        phone: form.receiverPhone,
        address: form.receiverAddress,
      },
      shipment: {
        location: form.location,
        weight: parseFloat(form.weight),
        isCod: form.isCod,
        sameDayDelivery: form.sameDayDelivery,
        isSensitive: form.isSensitive,
        specialNotes: form.specialNotes || undefined,
        customerCode: form.customerCode || undefined,
      },
    };

    try {
      const response = await fetch("/api/payments/create-session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(
          data?.error?.message || "Unable to create payment session"
        );
      }

      setSuccessMessage(
        `Session ${data.data.sessionId} created for order ${data.data.orderId}`
      );
      setForm((prev) => ({
        ...prev,
        orderId: "",
      }));
      await loadSessions();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error");
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value, type, checked } = event.target as HTMLInputElement;
    setForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const copySessionId = async (sessionId: string) => {
    try {
      await navigator.clipboard.writeText(sessionId);
      setSuccessMessage(`Copied ${sessionId} to clipboard`);
    } catch {
      setError("Failed to copy session ID");
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 py-10">
      <div className="mx-auto max-w-6xl space-y-10 px-4">
        <section className="rounded-2xl bg-white p-8 shadow">
          <h1 className="text-2xl font-semibold text-gray-900">
            MPGS Session Playground
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            Generate MPGS sessions with all shipping details, then open the
            checkout with the payment-test tool.
          </p>

          <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
            <div className="grid gap-6 md:grid-cols-2">
              <div>
                <label className="text-sm font-medium text-gray-700">
                  Amount (LKR)
                </label>
                <input
                  type="number"
                  name="amount"
                  value={form.amount}
                  onChange={handleInputChange}
                  className="mt-1 w-full rounded-lg border border-gray-200 p-2"
                  min="1"
                  step="0.01"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">
                  Currency
                </label>
                <input
                  type="text"
                  name="currency"
                  value={form.currency}
                  onChange={handleInputChange}
                  className="mt-1 w-full rounded-lg border border-gray-200 p-2 uppercase"
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700">
                Description
              </label>
              <input
                type="text"
                name="description"
                value={form.description}
                onChange={handleInputChange}
                className="mt-1 w-full rounded-lg border border-gray-200 p-2"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700">
                Order ID (optional)
              </label>
              <input
                type="text"
                name="orderId"
                value={form.orderId}
                onChange={handleInputChange}
                className="mt-1 w-full rounded-lg border border-gray-200 p-2"
                placeholder="Auto-generated if omitted"
              />
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <div>
                <h2 className="text-sm font-semibold text-gray-800">
                  Sender Details
                </h2>
                <div className="mt-2 space-y-3">
                  <input
                    type="text"
                    name="senderName"
                    value={form.senderName}
                    onChange={handleInputChange}
                    className="w-full rounded-lg border border-gray-200 p-2"
                    placeholder="Name"
                  />
                  <input
                    type="text"
                    name="senderPhone"
                    value={form.senderPhone}
                    onChange={handleInputChange}
                    className="w-full rounded-lg border border-gray-200 p-2"
                    placeholder="Phone"
                  />
                  <textarea
                    name="senderAddress"
                    value={form.senderAddress}
                    onChange={handleInputChange}
                    className="w-full rounded-lg border border-gray-200 p-2"
                    placeholder="Address"
                    rows={3}
                  />
                </div>
              </div>
              <div>
                <h2 className="text-sm font-semibold text-gray-800">
                  Receiver Details
                </h2>
                <div className="mt-2 space-y-3">
                  <input
                    type="text"
                    name="receiverName"
                    value={form.receiverName}
                    onChange={handleInputChange}
                    className="w-full rounded-lg border border-gray-200 p-2"
                    placeholder="Name"
                  />
                  <input
                    type="text"
                    name="receiverPhone"
                    value={form.receiverPhone}
                    onChange={handleInputChange}
                    className="w-full rounded-lg border border-gray-200 p-2"
                    placeholder="Phone"
                  />
                  <textarea
                    name="receiverAddress"
                    value={form.receiverAddress}
                    onChange={handleInputChange}
                    className="w-full rounded-lg border border-gray-200 p-2"
                    placeholder="Address"
                    rows={3}
                  />
                </div>
              </div>
            </div>

            <div className="grid gap-6 md:grid-cols-3">
              <div>
                <label className="text-sm font-medium text-gray-700">
                  Delivery City / Location
                </label>
                <input
                  type="text"
                  name="location"
                  value={form.location}
                  onChange={handleInputChange}
                  className="mt-1 w-full rounded-lg border border-gray-200 p-2"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">
                  Package Weight (kg)
                </label>
                <input
                  type="number"
                  name="weight"
                  value={form.weight}
                  onChange={handleInputChange}
                  className="mt-1 w-full rounded-lg border border-gray-200 p-2"
                  step="0.1"
                  min="0.1"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">
                  Pronto Customer Code (optional)
                </label>
                <input
                  type="text"
                  name="customerCode"
                  value={form.customerCode}
                  onChange={handleInputChange}
                  className="mt-1 w-full rounded-lg border border-gray-200 p-2"
                />
              </div>
            </div>

            <div className="grid gap-6 md:grid-cols-3">
              <label className="flex items-center space-x-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  name="isCod"
                  checked={form.isCod}
                  onChange={handleInputChange}
                  className="h-4 w-4 rounded border-gray-300"
                />
                <span>Cash on Delivery</span>
              </label>
              <label className="flex items-center space-x-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  name="sameDayDelivery"
                  checked={form.sameDayDelivery}
                  onChange={handleInputChange}
                  className="h-4 w-4 rounded border-gray-300"
                />
                <span>Same Day Delivery</span>
              </label>
              <label className="flex items-center space-x-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  name="isSensitive"
                  checked={form.isSensitive}
                  onChange={handleInputChange}
                  className="h-4 w-4 rounded border-gray-300"
                />
                <span>Sensitive Item</span>
              </label>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700">
                Special Notes
              </label>
              <textarea
                name="specialNotes"
                value={form.specialNotes}
                onChange={handleInputChange}
                className="mt-1 w-full rounded-lg border border-gray-200 p-2"
                rows={3}
              />
            </div>

            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {error}
              </div>
            )}
            {successMessage && (
              <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">
                {successMessage}
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitDisabled}
              className="w-full rounded-lg bg-blue-600 py-3 text-white transition hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? "Creating session..." : "Create MPGS Session"}
            </button>
          </form>
        </section>

        <section className="rounded-2xl bg-white p-8 shadow">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                Recent Sessions
              </h2>
              <p className="text-sm text-gray-600">
                Copy the session ID and open /payment-test?sessionId=SESSION_ID
                to launch checkout.
              </p>
            </div>
            <button
              onClick={loadSessions}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Refresh
            </button>
          </div>

          <div className="mt-6 overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">
                    Session ID
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">
                    Order
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">
                    Tracking
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sessions.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-4 py-4 text-center text-gray-500"
                    >
                      No sessions yet. Create one above.
                    </td>
                  </tr>
                ) : (
                  sessions.map((session) => (
                    <tr key={session.sessionId}>
                      <td className="px-4 py-3 font-mono text-xs text-gray-900">
                        {session.sessionId}
                      </td>
                      <td className="px-4 py-3 text-gray-700">
                        {session.orderId}
                      </td>
                      <td className="px-4 py-3">
                        <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium uppercase text-gray-700">
                          {session.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-700">
                        {session.prontoTrackingNumber ?? "—"}
                        {session.prontoStatus ? (
                          <span className="ml-2 text-xs text-gray-500">
                            {session.prontoStatus}
                          </span>
                        ) : null}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={() => copySessionId(session.sessionId)}
                            className="rounded border border-gray-300 px-3 py-1 text-xs text-gray-700 hover:bg-gray-50"
                          >
                            Copy
                          </button>
                          <a
                            href={`/payment-test?sessionId=${session.sessionId}`}
                            className="rounded border border-blue-200 px-3 py-1 text-xs text-blue-700 hover:bg-blue-50"
                          >
                            Open Checkout
                          </a>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
