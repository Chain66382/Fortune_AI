import { AppError } from '@/services/errors';
import {
  convertSolarToLunar,
  formatLunarDate,
  getLunarDayCount,
  parseStoredLunarDate
} from '@/lib/lunarCalendar';
import { normalizeBirthProfileToUtc8 } from '@/lib/timezones';
import type {
  AttachAssetsInput,
  ChatInput,
  CheckoutInput,
  CreateConsultationInput,
  OrderIntentInput,
  PaymentMethod,
  PaymentPlan,
  PreviewConsultationInput,
  RegistrationInput,
  UserProfileInput
} from '@/types/consultation';

const requireTrimmed = (value: string, label: string, minimum = 2): string => {
  const normalizedValue = value.trim();

  if (normalizedValue.length < minimum) {
    throw new AppError(`${label} is required.`);
  }

  return normalizedValue;
};

const validPaymentPlans: PaymentPlan[] = [
  'consultation_pack_1000',
  'monthly_membership',
  'yearly_membership'
];

const validPaymentMethods: PaymentMethod[] = ['usdt', 'wechat_pay', 'alipay', 'visa'];

const validateRegistration = (registration: RegistrationInput, labelPrefix = 'Account'): RegistrationInput => {
  const contactValue = requireTrimmed(registration.contactValue, `${labelPrefix} contact`, 4);
  const password = requireTrimmed(registration.password, `${labelPrefix} password`, 6);

  return {
    contactType: registration.contactType,
    contactValue,
    password
  };
};

const validatePaymentPlan = (paymentPlan?: PaymentPlan): PaymentPlan =>
  validPaymentPlans.includes(paymentPlan || 'consultation_pack_1000')
    ? paymentPlan || 'consultation_pack_1000'
    : 'consultation_pack_1000';

const validatePaymentMethod = (paymentMethod?: PaymentMethod): PaymentMethod =>
  validPaymentMethods.includes(paymentMethod || 'usdt') ? paymentMethod || 'usdt' : 'usdt';

export const validateProfile = (profile: UserProfileInput): UserProfileInput => {
  const birthDate = requireTrimmed(profile.birthDate, 'Birth date');
  const birthCalendarType = profile.birthCalendarType || 'lunar';

  if (birthCalendarType === 'solar') {
    formatLunarDate(convertSolarToLunar(birthDate));
  } else {
    const lunarParts = parseStoredLunarDate(birthDate, profile.birthIsLeapMonth);

    if (!lunarParts) {
      throw new AppError('Birth date is invalid.');
    }

    const maxDay = getLunarDayCount(lunarParts.year, lunarParts.month, lunarParts.isLeapMonth);

    if (lunarParts.day > maxDay) {
      throw new AppError('Birth date is invalid.');
    }
  }

  return normalizeBirthProfileToUtc8({
    displayName: requireTrimmed(profile.displayName, 'Display name'),
    gender: profile.gender,
    birthDate,
    birthCalendarType,
    birthDateLunar: profile.birthDateLunar,
    birthIsLeapMonth: Boolean(profile.birthIsLeapMonth),
    birthTime: profile.birthTime?.trim(),
    birthTimezone: profile.birthTimezone || 'UTC+8',
    birthDateUtc8: profile.birthDateUtc8,
    birthDateLunarUtc8: profile.birthDateLunarUtc8,
    birthTimeUtc8: profile.birthTimeUtc8,
    birthLocation: profile.birthLocation?.trim() || '',
    currentCity: profile.currentCity?.trim() || '',
    focusArea: profile.focusArea || 'overall',
    currentChallenge: profile.currentChallenge?.trim() || '',
    dreamContext: profile.dreamContext?.trim(),
    fengShuiContext: profile.fengShuiContext?.trim(),
    uploadedAssets: profile.uploadedAssets || []
  });
};

export const validateCreateConsultation = (
  input: CreateConsultationInput,
  allowSavedWithoutRegistration = false
): CreateConsultationInput => {
  if (!input?.profile) {
    throw new AppError('Profile payload is required.');
  }

  if (!input.savePreference) {
    throw new AppError('Save preference is required.');
  }

  return {
    profile: validateProfile(input.profile),
    savePreference: input.savePreference,
    registration:
      input.savePreference === 'save' && !allowSavedWithoutRegistration
        ? validateRegistration(
            input.registration || {
              contactType: 'email',
              contactValue: '',
              password: ''
            },
            'Registration'
          )
        : undefined
  };
};

export const validatePreviewInput = (input: PreviewConsultationInput): PreviewConsultationInput => ({
  question: requireTrimmed(input.question, 'Question', 8)
});

export const validateOrderIntentInput = (input: OrderIntentInput): OrderIntentInput => ({
  contactName: requireTrimmed(input.contactName, 'Contact name'),
  contactChannel: requireTrimmed(input.contactChannel, 'Contact channel', 4),
  note: input.note?.trim()
});

export const validateChatInput = (input: ChatInput): ChatInput => ({
  message: requireTrimmed(input.message, 'Message', 2)
});

export const validateAttachAssetsInput = (input: AttachAssetsInput): AttachAssetsInput => {
  if (!input?.uploadedAssets || !Array.isArray(input.uploadedAssets) || input.uploadedAssets.length === 0) {
    throw new AppError('Uploaded assets are required.');
  }

  return {
    uploadedAssets: input.uploadedAssets
  };
};

export const validateCheckoutInput = (input: CheckoutInput, requiresRegistration: boolean): CheckoutInput => {
  if (!requiresRegistration) {
    return {
      paymentPlan: validatePaymentPlan(input?.paymentPlan),
      paymentMethod: validatePaymentMethod(input?.paymentMethod)
    };
  }

  return {
    paymentPlan: validatePaymentPlan(input?.paymentPlan),
    paymentMethod: validatePaymentMethod(input?.paymentMethod),
    registration: validateRegistration(
      input.registration || {
        contactType: 'email',
        contactValue: '',
        password: ''
      },
      'Payment registration'
    )
  };
};
