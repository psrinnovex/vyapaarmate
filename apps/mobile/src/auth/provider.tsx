import { createContext, useContext, useEffect, useMemo, useRef, useSyncExternalStore, type PropsWithChildren } from "react";
import { AppState, type AppStateStatus } from "react-native";
import { nativeSession } from "@/auth/session";

type AuthContextValue = ReturnType<typeof nativeSession.getSnapshot> & {
  signIn: typeof nativeSession.signIn;
  signOut: typeof nativeSession.signOut;
  retryRestore: typeof nativeSession.retryRestore;
  forgetSession: typeof nativeSession.forgetSession;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const snapshot = useSyncExternalStore(nativeSession.subscribe, nativeSession.getSnapshot, nativeSession.getSnapshot);
  const previousAppState = useRef<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    void nativeSession.bootstrap();
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (shouldRefreshOnAppStateChange(previousAppState.current, nextState)) {
        void nativeSession.refreshOnResume();
      }
      previousAppState.current = nextState;
    });
    return () => subscription.remove();
  }, []);

  const value = useMemo(
    () => ({
      ...snapshot,
      signIn: nativeSession.signIn.bind(nativeSession),
      signOut: nativeSession.signOut.bind(nativeSession),
      retryRestore: nativeSession.retryRestore.bind(nativeSession),
      forgetSession: nativeSession.forgetSession.bind(nativeSession),
    }),
    [snapshot],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function shouldRefreshOnAppStateChange(previous: AppStateStatus, next: AppStateStatus) {
  return next === "active" && previous !== "active";
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider.");
  return context;
}
