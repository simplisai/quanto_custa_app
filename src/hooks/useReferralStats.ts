import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface ReferralStats {
  referral_code: string | null;
  total_pending: number;
  total_converted: number;
  months_earned: number;
  months_credit: number;
  max_months: number;
}

interface UseReferralStatsResult {
  stats: ReferralStats | null;
  loading: boolean;
  /** Link curto de indicação: https://quantocusta.pro/{code} */
  referralLink: string;
  refresh: () => void;
}

// URL base da aplicação — link curto de indicação
const APP_BASE_URL = 'https://quantocusta.pro';

export function useReferralStats(userId: string | undefined): UseReferralStatsResult {
  const [stats, setStats] = useState<ReferralStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const { data, error } = await supabase.rpc('get_referral_stats', {
          p_user_id: userId,
        });
        if (!cancelled && !error && data) {
          setStats(data as unknown as ReferralStats);
        }
      } catch (err) {
        console.error('[useReferralStats] Error:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [userId, tick]);

  // Link curto: quantocusta.pro/{code}  — sem query string, URL limpa e compartilhável
  const referralLink = stats?.referral_code
    ? `${APP_BASE_URL}/${stats.referral_code}`
    : '';

  return {
    stats,
    loading,
    referralLink,
    refresh: () => setTick((t) => t + 1),
  };
}
