"use client";

import {
  createContext,
  useCallback,
  useContext,
  useSyncExternalStore,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import type { NotationPreference } from "@/lib/piano";

type DetectSessionContextValue = {
  selectedKeys: string[];
  setSelectedKeys: Dispatch<SetStateAction<string[]>>;
  notationPreference: NotationPreference;
  setNotationPreference: Dispatch<SetStateAction<NotationPreference>>;
};

const DetectSessionContext = createContext<DetectSessionContextValue | null>(null);
const NOTATION_STORAGE_KEY = "accordis-notation-preference";
const NOTATION_STORAGE_EVENT = "accordis-notation-preference-change";

function getStoredNotationPreference(): NotationPreference {
  if (typeof window === "undefined") {
    return "sharps";
  }

  const storedPreference = window.localStorage.getItem(NOTATION_STORAGE_KEY);
  return storedPreference === "flats" || storedPreference === "sharps" ? storedPreference : "sharps";
}

function subscribeToNotationPreference(onStoreChange: () => void): () => void {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  const handleStorageChange = (event: StorageEvent): void => {
    if (event.key === NOTATION_STORAGE_KEY) {
      onStoreChange();
    }
  };
  const handleLocalChange = (): void => {
    onStoreChange();
  };

  window.addEventListener("storage", handleStorageChange);
  window.addEventListener(NOTATION_STORAGE_EVENT, handleLocalChange);

  return () => {
    window.removeEventListener("storage", handleStorageChange);
    window.removeEventListener(NOTATION_STORAGE_EVENT, handleLocalChange);
  };
}

function setStoredNotationPreference(nextPreference: NotationPreference): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(NOTATION_STORAGE_KEY, nextPreference);
  window.dispatchEvent(new Event(NOTATION_STORAGE_EVENT));
}

export function DetectSessionProvider({ children }: { children: ReactNode }) {
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const notationPreference = useSyncExternalStore(
    subscribeToNotationPreference,
    getStoredNotationPreference,
    () => "sharps",
  );
  const setNotationPreference = useCallback<Dispatch<SetStateAction<NotationPreference>>>((value) => {
    const currentPreference = getStoredNotationPreference();
    const nextPreference =
      typeof value === "function" ? value(currentPreference) : value;
    setStoredNotationPreference(nextPreference);
  }, []);

  return (
    <DetectSessionContext.Provider
      value={{ selectedKeys, setSelectedKeys, notationPreference, setNotationPreference }}
    >
      {children}
    </DetectSessionContext.Provider>
  );
}

export function useDetectSession() {
  const context = useContext(DetectSessionContext);
  if (!context) {
    throw new Error("useDetectSession must be used within DetectSessionProvider");
  }
  return context;
}
