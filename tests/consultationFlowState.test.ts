import { buildDefaultConsultationSession } from '@/hooks/useConsultationFlow';

describe('buildDefaultConsultationSession', () => {
  it('returns a clean anonymous consultation state for logout reset', () => {
    const state = buildDefaultConsultationSession();

    expect(state.stage).toBe('intake');
    expect(state.consultationId).toBe('');
    expect(state.followUpQuestion).toBe('');
    expect(state.conversation).toEqual([]);
    expect(state.savePreference).toBe('do_not_save');
    expect(state.activeAccount).toBeNull();
    expect(state.paymentRequired).toBe(false);
    expect(state.paymentModalOpen).toBe(false);
    expect(state.isPaid).toBe(false);
    expect(state.profile.displayName).toBe('');
    expect(state.profile.uploadedAssets).toEqual([]);
    expect(state.selectedPaymentMethod).toBe('usdt');
    expect(state.selectedPaymentPlan).toBe('consultation_pack_1000');
  });
});
