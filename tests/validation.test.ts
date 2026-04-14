import { validateCheckoutInput, validateCreateConsultation } from '@/services/consultation/validation';

describe('validateCreateConsultation', () => {
  it('accepts a complete profile payload', () => {
    const payload = validateCreateConsultation({
      savePreference: 'do_not_save',
      profile: {
        displayName: '晚风',
        gender: 'female',
        birthDate: '1997-03-14',
        birthCalendarType: 'solar',
        birthTime: '08:30',
        birthTimezone: 'UTC+8',
        birthLocation: '杭州',
        currentCity: '上海',
        focusArea: 'career',
        currentChallenge: '最近事业推进很慢，我想知道是否该换方向。',
        dreamContext: '',
        fengShuiContext: '',
        uploadedAssets: []
      }
    });

    expect(payload.profile.displayName).toBe('晚风');
    expect(payload.profile.focusArea).toBe('career');
    expect(payload.profile.birthDateLunar).toContain('农历');
    expect(payload.profile.birthDateUtc8).toBe('1997-03-14');
    expect(payload.profile.birthTimeUtc8).toBe('08:30');
  });

  it('accepts a lightweight profile when optional fields are empty', () => {
    const payload = validateCreateConsultation({
      savePreference: 'do_not_save',
      profile: {
        displayName: '晚风',
        gender: 'female',
        birthDate: '1997-03-14',
        birthCalendarType: 'lunar',
        birthTime: '',
        birthTimezone: 'UTC+8',
        birthLocation: '',
        currentCity: '',
        focusArea: 'overall',
        currentChallenge: '',
        dreamContext: '',
        fengShuiContext: '',
        uploadedAssets: []
      }
    });

    expect(payload.profile.birthLocation).toBe('');
    expect(payload.profile.currentChallenge).toBe('');
    expect(payload.profile.birthDateLunar).toContain('农历');
  });

  it('normalizes birth date time into UTC+8 and handles cross-day shifts', () => {
    const payload = validateCreateConsultation({
      savePreference: 'do_not_save',
      profile: {
        displayName: '时序',
        gender: 'male',
        birthDate: '1997-03-14',
        birthCalendarType: 'solar',
        birthTime: '18:30',
        birthTimezone: 'UTC-8',
        birthLocation: '',
        currentCity: '',
        focusArea: 'overall',
        currentChallenge: '',
        dreamContext: '',
        fengShuiContext: '',
        uploadedAssets: []
      }
    });

    expect(payload.profile.birthDateUtc8).toBe('1997-03-15');
    expect(payload.profile.birthTimeUtc8).toBe('10:30');
    expect(payload.profile.birthDateLunarUtc8).toContain('农历');
  });

  it('requires registration when the user chooses to save records', () => {
    const payload = validateCreateConsultation({
      savePreference: 'save',
      registration: {
        contactType: 'email',
        contactValue: 'fortune@example.com',
        password: 'secret12'
      },
      profile: {
        displayName: '晚风',
        gender: 'female',
        birthDate: '1997-03-14',
        birthCalendarType: 'solar',
        birthTime: '',
        birthTimezone: 'UTC+8',
        birthLocation: '',
        currentCity: '',
        focusArea: 'overall',
        currentChallenge: '',
        dreamContext: '',
        fengShuiContext: '',
        uploadedAssets: []
      }
    });

    expect(payload.registration?.contactValue).toBe('fortune@example.com');
  });

  it('defaults the checkout payment plan and method when the client does not send them', () => {
    const payload = validateCheckoutInput({}, false);

    expect(payload.paymentPlan).toBe('consultation_pack_1000');
    expect(payload.paymentMethod).toBe('usdt');
  });
});
