"use client";

import Script from "next/script";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";

// TypeScript definitions for MPGS
declare global {
  interface Window {
    Checkout?: {
      configure: (config: { session: { id: string } }) => void;
      showPaymentPage: () => void;
    };
    cancelCallback?: () => void;
    errorCallback?: (error: unknown) => void;
    successCallback?: (data: unknown) => void;
  }
}

interface MPGSContextType {
  isLoaded: boolean;
  isError: boolean;
  configureSession: (sessionId: string) => void;
  showPaymentPage: () => void;
}

const MPGSContext = createContext<MPGSContextType | null>(null);

export const useMPGS = () => {
  const context = useContext(MPGSContext);
  if (!context) {
    throw new Error("useMPGS must be used within MPGSProvider");
  }
  return context;
};

interface MPGSProviderProps {
  children: ReactNode;
}

export const MPGSProvider = ({ children }: MPGSProviderProps) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isError, setIsError] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);

  useEffect(() => {
    // Set up global callbacks
    window.cancelCallback = function () {
      console.log("MPGS: Payment cancelled");
    };

    window.errorCallback = function (error) {
      console.log("MPGS: Payment error", error);
      setIsError(true);
    };

    window.successCallback = function (data) {
      console.log("MPGS: Payment success", data);
    };
  }, []);

  const configureSession = (sessionId: string) => {
    if (!window.Checkout) {
      console.error("MPGS Checkout not loaded");
      return;
    }

    try {
      window.Checkout.configure({
        session: {
          id: sessionId,
        },
      });
      setCurrentSessionId(sessionId);
      console.log("MPGS: Session configured", sessionId);
    } catch (error) {
      console.error("MPGS: Failed to configure session", error);
      setIsError(true);
    }
  };

  const showPaymentPage = () => {
    if (!window.Checkout) {
      console.error("MPGS Checkout not loaded");
      return;
    }

    if (!currentSessionId) {
      console.error("MPGS: No session configured");
      return;
    }

    try {
      window.Checkout.showPaymentPage();
    } catch (error) {
      console.error("MPGS: Failed to show payment page", error);
      setIsError(true);
    }
  };

  const handleScriptLoad = () => {
    console.log("MPGS: Script loaded successfully");
    setIsLoaded(true);
    setIsError(false);
  };

  const handleScriptError = () => {
    console.error("MPGS: Failed to load script");
    setIsError(true);
  };

  const contextValue: MPGSContextType = {
    isLoaded,
    isError,
    configureSession,
    showPaymentPage,
  };

  return (
    <MPGSContext.Provider value={contextValue}>
      <Script
        src="https://cbcmpgs.gateway.mastercard.com/checkout/version/61/checkout.js"
        data-error="errorCallback"
        data-cancel="cancelCallback"
        onLoad={handleScriptLoad}
        onError={handleScriptError}
        strategy="lazyOnload"
      />
      {children}
    </MPGSContext.Provider>
  );
};
