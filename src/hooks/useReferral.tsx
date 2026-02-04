import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import type { ReferralCode, Referral } from '@/types/cargo';

export function useReferral() {
  const { user } = useAuth();
  const [referralCode, setReferralCode] = useState<ReferralCode | null>(null);
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchReferralData = useCallback(async () => {
    if (!user) {
      setReferralCode(null);
      setReferrals([]);
      setIsLoading(false);
      return;
    }

    try {
      // Fetch referral code
      let { data: codeData } = await supabase
        .from('referral_codes')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      // Generate if doesn't exist
      if (!codeData) {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('phone')
          .eq('id', user.id)
          .single();

        if (profileData?.phone) {
          const code = 'ONLY' + profileData.phone.slice(-4) + Math.random().toString(36).slice(2, 4).toUpperCase();
          
          const { data: newCode } = await supabase
            .from('referral_codes')
            .insert({ user_id: user.id, code })
            .select()
            .single();

          codeData = newCode;
        }
      }

      setReferralCode(codeData as ReferralCode);

      // Fetch referrals
      const { data: referralData } = await supabase
        .from('referrals')
        .select('*')
        .eq('referrer_id', user.id)
        .order('created_at', { ascending: false });

      setReferrals((referralData || []) as Referral[]);
    } catch (error) {
      console.error('Failed to fetch referral data:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchReferralData();
  }, [fetchReferralData]);

  const applyReferralCode = async (code: string): Promise<{ success: boolean; error?: string }> => {
    if (!user) return { success: false, error: 'Нэвтэрнэ үү' };

    try {
      // Find referral code
      const { data: codeData, error: codeError } = await supabase
        .from('referral_codes')
        .select('*')
        .eq('code', code.toUpperCase())
        .single();

      if (codeError || !codeData) {
        return { success: false, error: 'Урилгын код олдсонгүй' };
      }

      if (codeData.user_id === user.id) {
        return { success: false, error: 'Өөрийн кодоо ашиглах боломжгүй' };
      }

      // Check if already used
      const { data: existingReferral } = await supabase
        .from('referrals')
        .select('id')
        .eq('referred_id', user.id)
        .maybeSingle();

      if (existingReferral) {
        return { success: false, error: 'Та аль хэдийн урилга ашигласан байна' };
      }

      // Get reward amount from settings
      const { data: settingsData } = await supabase
        .from('site_settings')
        .select('value')
        .eq('key', 'referral_reward_amount')
        .single();

      const rewardAmount = settingsData?.value ? parseInt(String(settingsData.value)) : 5000;

      // Create referral record
      const { error: createError } = await supabase
        .from('referrals')
        .insert({
          referrer_id: codeData.user_id,
          referred_id: user.id,
          referral_code_id: codeData.id,
          reward_amount: rewardAmount,
        });

      if (createError) throw createError;

      // Update code usage count
      await supabase
        .from('referral_codes')
        .update({ uses_count: (codeData.uses_count || 0) + 1 })
        .eq('id', codeData.id);

      return { success: true };
    } catch (error) {
      console.error('Failed to apply referral code:', error);
      return { success: false, error: 'Алдаа гарлаа' };
    }
  };

  return {
    referralCode,
    referrals,
    isLoading,
    applyReferralCode,
    refreshReferral: fetchReferralData,
    totalReferrals: referrals.length,
    totalRewards: referrals.filter(r => r.reward_paid).reduce((sum, r) => sum + (r.reward_amount || 0), 0),
  };
}
