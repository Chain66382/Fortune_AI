'use client';

import { startTransition, useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import type {
  AnswerPayload,
  AssistantMessageStatus,
  AssetCategory,
  PaymentMethod,
  PaymentPlan,
  ReasoningStep,
  RegistrationInput,
  SavePreference,
  ConsultationStageEvent,
  ConsultationStageKey,
  ConsultationStreamEvent,
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

interface UploadFilesResponse {
  success: boolean;
  files: Array<UploadedAsset & { status: 'success'; clientId?: string }>;
  failed: Array<{
    fileName: string;
    error: string;
    status: 'error';
    clientId?: string;
  }>;
}

interface CheckoutResponse {
  paid: boolean;
}

interface UpdateProfileResponse {
  consultationId: string;
  profile: UserProfileInput;
  updatedAt: string;
}

interface LatestConsultationResponse {
  consultation: {
    id: string;
    profile: UserProfileInput;
    freeTurnsUsed: number;
    unlocked: boolean;
    userId?: string;
  } | null;
  messages: Array<{
    id?: string;
    role: 'user' | 'assistant';
    content: string;
    headline?: string;
    uploadedAssets?: UploadedAsset[];
    debug?: AnswerPayload['debug'];
  }>;
}

interface ConversationItem {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  headline?: string;
  debug?: AnswerPayload['debug'];
  uploadedAssets?: UploadedAsset[];
  status?: AssistantMessageStatus;
  reasoningSteps?: ReasoningStep[];
  error?: string;
  retryable?: boolean;
  sourceQuestion?: string;
}

interface ActiveAccountSession {
  displayName: string;
  contactType: RegistrationInput['contactType'];
  contactValue: string;
}

interface PendingAttachment {
  id: string;
  fileName: string;
  previewUrl: string;
  category: AssetCategory;
  status: 'uploading' | 'success' | 'error';
  error?: string;
  uploadedAsset?: UploadedAsset;
}

const defaultProfile: UserProfileInput = {
  displayName: '',
  gender: 'prefer_not_to_say',
  birthDate: '',
  birthCalendarType: 'lunar',
  birthDateLunar: '',
  birthIsLeapMonth: false,
  birthTime: '',
  birthTimezone: 'UTC+8',
  birthDateUtc8: '',
  birthDateLunarUtc8: '',
  birthTimeUtc8: '',
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

const reasoningStepOrder: Array<{ key: ConsultationStageKey; label: string }> = [
  { key: 'loading_profile', label: '正在读取用户资料' },
  { key: 'normalizing_time', label: '正在标准化出生时间（UTC+8）' },
  { key: 'generating_bazi', label: '正在生成八字 / 命理摘要' },
  { key: 'retrieving_docs', label: '正在检索 RAG 文档' },
  { key: 'building_prompt', label: '正在组织命理与上下文' },
  { key: 'calling_llm', label: '正在综合命理与知识库内容' },
  { key: 'generating_answer', label: '正在生成最终回答' }
];

const createLocalMessageId = () => `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const buildInitialReasoningSteps = (): ReasoningStep[] =>
  reasoningStepOrder.map((step) => ({
    key: step.key,
    label: step.label,
    status: 'pending'
  }));

const markReasoningStage = (steps: ReasoningStep[], stage: ConsultationStageEvent): ReasoningStep[] => {
  const targetIndex = steps.findIndex((step) => step.key === stage.key);

  if (targetIndex < 0) {
    return steps;
  }

  return steps.map((step, index) => {
    if (index < targetIndex) {
      return { ...step, status: step.status === 'error' ? 'error' : 'done' };
    }

    if (index === targetIndex) {
      return {
        ...step,
        label: stage.label || step.label,
        detail: stage.detail || step.detail,
        status: 'active'
      };
    }

    return {
      ...step,
      status: step.status === 'error' ? 'error' : 'pending'
    };
  });
};

const finalizeReasoningSteps = (steps: ReasoningStep[], debug?: AnswerPayload['debug']): ReasoningStep[] => {
  const docCount = debug?.retrievedDocuments.length || 0;

  return steps.map((step) => {
    switch (step.key) {
      case 'loading_profile':
        return {
          ...step,
          status: 'done',
          detail: debug
            ? `${debug.userProfile.displayName} / ${debug.userProfile.birthDate} ${debug.userProfile.birthTime || ''}`.trim()
            : step.detail
        };
      case 'normalizing_time':
        return {
          ...step,
          status: 'done',
          detail: debug
            ? `${debug.userProfile.normalizedUtc8.birthDate} ${debug.userProfile.normalizedUtc8.birthTime}`
            : step.detail
        };
      case 'generating_bazi':
        return {
          ...step,
          status: 'done',
          detail: debug?.bazi.summary || debug?.bazi.notes || step.detail
        };
      case 'retrieving_docs':
        return {
          ...step,
          status: 'done',
          detail: docCount > 0 ? `已检索 ${docCount} 条命理依据` : step.detail
        };
      case 'building_prompt':
        return {
          ...step,
          status: 'done',
          detail: debug?.promptPreview ? '提示词上下文已整理完成' : step.detail
        };
      case 'calling_llm':
        return {
          ...step,
          status: 'done',
          detail: '命理摘要与检索证据已完成综合'
        };
      case 'generating_answer':
        return {
          ...step,
          status: 'done',
          detail: '回答已生成'
        };
      default:
        return {
          ...step,
          status: 'done'
        };
    }
  });
};

const failReasoningSteps = (steps: ReasoningStep[], error: string): ReasoningStep[] => {
  const activeStep = steps.find((step) => step.status === 'active');

  return steps.map((step) =>
    step.key === activeStep?.key
      ? {
          ...step,
          status: 'error',
          detail: error
        }
      : step
  );
};

const buildOpeningGreeting = (profile: UserProfileInput): ConversationItem => ({
  id: createLocalMessageId(),
  role: 'assistant',
  headline: `${profile.displayName || '你的'}信息已经收下`,
  status: 'done',
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

const parseJsonResponse = async <T>(response: Response): Promise<T> => {
  const text = await response.text();

  try {
    return JSON.parse(text) as T;
  } catch (error) {
    console.error('Failed to parse JSON response', {
      status: response.status,
      url: response.url,
      body: text,
      error
    });
    throw createHttpError(
      {
        error: response.ok ? '请求成功但返回格式异常，请稍后重试。' : '图片上传失败，请稍后重试。'
      },
      response.status || 500
    );
  }
};

const fetchJson = async <T>(input: RequestInfo, init?: RequestInit): Promise<T> => {
  const response = await fetch(input, init);
  const payload = await parseJsonResponse<any>(response);

  if (!response.ok) {
    throw createHttpError(payload, response.status);
  }

  return payload as T;
};

const answerToConversation = (answer: AnswerPayload, id = createLocalMessageId()): ConversationItem => ({
  id,
  role: 'assistant',
  headline: answer.headline,
  content: [answer.summary, ...answer.details, ...answer.guidance].filter(Boolean).join('\n\n'),
  debug: answer.debug,
  status: 'done',
  reasoningSteps: finalizeReasoningSteps(buildInitialReasoningSteps(), answer.debug)
});

const createUserConversationItem = (content: string): ConversationItem => ({
  id: createLocalMessageId(),
  role: 'user',
  content
});

const createAssistantPlaceholder = (
  sourceQuestion: string,
  uploadedAssets: UploadedAsset[] = [],
  id = createLocalMessageId()
): ConversationItem => ({
  id,
  role: 'assistant',
  headline: '命理推演中',
  content: '',
  status: 'thinking',
  reasoningSteps: buildInitialReasoningSteps(),
  sourceQuestion,
  uploadedAssets,
  retryable: false
});

const hydrateStoredMessage = (
  message: LatestConsultationResponse['messages'][number],
  index: number
): ConversationItem =>
  message.role === 'assistant'
    ? {
        id: message.id || `history-assistant-${index}`,
        role: 'assistant',
        headline: message.headline,
        content: message.content,
        uploadedAssets: message.uploadedAssets,
        debug: message.debug,
        status: 'done',
        reasoningSteps: finalizeReasoningSteps(buildInitialReasoningSteps(), message.debug)
      }
    : {
        id: message.id || `history-user-${index}`,
        role: 'user',
        content: message.content,
        uploadedAssets: message.uploadedAssets
      };

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
  const { user, login, refreshSession, isLoading } = useAuth();
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
  const [pendingAttachments, setPendingAttachments] = useState<PendingAttachment[]>([]);
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

  const synchronizeAuthenticatedUser = async () => {
    const currentUser = await refreshSession();

    if (currentUser) {
      return currentUser;
    }

    await new Promise((resolve) => {
      window.setTimeout(resolve, 80);
    });

    return refreshSession();
  };

  const hasMinimumProfileForConsultation = (nextProfile: UserProfileInput) =>
    Boolean(nextProfile.displayName.trim() && nextProfile.birthDate.trim());

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

  useEffect(() => {
    if (!hasHydrated || isLoading || !user) {
      return;
    }

    let cancelled = false;

    const restoreLatestConsultation = async () => {
      try {
        const payload = await fetchJson<LatestConsultationResponse>('/api/consultations');

        if (cancelled || !payload.consultation) {
          return;
        }

        startTransition(() => {
          setProfile(payload.consultation!.profile);
          setConsultationId(payload.consultation!.id);
          setConversation(
            payload.messages.length > 0
              ? payload.messages.map(hydrateStoredMessage)
              : [buildOpeningGreeting(payload.consultation!.profile)]
          );
          setStage(payload.messages.length > 0 || payload.consultation!.profile.displayName ? 'chat' : 'intake');
          setActiveAccount({
            displayName: user.displayName,
            contactType: user.contactType,
            contactValue: user.contactValue
          });
          setSavePreference('save');
          setFreeTurnsRemaining(Math.max(0, 3 - payload.consultation!.freeTurnsUsed));
          setPaymentRequired(!payload.consultation!.unlocked && payload.consultation!.freeTurnsUsed >= 3);
          setPaymentModalOpen(false);
          setRequiresRegistrationForPayment(false);
          setIsPaid(Boolean(payload.consultation!.unlocked));
          setHasAskedFirstQuestion(payload.messages.some((message) => message.role === 'user'));
        });
      } catch {
        // Keep the current in-memory state if no saved consultation is available.
      }
    };

    void restoreLatestConsultation();

    return () => {
      cancelled = true;
    };
  }, [hasHydrated, isLoading, user]);

  const saveProfile = async () => {
    setIsSubmitting(true);
    setErrorMessage('');

    try {
      const effectiveSavePreference: SavePreference = user ? 'save' : savePreference;

      if (
        !user &&
        effectiveSavePreference === 'save' &&
        registration.contactValue.trim() &&
        registration.password.trim() &&
        !hasMinimumProfileForConsultation(profile)
      ) {
        const authenticatedUser = await login(registration);

        startTransition(() => {
          setActiveAccount({
            displayName: authenticatedUser.displayName,
            contactType: authenticatedUser.contactType,
            contactValue: authenticatedUser.contactValue
          });
        });

        return;
      }

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
        refreshedUser = await synchronizeAuthenticatedUser();
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

      const refreshedUser = user ? await synchronizeAuthenticatedUser() : null;

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
            id: createLocalMessageId(),
            role: 'assistant',
            headline: '个人信息已更新',
            content: '新的资料已经同步，接下来我会按最新信息继续和你往下看。',
            status: 'done'
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

  const revokeUploadPreview = (previewUrl: string) => {
    if (previewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(previewUrl);
    }
  };

  const removePendingAttachment = async (itemId: string) => {
    const queueItem = pendingAttachments.find((item) => item.id === itemId);

    if (!queueItem) {
      return;
    }

    revokeUploadPreview(queueItem.previewUrl);
    setPendingAttachments((currentItems) => currentItems.filter((item) => item.id !== itemId));

    if (!queueItem.uploadedAsset || !consultationId) {
      return;
    }

    try {
      const payload = await fetchJson<AssetAttachResponse>(`/api/consultations/${consultationId}/assets`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          assetId: queueItem.uploadedAsset.id
        })
      });

      setProfile((currentProfile) => ({
        ...currentProfile,
        uploadedAssets: payload.uploadedAssets
      }));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '图片移除失败，请稍后重试。');
    }
  };

  const updateAssistantMessage = (
    assistantId: string,
    updater: (message: ConversationItem) => ConversationItem
  ) => {
    setConversation((currentConversation) =>
      currentConversation.map((message) =>
        message.id === assistantId && message.role === 'assistant' ? updater(message) : message
      )
    );
  };

  const fetchStream = async (
    url: string,
    body: Record<string, unknown>,
    assistantId: string
  ): Promise<{
    answer?: AnswerPayload;
    paymentRequired?: boolean;
    requiresRegistrationForPayment?: boolean;
    freeTurnsRemaining?: number;
    paid?: boolean;
  }> => {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-fortune-stream': '1'
      },
      body: JSON.stringify(body)
    });

    if (!response.ok || !response.body) {
      const payload = await response.json().catch(() => ({ error: 'Request failed.' }));
      throw createHttpError(payload, response.status);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let answer: AnswerPayload | undefined;
    let meta: {
      paymentRequired?: boolean;
      requiresRegistrationForPayment?: boolean;
      freeTurnsRemaining?: number;
      paid?: boolean;
    } = {};

    while (true) {
      const { value, done } = await reader.read();

      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.trim()) {
          continue;
        }

        const event = JSON.parse(line) as ConsultationStreamEvent;

        if (event.type === 'stage') {
          updateAssistantMessage(assistantId, (message) => ({
            ...message,
            status: 'thinking',
            reasoningSteps: markReasoningStage(message.reasoningSteps || buildInitialReasoningSteps(), event.stage)
          }));
          continue;
        }

        if (event.type === 'answer') {
          answer = event.answer;
          meta = {
            paymentRequired: event.paymentRequired,
            requiresRegistrationForPayment: event.requiresRegistrationForPayment,
            freeTurnsRemaining: event.freeTurnsRemaining,
            paid: event.paid
          };
          updateAssistantMessage(assistantId, (message) => ({
            ...message,
            headline: event.answer.headline,
            debug: event.answer.debug,
            status: 'streaming'
          }));
          continue;
        }

        if (event.type === 'delta') {
          updateAssistantMessage(assistantId, (message) => ({
            ...message,
            status: 'streaming',
            content: `${message.content || ''}${event.delta}`
          }));
          continue;
        }

        if (event.type === 'error') {
          throw createHttpError(
            {
              error: event.error,
              details: event.details || null
            },
            event.status || 500
          );
        }

        if (event.type === 'done') {
          updateAssistantMessage(assistantId, (message) => ({
            ...message,
            headline: answer?.headline || message.headline,
            debug: answer?.debug || message.debug,
            content:
              message.content ||
              (answer
                ? [answer.summary, ...answer.details, ...answer.guidance].filter(Boolean).join('\n\n')
                : message.content),
            status: 'done',
            reasoningSteps: finalizeReasoningSteps(
              message.reasoningSteps || buildInitialReasoningSteps(),
              answer?.debug || message.debug
            ),
            retryable: false,
            error: undefined
          }));
        }
      }
    }

    if (buffer.trim()) {
      const event = JSON.parse(buffer) as ConsultationStreamEvent;

      if (event.type === 'done') {
        updateAssistantMessage(assistantId, (message) => ({
          ...message,
          headline: answer?.headline || message.headline,
          debug: answer?.debug || message.debug,
          content:
            message.content ||
            (answer
              ? [answer.summary, ...answer.details, ...answer.guidance].filter(Boolean).join('\n\n')
              : message.content),
          status: 'done',
          reasoningSteps: finalizeReasoningSteps(
            message.reasoningSteps || buildInitialReasoningSteps(),
            answer?.debug || message.debug
          ),
          retryable: false,
          error: undefined
        }));
      }
    }

    return {
      answer,
      ...meta
    };
  };

  const sendFollowUp = async (retryQuestion?: string, existingAssistantId?: string) => {
    const pendingQuestion = retryQuestion || followUpQuestion;
    let currentAssistantId = existingAssistantId;
    const assistantRetryImages =
      existingAssistantId && conversation.find((message) => message.id === existingAssistantId)?.uploadedAssets
        ? (conversation.find((message) => message.id === existingAssistantId)?.uploadedAssets as UploadedAsset[])
        : [];
    const pendingImages = (existingAssistantId ? assistantRetryImages : pendingAttachments
      .filter((item) => item.status === 'success' && item.uploadedAsset)
      .map((item) => item.uploadedAsset!)) as UploadedAsset[];

    if (!consultationId || (!pendingQuestion.trim() && pendingImages.length === 0)) {
      return;
    }

    setIsSubmitting(true);
    setErrorMessage('');

    try {
      const userQuestion = pendingQuestion.trim();
      const assistantId = existingAssistantId || createLocalMessageId();
      currentAssistantId = assistantId;
      const userMessageContent =
        userQuestion || (pendingImages.length > 0 ? `已发送 ${pendingImages.length} 张图片，请结合图片继续分析。` : '');
      console.debug('[chat.send] payload', {
        consultationId,
        content: userQuestion,
        images: pendingImages.length
      });

      if (!existingAssistantId) {
        const userMessage = {
          ...createUserConversationItem(userMessageContent),
          uploadedAssets: pendingImages
        };
        const placeholder = createAssistantPlaceholder(userQuestion, pendingImages, assistantId);

        startTransition(() => {
          setConversation((currentConversation) => [...currentConversation, userMessage, placeholder]);
          setFollowUpQuestion('');
          setPendingAttachments((currentItems) => {
            currentItems.forEach((item) => revokeUploadPreview(item.previewUrl));
            return [];
          });
        });
      } else {
        updateAssistantMessage(existingAssistantId, (message) => ({
          ...message,
          headline: '命理推演中',
          content: '',
          debug: undefined,
          error: undefined,
          retryable: false,
          status: 'thinking',
          reasoningSteps: buildInitialReasoningSteps()
        }));
      }

      const response = !hasAskedFirstQuestion
        ? await fetchStream(
            `/api/consultations/${consultationId}/preview`,
            { question: userQuestion, images: pendingImages },
            assistantId
          )
        : await fetchStream(
            `/api/consultations/${consultationId}/messages`,
            { message: userQuestion, images: pendingImages },
            assistantId
          );

      startTransition(() => {
        setFreeTurnsRemaining(response.freeTurnsRemaining ?? freeTurnsRemaining);
        setPaymentRequired(Boolean(response.paymentRequired));
        setRequiresRegistrationForPayment(Boolean(response.requiresRegistrationForPayment));
        setIsPaid(Boolean(response.paid));
        setHasAskedFirstQuestion(true);
      });

      if (response.paymentRequired) {
        openPaymentModal(Boolean(response.requiresRegistrationForPayment));
      }
    } catch (error) {
      const typedError = error as Error & {
        details?: Record<string, unknown> | null;
        status?: number;
      };

      const errorText = typedError.message || 'Unable to send follow-up.';
      const question = pendingQuestion.trim();
      const targetAssistantId =
        currentAssistantId ||
        [...conversation].reverse().find((message) => message.role === 'assistant' && message.sourceQuestion === question)?.id;

      if (targetAssistantId) {
        updateAssistantMessage(targetAssistantId, (message) => ({
          ...message,
          status: 'error',
          error: errorText,
          retryable: true,
          content: message.content || '这次推演没有顺利完成，请重试一次。',
          uploadedAssets: message.uploadedAssets || pendingImages,
          reasoningSteps: failReasoningSteps(
            message.reasoningSteps || buildInitialReasoningSteps(),
            errorText
          )
        }));
      }

      if (typedError.status === 402 && typedError.details?.paymentRequired) {
        openPaymentModal(Boolean(typedError.details.requiresRegistrationForPayment));
      } else {
        setErrorMessage(errorText);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const retryAssistantMessage = async (assistantId: string) => {
    const targetMessage = conversation.find((message) => message.id === assistantId && message.role === 'assistant');

    if (!targetMessage?.sourceQuestion) {
      return;
    }

    await sendFollowUp(targetMessage.sourceQuestion, assistantId);
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
      const selectedFiles = Array.from(files);
      const nextQueueItems = selectedFiles.map<PendingAttachment>((file) => ({
        id: createLocalMessageId(),
        fileName: file.name,
        previewUrl: URL.createObjectURL(file),
        category,
        status: 'uploading'
      }));

      setPendingAttachments((currentItems) => [...currentItems, ...nextQueueItems]);

      const formData = new FormData();
      formData.append('category', category);
      selectedFiles.forEach((file, index) => {
        formData.append('files', file);
        formData.append('clientIds', nextQueueItems[index].id);
      });

      const uploadResponse = await fetchJson<UploadFilesResponse>('/api/uploads', {
        method: 'POST',
        body: formData
      });

      const uploadedAssets = uploadResponse.files.map((file) => ({
        ...file,
        publicUrl: file.publicUrl || file.url,
        url: file.url || file.publicUrl,
        thumbnailUrl: file.thumbnailUrl || file.url || file.publicUrl
      }));

      let assetResponse: AssetAttachResponse | null = null;

      if (uploadedAssets.length > 0) {
        assetResponse = await fetchJson<AssetAttachResponse>(
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
      }

      startTransition(() => {
        setPendingAttachments((currentItems) =>
          currentItems.map((item) => {
            const matchedSuccess = uploadedAssets.find((asset) => asset.id === item.uploadedAsset?.id || asset.clientId === item.id);
            const matchedFailure = uploadResponse.failed.find((failed) => failed.clientId === item.id);

            if (matchedSuccess) {
              return {
                ...item,
                status: 'success',
                error: undefined,
                uploadedAsset: matchedSuccess
              };
            }

            if (matchedFailure) {
              return {
                ...item,
                status: 'error',
                error: matchedFailure.error
              };
            }

            return item;
          })
        );

        if (assetResponse) {
          setProfile((currentProfile) => ({
            ...currentProfile,
            uploadedAssets: assetResponse!.uploadedAssets
          }));
        }
      });

      if (uploadResponse.failed.length > 0) {
        const firstFailedIndex = selectedFiles.findIndex(
          (file) => file.name === uploadResponse.failed[0]?.fileName
        );
        setErrorMessage(
          uploadResponse.failed.length === 1
            ? `第 ${firstFailedIndex + 1} 张图片上传失败：${uploadResponse.failed[0].error}`
            : `${uploadResponse.failed.length} 张图片上传失败，请检查格式或大小后重试。`
        );
      }
    } catch (error) {
      console.error(error);
      setErrorMessage('图片上传失败，请稍后重试。');
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

      const refreshedUser = await synchronizeAuthenticatedUser();

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
            id: createLocalMessageId(),
            role: 'assistant',
            headline: '深度咨询已开启',
            content: [
              '本轮深度咨询已经开通，可以继续问了。',
              nextAccount ? `咨询账号已建立并已登录：${nextAccount.contactValue}` : '',
              '接下来的资料与聊天记录会自动保留。'
            ]
              .filter(Boolean)
              .join('\n'),
            status: 'done'
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
    retryAssistantMessage,
    uploadAssetsToConversation,
    pendingAttachments,
    removePendingAttachment,
    checkoutConsultation
  };
};
