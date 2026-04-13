'use client';

import { startTransition, useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import type {
  AnswerPayload,
  AssetCategory,
  PaymentMethod,
  PaymentPlan,
  RegistrationInput,
  SavePreference,
  UploadedAsset,
  UserProfileInput
} from '@/types/consultation';

interface PreviewResponse {
  consultationId: string;
  previewAnswer: AnswerPayload;
  freeTurnsRemaining: number;
  paymentRequired: boolean;
  requiresRegistrationForPayment: boolean;
  paid: boolean;
}

interface FollowUpResponse {
  answer: AnswerPayload;
  paymentRequired: boolean;
  requiresRegistrationForPayment: boolean;
  freeTurnsRemaining: number;
  paid: boolean;
}

interface AssetAttachResponse {
  consultationId: string;
  uploadedAssets: UploadedAsset[];
}

interface CheckoutResponse {
  paid: boolean;
}

interface UpdateProfileResponse {
  consultationId: string;
  profile: UserProfileInput;
  updatedAt: string;
}

interface ConversationItem {
  role: 'user' | 'assistant';
  content: string;
  headline?: string;
}

interface ActiveAccountSession {
  displayName: string;
  contactType: RegistrationInput['contactType'];
  contactValue: string;
}

const defaultProfile: UserProfileInput = {
  displayName: '',
  gender: 'prefer_not_to_say',
  birthDate: '',
  birthCalendarType: 'lunar',
  birthDateLunar: '',
  birthIsLeapMonth: false,
  birthTime: '',
  birthLocation: '',
  currentCity: '',
  focusArea: 'overall',
  currentChallenge: '',
  dreamContext: '',
  fengShuiContext: '',
  uploadedAssets: []
};

const defaultRegistration: RegistrationInput = {
  contactType: 'email',
  contactValue: '',
  password: ''
};

const STORAGE_KEY = 'fortune-ai-session-v2';
const LOGOUT_RESET_EVENT = 'fortune-ai:auth-logout';

const uploadAcknowledgement: Record<AssetCategory, string> = {
  face: '面相资料已收到。继续告诉我你想重点看哪一面，我会顺着这条线往下看。',
  palm: '手相资料已收到。继续告诉我你想重点看感情、事业，还是整体走势。',
  space: '空间资料已收到。继续告诉我你更在意睡眠、财位、工作效率还是人际关系。',
  other: '资料已收到。你可以继续补充问题，我会结合这些内容继续看。'
};

const buildOpeningGreeting = (profile: UserProfileInput): ConversationItem => ({
  role: 'assistant',
  headline: `${profile.displayName || '你的'}信息已经收下`,
  content: [
    '现在你可以直接开始问你最想看的事情，我会先顺着你的问题把主线看清。',
    '如果后面需要面相、手相、居住空间或办公空间资料，我会在对话里直接告诉你该怎么拍、该补什么。'
  ].join('\n')
});

const createHttpError = (payload: any, status: number) => {
  const error = new Error(payload.error || 'Request failed.') as Error & {
    details?: Record<string, unknown> | null;
    status?: number;
  };
  error.details = payload.details || null;
  error.status = status;
  return error;
};

const fetchJson = async <T>(input: RequestInfo, init?: RequestInit): Promise<T> => {
  const response = await fetch(input, init);
  const payload = await response.json();

  if (!response.ok) {
    throw createHttpError(payload, response.status);
  }

  return payload as T;
};

const answerToConversation = (answer: AnswerPayload): ConversationItem => ({
  role: 'assistant',
  headline: answer.headline,
  content: [answer.summary, ...answer.details, ...answer.guidance].join('\n')
});

export const buildDefaultConsultationSession = () => ({
  profile: {
    ...defaultProfile,
    uploadedAssets: []
  },
  followUpQuestion: '',
  savePreference: 'do_not_save' as SavePreference,
  registration: {
    ...defaultRegistration
  },
  paymentRegistration: {
    ...defaultRegistration
  },
  consultationId: '',
  conversation: [] as ConversationItem[],
  stage: 'intake' as const,
  freeTurnsRemaining: 3,
  paymentRequired: false,
  paymentModalOpen: false,
  requiresRegistrationForPayment: false,
  isPaid: false,
  activeAccount: null as ActiveAccountSession | null,
  selectedPaymentPlan: 'consultation_pack_1000' as PaymentPlan,
  selectedPaymentMethod: 'usdt' as PaymentMethod,
  hasAskedFirstQuestion: false
});

export const useConsultationFlow = () => {
  const { user, refreshSession, isLoading } = useAuth();
  const [profile, setProfile] = useState<UserProfileInput>(defaultProfile);
  const [followUpQuestion, setFollowUpQuestion] = useState('');
  const [savePreference, setSavePreference] = useState<SavePreference>('do_not_save');
  const [registration, setRegistration] = useState<RegistrationInput>(defaultRegistration);
  const [paymentRegistration, setPaymentRegistration] = useState<RegistrationInput>(defaultRegistration);
  const [consultationId, setConsultationId] = useState('');
  const [conversation, setConversation] = useState<ConversationItem[]>([]);
  const [stage, setStage] = useState<'intake' | 'chat'>('intake');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploadingAssets, setIsUploadingAssets] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [freeTurnsRemaining, setFreeTurnsRemaining] = useState(3);
  const [paymentRequired, setPaymentRequired] = useState(false);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [requiresRegistrationForPayment, setRequiresRegistrationForPayment] = useState(false);
  const [isPaid, setIsPaid] = useState(false);
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [activeAccount, setActiveAccount] = useState<ActiveAccountSession | null>(null);
  const [selectedPaymentPlan, setSelectedPaymentPlan] = useState<PaymentPlan>('consultation_pack_1000');
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentMethod>('usdt');
  const [hasAskedFirstQuestion, setHasAskedFirstQuestion] = useState(false);
  const [hasHydrated, setHasHydrated] = useState(false);

  const resetConsultationState = () => {
    const initialState = buildDefaultConsultationSession();

    startTransition(() => {
      setProfile(initialState.profile);
      setFollowUpQuestion(initialState.followUpQuestion);
      setSavePreference(initialState.savePreference);
      setRegistration(initialState.registration);
      setPaymentRegistration(initialState.paymentRegistration);
      setConsultationId(initialState.consultationId);
      setConversation(initialState.conversation);
      setStage(initialState.stage);
      setFreeTurnsRemaining(initialState.freeTurnsRemaining);
      setPaymentRequired(initialState.paymentRequired);
      setPaymentModalOpen(initialState.paymentModalOpen);
      setRequiresRegistrationForPayment(initialState.requiresRegistrationForPayment);
      setIsPaid(initialState.isPaid);
      setActiveAccount(initialState.activeAccount);
      setSelectedPaymentPlan(initialState.selectedPaymentPlan);
      setSelectedPaymentMethod(initialState.selectedPaymentMethod);
      setHasAskedFirstQuestion(initialState.hasAskedFirstQuestion);
      setErrorMessage('');
    });

    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  };

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    try {
      const storedValue = window.localStorage.getItem(STORAGE_KEY);

      if (!storedValue) {
        return;
      }

      const parsedState = JSON.parse(storedValue) as {
        profile?: UserProfileInput;
        followUpQuestion?: string;
        savePreference?: SavePreference;
        registration?: Omit<RegistrationInput, 'password'>;
        paymentRegistration?: Omit<RegistrationInput, 'password'>;
        consultationId?: string;
        conversation?: ConversationItem[];
        stage?: 'intake' | 'chat';
        freeTurnsRemaining?: number;
        paymentRequired?: boolean;
        paymentModalOpen?: boolean;
        requiresRegistrationForPayment?: boolean;
        isPaid?: boolean;
        activeAccount?: ActiveAccountSession | null;
        selectedPaymentPlan?: PaymentPlan;
        selectedPaymentMethod?: PaymentMethod;
        hasAskedFirstQuestion?: boolean;
      };

      if (parsedState.profile) {
        setProfile(parsedState.profile);
      }

      setFollowUpQuestion(parsedState.followUpQuestion || '');
      setSavePreference(parsedState.savePreference || 'do_not_save');
      setRegistration((currentRegistration) => ({
        ...currentRegistration,
        contactType: parsedState.registration?.contactType || currentRegistration.contactType,
        contactValue: parsedState.registration?.contactValue || currentRegistration.contactValue
      }));
      setPaymentRegistration((currentRegistration) => ({
        ...currentRegistration,
        contactType: parsedState.paymentRegistration?.contactType || currentRegistration.contactType,
        contactValue:
          parsedState.paymentRegistration?.contactValue || currentRegistration.contactValue
      }));
      setConsultationId(parsedState.consultationId || '');
      setConversation(parsedState.conversation || []);
      setStage(parsedState.stage || 'intake');
      setFreeTurnsRemaining(parsedState.freeTurnsRemaining ?? 3);
      setPaymentRequired(Boolean(parsedState.paymentRequired));
      setPaymentModalOpen(Boolean(parsedState.paymentModalOpen));
      setRequiresRegistrationForPayment(Boolean(parsedState.requiresRegistrationForPayment));
      setIsPaid(Boolean(parsedState.isPaid));
      setActiveAccount(parsedState.activeAccount || null);
      setSelectedPaymentPlan(parsedState.selectedPaymentPlan || 'consultation_pack_1000');
      setSelectedPaymentMethod(parsedState.selectedPaymentMethod || 'usdt');
      setHasAskedFirstQuestion(Boolean(parsedState.hasAskedFirstQuestion));
    } catch {
      window.localStorage.removeItem(STORAGE_KEY);
    } finally {
      setHasHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const handleLogoutReset = () => {
      resetConsultationState();
    };

    window.addEventListener(LOGOUT_RESET_EVENT, handleLogoutReset);

    return () => {
      window.removeEventListener(LOGOUT_RESET_EVENT, handleLogoutReset);
    };
  }, []);

  useEffect(() => {
    if (!hasHydrated || typeof window === 'undefined') {
      return;
    }

    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        profile,
        followUpQuestion,
        savePreference,
        registration: {
          contactType: registration.contactType,
          contactValue: registration.contactValue
        },
        paymentRegistration: {
          contactType: paymentRegistration.contactType,
          contactValue: paymentRegistration.contactValue
        },
        consultationId,
        conversation,
        stage,
        freeTurnsRemaining,
        paymentRequired,
        paymentModalOpen,
        requiresRegistrationForPayment,
        isPaid,
        activeAccount,
        selectedPaymentPlan,
        selectedPaymentMethod,
        hasAskedFirstQuestion
      })
    );
  }, [
    activeAccount,
    consultationId,
    conversation,
    followUpQuestion,
    freeTurnsRemaining,
    hasAskedFirstQuestion,
    hasHydrated,
    isPaid,
    paymentModalOpen,
    paymentRegistration.contactType,
    paymentRegistration.contactValue,
    paymentRequired,
    profile,
    registration.contactType,
    registration.contactValue,
    requiresRegistrationForPayment,
    savePreference,
    selectedPaymentMethod,
    selectedPaymentPlan,
    stage
  ]);

  useEffect(() => {
    if (!hasHydrated || isLoading) {
      return;
    }

    if (user) {
      setSavePreference('save');
      setRegistration((currentRegistration) => ({
        ...currentRegistration,
        contactType: user.contactType,
        contactValue: user.contactValue
      }));
    } else if (stage === 'intake' && !registration.contactValue.trim()) {
      setSavePreference('do_not_save');
    }
  }, [hasHydrated, isLoading, registration.contactValue, stage, user]);

  const saveProfile = async () => {
    setIsSubmitting(true);
    setErrorMessage('');

    try {
      const effectiveSavePreference: SavePreference = user ? 'save' : savePreference;
      const consultation = await fetchJson<{ id: string }>('/api/consultations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          profile: {
            ...profile,
            uploadedAssets: []
          },
          savePreference: effectiveSavePreference,
          registration: !user && effectiveSavePreference === 'save' ? registration : undefined
        })
      });

      let refreshedUser = user;

      if (!user && effectiveSavePreference === 'save') {
        refreshedUser = await refreshSession();
      }

      startTransition(() => {
        const nextAccount =
          refreshedUser
            ? {
                displayName: refreshedUser.displayName,
                contactType: refreshedUser.contactType,
                contactValue: refreshedUser.contactValue
              }
            : effectiveSavePreference === 'save'
              ? {
                  displayName: profile.displayName.trim(),
                  contactType: registration.contactType,
                  contactValue: registration.contactValue.trim()
                }
              : null;

        setConsultationId(consultation.id);
        setStage('chat');
        setConversation([buildOpeningGreeting(profile)]);
        setActiveAccount(nextAccount);
        setPaymentRequired(false);
        setPaymentModalOpen(false);
        setRequiresRegistrationForPayment(false);
        setIsPaid(false);
        setFreeTurnsRemaining(3);
        setHasAskedFirstQuestion(false);
      });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to save profile.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateSavedProfile = async (nextProfile: UserProfileInput) => {
    if (!consultationId) {
      setProfile(nextProfile);
      return;
    }

    setIsSubmitting(true);
    setErrorMessage('');

    try {
      const payload = await fetchJson<UpdateProfileResponse>(
        `/api/consultations/${consultationId}/profile`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            profile: nextProfile
          })
        }
      );

      const refreshedUser = user ? await refreshSession() : null;

      startTransition(() => {
        setProfile(payload.profile);
        setActiveAccount((currentAccount) =>
          refreshedUser
            ? {
                displayName: refreshedUser.displayName,
                contactType: refreshedUser.contactType,
                contactValue: refreshedUser.contactValue
              }
            : currentAccount
              ? {
                  ...currentAccount,
                  displayName: payload.profile.displayName
                }
              : currentAccount
        );
        setConversation((currentConversation) => [
          ...currentConversation,
          {
            role: 'assistant',
            headline: '个人信息已更新',
            content: '新的资料已经同步，接下来我会按最新信息继续和你往下看。'
          }
        ]);
      });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to update profile.');
      throw error;
    } finally {
      setIsSubmitting(false);
    }
  };

  const openPaymentModal = (requiresRegistration: boolean) => {
    setRequiresRegistrationForPayment(requiresRegistration);
    setPaymentRequired(true);
    setPaymentModalOpen(true);
  };

  const sendFollowUp = async () => {
    if (!consultationId || !followUpQuestion.trim()) {
      return;
    }

    setIsSubmitting(true);
    setErrorMessage('');

    try {
      const userQuestion = followUpQuestion.trim();

      if (!hasAskedFirstQuestion) {
        const preview = await fetchJson<PreviewResponse>(
          `/api/consultations/${consultationId}/preview`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              question: userQuestion
            })
          }
        );

        startTransition(() => {
          setConversation((currentConversation) => [
            ...currentConversation,
            { role: 'user', content: userQuestion },
            answerToConversation(preview.previewAnswer)
          ]);
          setFollowUpQuestion('');
          setFreeTurnsRemaining(preview.freeTurnsRemaining);
          setPaymentRequired(preview.paymentRequired);
          setRequiresRegistrationForPayment(preview.requiresRegistrationForPayment);
          setIsPaid(preview.paid);
          setHasAskedFirstQuestion(true);
        });

        return;
      }

      const response = await fetchJson<FollowUpResponse>(
        `/api/consultations/${consultationId}/messages`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            message: userQuestion
          })
        }
      );

      startTransition(() => {
        setConversation((currentConversation) => [
          ...currentConversation,
          { role: 'user', content: userQuestion },
          answerToConversation(response.answer)
        ]);
        setFollowUpQuestion('');
        setFreeTurnsRemaining(response.freeTurnsRemaining);
        setIsPaid(response.paid);
      });

      if (response.paymentRequired) {
        openPaymentModal(response.requiresRegistrationForPayment);
      }
    } catch (error) {
      const typedError = error as Error & {
        details?: Record<string, unknown> | null;
        status?: number;
      };

      if (typedError.status === 402 && typedError.details?.paymentRequired) {
        openPaymentModal(Boolean(typedError.details.requiresRegistrationForPayment));
      } else {
        setErrorMessage(typedError.message || 'Unable to send follow-up.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const uploadAssetsToConversation = async (files: FileList | null, category: AssetCategory) => {
    if (!consultationId) {
      setErrorMessage('请先保存信息并开始咨询，再补充照片资料。');
      return;
    }

    if (!files || files.length === 0) {
      return;
    }

    setIsUploadingAssets(true);
    setErrorMessage('');

    try {
      const uploadedAssets: UploadedAsset[] = [];

      for (const file of Array.from(files)) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('category', category);

        const uploadedAsset = await fetchJson<UploadedAsset>('/api/uploads', {
          method: 'POST',
          body: formData
        });
        uploadedAssets.push(uploadedAsset);
      }

      const assetResponse = await fetchJson<AssetAttachResponse>(
        `/api/consultations/${consultationId}/assets`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            uploadedAssets
          })
        }
      );

      startTransition(() => {
        setProfile((currentProfile) => ({
          ...currentProfile,
          uploadedAssets: assetResponse.uploadedAssets
        }));
        setConversation((currentConversation) => [
          ...currentConversation,
          {
            role: 'assistant',
            headline: '资料已收到',
            content: uploadAcknowledgement[category]
          }
        ]);
      });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to upload assets.');
    } finally {
      setIsUploadingAssets(false);
    }
  };

  const checkoutConsultation = async () => {
    if (!consultationId) {
      return;
    }

    setIsCheckingOut(true);
    setErrorMessage('');

    try {
      const shouldCollectRegistration =
        !user && (requiresRegistrationForPayment || savePreference === 'do_not_save');
      const payload = shouldCollectRegistration
        ? {
            registration: paymentRegistration,
            paymentPlan: selectedPaymentPlan,
            paymentMethod: selectedPaymentMethod
          }
        : {
            paymentPlan: selectedPaymentPlan,
            paymentMethod: selectedPaymentMethod
          };

      const response = await fetchJson<CheckoutResponse>(
        `/api/consultations/${consultationId}/checkout`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        }
      );

      const refreshedUser = await refreshSession();

      startTransition(() => {
        const nextAccount =
          refreshedUser
            ? {
                displayName: refreshedUser.displayName,
                contactType: refreshedUser.contactType,
                contactValue: refreshedUser.contactValue
              }
            : activeAccount ||
              (!user && (requiresRegistrationForPayment || savePreference === 'do_not_save')
                ? {
                    displayName: profile.displayName.trim(),
                    contactType: paymentRegistration.contactType,
                    contactValue: paymentRegistration.contactValue.trim()
                  }
                : null);

        setIsPaid(response.paid);
        setPaymentRequired(false);
        setPaymentModalOpen(false);
        setRequiresRegistrationForPayment(false);
        setActiveAccount(nextAccount);
        setConversation((currentConversation) => [
          ...currentConversation,
          {
            role: 'assistant',
            headline: '深度咨询已开启',
            content: [
              '本轮深度咨询已经开通，可以继续问了。',
              nextAccount ? `咨询账号已建立并已登录：${nextAccount.contactValue}` : '',
              '接下来的资料与聊天记录会自动保留。'
            ]
              .filter(Boolean)
              .join('\n')
          }
        ]);
      });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to complete checkout.');
    } finally {
      setIsCheckingOut(false);
    }
  };

  return {
    profile,
    followUpQuestion,
    savePreference,
    registration,
    paymentRegistration,
    conversation,
    stage,
    isSubmitting,
    isUploadingAssets,
    errorMessage,
    freeTurnsRemaining,
    paymentRequired,
    paymentModalOpen,
    requiresRegistrationForPayment,
    isPaid,
    isCheckingOut,
    activeAccount,
    selectedPaymentPlan,
    selectedPaymentMethod,
    user,
    setProfile,
    setFollowUpQuestion,
    setSavePreference,
    setRegistration,
    setPaymentRegistration,
    setPaymentModalOpen,
    setSelectedPaymentPlan,
    setSelectedPaymentMethod,
    saveProfile,
    updateSavedProfile,
    sendFollowUp,
    uploadAssetsToConversation,
    checkoutConsultation
  };
};
