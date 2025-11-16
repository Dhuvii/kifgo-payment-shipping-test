"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState, Suspense, useCallback } from "react";
import { useMPGS } from "@/components/MPGSProvider";

interface SessionDetails {
  sessionId: string;
  orderId: string;
  amount: number;
  currency: string;
  status: string;
  senderName: string;
  senderPhone: string;
  senderAddress: string;
  receiverName: string;
  receiverPhone: string;
  receiverAddress: string;
  location: string;
  weight: number;
  prontoTrackingNumber?: string | null;
  prontoStatus?: string | null;
}

const PaymentTestContent = () => {
  const searchParams = useSearchParams();
  const defaultSessionId = searchParams.get("sessionId") || "";

  const [sessionInput, setSessionInput] = useState(defaultSessionId);
  const [activeSessionId, setActiveSessionId] = useState(defaultSessionId);
  const [sessionDetails, setSessionDetails] = useState<SessionDetails | null>(
    null
  );
  const [loadError, setLoadError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingDetails, setLoadingDetails] = useState(false);

  const { isLoaded, isError, configureSession, showPaymentPage } = useMPGS();

  const isReadyToShow = useMemo(
    () => isLoaded && !!activeSessionId && !isError,
    [activeSessionId, isError, isLoaded]
  );

  const fetchSession = useCallback(async (sessionId: string) => {
    setLoadError(null);
    setStatusMessage(null);
    setLoadingDetails(true);
    try {
      const response = await fetch(`/api/payments/sessions/${sessionId}`);
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(
          data?.error?.message || "Session not found in local database"
        );
      }
      setSessionDetails(data.data);
      setActiveSessionId(sessionId);
    } catch (error) {
      setSessionDetails(null);
      setLoadError(error instanceof Error ? error.message : "Unknown error");
    } finally {
      setLoadingDetails(false);
    }
  }, []);

  useEffect(() => {
    if (defaultSessionId) {
      fetchSession(defaultSessionId);
    }
  }, [defaultSessionId, fetchSession]);

  useEffect(() => {
    if (!isLoaded || !activeSessionId || isError) {
      return;
    }
    try {
      configureSession(activeSessionId);
      setStatusMessage(`Session ${activeSessionId} configured successfully.`);
    } catch (err) {
      setLoadError(
        err instanceof Error ? err.message : "Failed to configure checkout"
      );
    }
  }, [activeSessionId, configureSession, isError, isLoaded]);

  const handleLoadSession = async () => {
    if (!sessionInput) {
      setLoadError("Enter a session ID to continue.");
      return;
    }
    await fetchSession(sessionInput);
  };

  const handleShowPaymentPage = () => {
    if (!activeSessionId) {
      setLoadError("Load a session before opening checkout.");
      return;
    }
    try {
      setIsLoading(true);
      showPaymentPage();
      setStatusMessage("Checkout opened. Complete the card form in the popup.");
    } catch (err) {
      setLoadError(
        err instanceof Error ? err.message : "Unable to open checkout"
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-10">
      <div className="mx-auto max-w-3xl space-y-6 px-4">
        <section className="rounded-2xl bg-white p-6 shadow">
          <h1 className="text-2xl font-semibold text-gray-900">
            MPGS Checkout Tester
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            Paste a session ID from the dashboard, configure MPGS Checkout, and
            launch the hosted payment page.
          </p>

          <div className="mt-6 space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700">
                Session ID
              </label>
              <input
                type="text"
                value={sessionInput}
                onChange={(event) => setSessionInput(event.target.value)}
                placeholder="SESSION000"
                className="mt-1 w-full rounded-lg border border-gray-300 p-3 font-mono text-sm"
              />
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                onClick={handleLoadSession}
                className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                {loadingDetails ? "Loading..." : "Load Session Details"}
              </button>
              <button
                onClick={handleShowPaymentPage}
                disabled={!isReadyToShow || isLoading}
                className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-50"
              >
                {isLoading
                  ? "Opening checkout..."
                  : !isLoaded
                  ? "Loading MPGS..."
                  : "Show Payment Page"}
              </button>
            </div>
          </div>

          {loadError && (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {loadError}
            </div>
          )}
          {isError && (
            <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              MPGS checkout script failed to load. Confirm
              NEXT_PUBLIC_MPGS_CHECKOUT_SRC is configured correctly.
            </div>
          )}
          {statusMessage && (
            <div className="mt-4 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">
              {statusMessage}
            </div>
          )}
        </section>

        <section className="rounded-2xl bg-white p-6 shadow">
          <h2 className="text-xl font-semibold text-gray-900">
            Session Details
          </h2>
          {!sessionDetails ? (
            <p className="mt-4 text-sm text-gray-500">
              Load a session to inspect the payload that will be used for Pronto
              shipping after payment success.
            </p>
          ) : (
            <div className="mt-4 space-y-4 text-sm text-gray-700">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-xs uppercase text-gray-500">Order</p>
                  <p className="font-medium">{sessionDetails.orderId}</p>
                </div>
                <div>
                  <p className="text-xs uppercase text-gray-500">
                    Amount / Currency
                  </p>
                  <p className="font-medium">
                    {sessionDetails.amount} {sessionDetails.currency}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase text-gray-500">Status</p>
                  <p className="font-medium">{sessionDetails.status}</p>
                </div>
                <div>
                  <p className="text-xs uppercase text-gray-500">Pronto</p>
                  <p className="font-medium">
                    {sessionDetails.prontoTrackingNumber || "Pending"}
                  </p>
                  {sessionDetails.prontoStatus ? (
                    <p className="text-xs text-gray-500">
                      {sessionDetails.prontoStatus}
                    </p>
                  ) : null}
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-xs uppercase text-gray-500">Sender</p>
                  <p className="font-medium">{sessionDetails.senderName}</p>
                  <p>{sessionDetails.senderPhone}</p>
                  <p className="text-gray-500">{sessionDetails.senderAddress}</p>
                </div>
                <div>
                  <p className="text-xs uppercase text-gray-500">Receiver</p>
                  <p className="font-medium">{sessionDetails.receiverName}</p>
                  <p>{sessionDetails.receiverPhone}</p>
                  <p className="text-gray-500">
                    {sessionDetails.receiverAddress}
                  </p>
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-xs uppercase text-gray-500">Location</p>
                  <p className="font-medium">{sessionDetails.location}</p>
                </div>
                <div>
                  <p className="text-xs uppercase text-gray-500">
                    Package Weight
                  </p>
                  <p className="font-medium">{sessionDetails.weight} kg</p>
                </div>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

const PaymentTestPage = () => {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gray-50 py-10">
          <div className="mx-auto max-w-2xl rounded-2xl bg-white p-8 shadow">
            <h1 className="text-xl font-semibold text-gray-900">Loading...</h1>
            <p className="mt-2 text-sm text-gray-600">
              Initializing payment test page.
            </p>
          </div>
        </div>
      }
    >
      <PaymentTestContent />
    </Suspense>
  );
};

export default PaymentTestPage;
