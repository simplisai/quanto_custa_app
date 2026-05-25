import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

// ─────────────────────────────────────────────────────────────────────────────
// Subscription types (exported so pages can use them)
// ─────────────────────────────────────────────────────────────────────────────

export type SubStatus =
  | "trialing"
  | "active"
  | "past_due"
  | "suspended"
  | "canceled"
  | "expired";

export interface SubData {
  id: string;
  status: SubStatus;
  billing_cycle: "monthly" | "annual";
  amount_cents: number;
  trial_ends_at: string | null;
  current_period_end: string | null;
  canceled_at: string | null;
  started_at: string;
  card_last_four: string | null;
  card_brand: string | null;
  simplispay_subscription_id: string | null;
  plans: { name: string } | null;
}

/** Statuses that grant full access to the platform */
const ALLOWED_STATUSES: SubStatus[] = ["trialing", "active"];

// ─────────────────────────────────────────────────────────────────────────────
// Context shape
// ─────────────────────────────────────────────────────────────────────────────

interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  session: Session | null;
  isAdmin: boolean;
  /** True until both auth AND subscription data are fully loaded */
  loading: boolean;
  subscription: SubData | null;
  /** True only during an explicit refreshSubscription() call */
  subscriptionLoading: boolean;
  /**
   * True when the session exists, admin check is done, loading is false,
   * and the subscription is null or in a non-allowed status.
   * Admins are never blocked.
   */
  isAccessBlocked: boolean;
  /** Re-fetches subscription from DB; useful after cancel/reactivate */
  refreshSubscription: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

async function fetchAdminRole(userId: string): Promise<boolean> {
  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  return !!data;
}

async function fetchSubscription(userId: string): Promise<SubData | null> {
  const { data } = await supabase
    .from("subscriptions")
    .select("*, plans(name)")
    .eq("user_id", userId)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as SubData | null) ?? null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Provider
// ─────────────────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [subscription, setSubscription] = useState<SubData | null>(null);
  const [subscriptionLoading, setSubscriptionLoading] = useState(false);

  // Exposed to pages that mutate subscription state (e.g. cancel, reactivate)
  const refreshSubscription = useCallback(async () => {
    const {
      data: { session: s },
    } = await supabase.auth.getSession();
    if (!s?.user) {
      setSubscription(null);
      return;
    }
    setSubscriptionLoading(true);
    try {
      const sub = await fetchSubscription(s.user.id);
      setSubscription(sub);
    } catch {
      setSubscription(null);
    } finally {
      setSubscriptionLoading(false);
    }
  }, []);

  useEffect(() => {
    // Listen for subsequent auth events (sign-in after sign-out, token refresh…)
    const {
      data: { subscription: authListener },
    } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      if (s?.user) {
        // Don't block the render — run in background
        setTimeout(async () => {
          const [admin, sub] = await Promise.all([
            fetchAdminRole(s.user.id).catch(() => false),
            fetchSubscription(s.user.id).catch(() => null),
          ]);
          setIsAdmin(admin);
          setSubscription(sub);
        }, 0);
      } else {
        setIsAdmin(false);
        setSubscription(null);
      }
    });

    // Initial session: fetch everything before clearing the loading gate so
    // the auth guard never fires with stale data.
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      if (data.session?.user) {
        const userId = data.session.user.id;
        const [admin, sub] = await Promise.all([
          fetchAdminRole(userId).catch(() => false),
          fetchSubscription(userId).catch(() => null),
        ]);
        setIsAdmin(admin);
        setSubscription(sub);
      }
      setLoading(false);
    });

    return () => authListener.unsubscribe();
  }, []);

  // Derived: blocked when session exists, not admin, and subscription missing/invalid
  const isAccessBlocked =
    !loading &&
    !!session &&
    !isAdmin &&
    (subscription === null ||
      !ALLOWED_STATUSES.includes(subscription.status));

  const value: AuthState = {
    isAuthenticated: !!session,
    user: session?.user ?? null,
    session,
    isAdmin,
    loading,
    subscription,
    subscriptionLoading,
    isAccessBlocked,
    refreshSubscription,
    signOut: async () => {
      await supabase.auth.signOut();
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────────────────────

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
