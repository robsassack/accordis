"use client";

import {
  createContext,
  useContext,
  useEffect,
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

function getInitialNotationPreference(): NotationPreference {
  if (typeof window === "undefined") {
    return "sharps";
  }

  const storedPreference = window.localStorage.getItem(NOTATION_STORAGE_KEY);
  return storedPreference === "flats" || storedPreference === "sharps"
    ? storedPreference
    : "sharps";
}

export function DetectSessionProvider({ children }: { children: ReactNode }) {
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [notationPreference, setNotationPreference] = useState<NotationPreference>(
    getInitialNotationPreference,
  );

  useEffect(() => {
    window.localStorage.setItem(NOTATION_STORAGE_KEY, notationPreference);
  }, [notationPreference]);

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
