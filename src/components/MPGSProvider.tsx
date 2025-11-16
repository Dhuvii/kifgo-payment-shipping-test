"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

declare global {
  interface Window {
    Checkout?: {
      configure: (options: Record<string, unknown>) => void;
      showPaymentPage: () => void;
      destroy?: () => void;
    };
    mpgsAsyncError?: () => void;
    mpgsAsyncCancel?: () => void;
  }
}

interface MPGSContextValue {
  isLoaded: boolean;
  isError: boolean;
  configureSession: (sessionId: string, options?: Record<string, unknown>) => void;
  showPaymentPage: () => void;
}

const MPGSContext = createContext<MPGSContextValue | null>(null);

const CHECKOUT_SRC = process.env.NEXT_PUBLIC_MPGS_CHECKOUT_SRC || "";

export const MPGSProvider = ({ children }: { children: React.ReactNode }) => {
  const [isLoaded, setIsLoaded] = useState(
    () => typeof window !== "undefined" && !!window.Checkout
  );
  const [isError, setIsError] = useState(!CHECKOUT_SRC);
  const configuredSession = useRef<string | null>(null);
  const scriptRef = useRef<HTMLScriptElement | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    if (!CHECKOUT_SRC) {
      console.error(
        "NEXT_PUBLIC_MPGS_CHECKOUT_SRC is not configured. MPGS checkout cannot load."
      );
      return;
    }

    if (window.Checkout) {
      return;
    }

    const script = document.createElement("script");
    script.src = CHECKOUT_SRC;
    script.async = true;
    script.dataset.error = "mpgsAsyncError";
    script.dataset.cancel = "mpgsAsyncCancel";
    script.onload = () => setIsLoaded(true);
    script.onerror = () => setIsError(true);

    window.mpgsAsyncError = () => setIsError(true);
    window.mpgsAsyncCancel = () => {
      configuredSession.current = null;
    };

    document.body.appendChild(script);
    scriptRef.current = script;

    return () => {
      if (scriptRef.current?.parentNode) {
        scriptRef.current.parentNode.removeChild(scriptRef.current);
      }
      if (window.Checkout?.destroy) {
        window.Checkout.destroy();
      }
      window.Checkout = undefined;
      configuredSession.current = null;
      window.mpgsAsyncError = undefined;
      window.mpgsAsyncCancel = undefined;
    };
  }, []);

  const configureSession = useCallback(
    (sessionId: string, options?: Record<string, unknown>) => {
      if (!window.Checkout) {
        throw new Error("MPGS Checkout has not finished loading.");
      }

      window.Checkout.configure({
        session: {
          id: sessionId,
        },
        interaction: {
          merchant: {
            name: "Kifgo",
          },
          displayControl: {
            billingAddress: "HIDE",
            shippingAddress: "HIDE",
          },
        },
        ...options,
      });

      configuredSession.current = sessionId;
    },
    []
  );

  const showPaymentPage = useCallback(() => {
    if (!window.Checkout) {
      throw new Error("MPGS Checkout has not finished loading.");
    }

    if (!configuredSession.current) {
      throw new Error("Call configureSession before opening the checkout.");
    }

    window.Checkout.showPaymentPage();
  }, []);

  const value = useMemo(
    () => ({
      isLoaded,
      isError,
      configureSession,
      showPaymentPage,
    }),
    [configureSession, isError, isLoaded, showPaymentPage]
  );

  return <MPGSContext.Provider value={value}>{children}</MPGSContext.Provider>;
};

export const useMPGS = () => {
  const ctx = useContext(MPGSContext);
  if (!ctx) {
    throw new Error("useMPGS must be used within an MPGSProvider");
  }
  return ctx;
};
