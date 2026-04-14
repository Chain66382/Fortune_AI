'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import styles from '@/components/FortuneExperience.module.css';
import { HeroSection } from '@/components/HeroSection';
import { useConsultationFlow } from '@/hooks/useConsultationFlow';
import {
  buildStoredLunarDate,
  convertLunarToSolar,
  convertSolarToLunar,
  formatLunarDate,
  getLunarDayCount,
  getLunarMonthOptions,
  getSupportedBirthYears,
  parseStoredLunarDate
} from '@/lib/lunarCalendar';
import { PAYMENT_METHOD_OPTIONS } from '@/lib/paymentMethods';
import { PAYMENT_PLAN_OPTIONS, formatMoney } from '@/lib/paymentPlans';
import { normalizeBirthProfileToUtc8, TIMEZONE_OPTIONS } from '@/lib/timezones';
import type {
  AssetCategory,
  CalendarType,
  GenderOption,
  RegistrationInput,
  SavePreference,
  UserProfileInput
} from '@/types/consultation';

const genderOptions: Array<{ value: GenderOption; label: string }> = [
  { value: 'female', label: '女' },
  { value: 'male', label: '男' },
  { value: 'non_binary', label: '其他' },
  { value: 'prefer_not_to_say', label: '不透露' }
];

const savePreferenceOptions: Array<{ value: SavePreference; label: string; description: string }> = [
  {
    value: 'save',
    label: '愿意保留',
    description: '保留你的资料和聊天记录，下次回来时系统会更懂你，进入状态更快。'
  },
  {
    value: 'do_not_save',
    label: '本次匿名',
    description: '只做本次匿名咨询，不提前建立账号。'
  }
];

const contactTypeOptions: Array<{ value: RegistrationInput['contactType']; label: string }> = [
  { value: 'email', label: '邮箱' },
  { value: 'phone', label: '手机号' }
];

const birthYears = getSupportedBirthYears();
const consultationDisclaimer =
  'Fortune AI 提供的是命理咨询与个人反思参考，不替代医疗、法律、投资等专业意见。';

const maskContactValue = (contactValue: string) => {
  if (!contactValue) {
    return '';
  }

  if (contactValue.includes('@')) {
    const [prefix, suffix] = contactValue.split('@');
    const visiblePrefix =
      prefix.length <= 2 ? `${prefix[0] || ''}*` : `${prefix.slice(0, 2)}***${prefix.slice(-1)}`;
    return `${visiblePrefix}@${suffix}`;
  }

  if (contactValue.length >= 7) {
    return `${contactValue.slice(0, 3)}****${contactValue.slice(-4)}`;
  }

  return contactValue;
};

const inferRequestedAssetCategory = (
  conversation: Array<{ role: 'user' | 'assistant'; content: string; headline?: string }>,
  uploadedCategories: AssetCategory[]
): AssetCategory | null => {
  const latestAssistantMessage = [...conversation]
    .reverse()
    .find((message) => message.role === 'assistant');

  if (!latestAssistantMessage) {
    return null;
  }

  const messageText = `${latestAssistantMessage.headline || ''} ${latestAssistantMessage.content}`;

  if (/面相|正脸|左侧脸|右侧脸|五官/u.test(messageText) && !uploadedCategories.includes('face')) {
    return 'face';
  }

  if (/手相|掌纹|左手|右手|掌心/u.test(messageText) && !uploadedCategories.includes('palm')) {
    return 'palm';
  }

  if (/风水|空间|办公室|工位|卧室|客厅|布局|朝向/u.test(messageText) && !uploadedCategories.includes('space')) {
    return 'space';
  }

  return null;
};

const normalizeProfileDraft = (profile: UserProfileInput): UserProfileInput =>
  normalizeBirthProfileToUtc8(profile);

const toSolarProfile = (currentProfile: UserProfileInput, birthDate: string): UserProfileInput =>
  normalizeProfileDraft({
    ...currentProfile,
    birthCalendarType: 'solar',
    birthDate,
    birthDateLunar: birthDate ? formatLunarDate(convertSolarToLunar(birthDate)) : '',
    birthIsLeapMonth: false
  });

const toLunarProfile = (
  currentProfile: UserProfileInput,
  year: number,
  month: number,
  day: number,
  isLeapMonth: boolean
): UserProfileInput =>
  normalizeProfileDraft({
    ...currentProfile,
    birthCalendarType: 'lunar',
    birthDate: buildStoredLunarDate(year, month, day),
    birthDateLunar: formatLunarDate({
      year,
      month,
      day,
      isLeapMonth
    }),
    birthIsLeapMonth: isLeapMonth
  });

const toggleCalendarType = (
  currentProfile: UserProfileInput,
  calendarType: CalendarType
): UserProfileInput => {
  if (calendarType === currentProfile.birthCalendarType) {
    return currentProfile;
  }

  if (!currentProfile.birthDate) {
    return normalizeProfileDraft({
      ...currentProfile,
      birthCalendarType: calendarType,
      birthDate: '',
      birthDateLunar: '',
      birthIsLeapMonth: false
    });
  }

  if (calendarType === 'solar') {
    const lunarParts = parseStoredLunarDate(currentProfile.birthDate, Boolean(currentProfile.birthIsLeapMonth));

    return lunarParts
      ? toSolarProfile(currentProfile, convertLunarToSolar(lunarParts))
      : normalizeProfileDraft({
          ...currentProfile,
          birthCalendarType: 'solar',
          birthDate: '',
          birthDateLunar: '',
          birthIsLeapMonth: false
        });
  }

  try {
    const solarDate =
      currentProfile.birthCalendarType === 'solar'
        ? currentProfile.birthDate
        : convertLunarToSolar(
            parseStoredLunarDate(currentProfile.birthDate, Boolean(currentProfile.birthIsLeapMonth))!
          );
    const lunarDate = convertSolarToLunar(solarDate);

    return toLunarProfile(
      currentProfile,
      lunarDate.year,
      lunarDate.month,
      lunarDate.day,
      lunarDate.isLeapMonth
    );
  } catch {
    return normalizeProfileDraft({
      ...currentProfile,
      birthCalendarType: 'lunar',
      birthDate: '',
      birthDateLunar: '',
      birthIsLeapMonth: false
    });
  }
};

const getLunarDraftFromProfile = (profile: UserProfileInput) => {
  const lunarParts =
    profile.birthCalendarType === 'lunar'
      ? parseStoredLunarDate(profile.birthDate, Boolean(profile.birthIsLeapMonth))
      : profile.birthDate
        ? convertSolarToLunar(profile.birthDate)
        : null;

  const fallbackYear = birthYears[0];
  const fallbackMonthOption = getLunarMonthOptions(fallbackYear)[0];

  return {
    year: lunarParts?.year || fallbackYear,
    monthValue: lunarParts
      ? `${lunarParts.isLeapMonth ? 'leap-' : ''}${lunarParts.month}`
      : fallbackMonthOption.value,
    day: lunarParts?.day || 1
  };
};

const BirthDateField = ({
  profile,
  onChange
}: {
  profile: UserProfileInput;
  onChange: (nextProfile: UserProfileInput) => void;
}) => {
  const [isLunarPickerOpen, setIsLunarPickerOpen] = useState(false);
  const [lunarDraft, setLunarDraft] = useState(() => getLunarDraftFromProfile(profile));
  const solarInputRef = useRef<HTMLInputElement | null>(null);
  const pickerRef = useRef<HTMLDivElement | null>(null);
  const activeCalendarType = profile.birthCalendarType || 'lunar';

  useEffect(() => {
    setLunarDraft(getLunarDraftFromProfile(profile));
  }, [profile.birthCalendarType, profile.birthDate, profile.birthIsLeapMonth]);

  useEffect(() => {
    if (!isLunarPickerOpen) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (!pickerRef.current?.contains(event.target as Node)) {
        setIsLunarPickerOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
    };
  }, [isLunarPickerOpen]);

  const monthOptions = getLunarMonthOptions(lunarDraft.year);
  const activeMonthOption =
    monthOptions.find((option) => option.value === lunarDraft.monthValue) || monthOptions[0];
  const dayCount = getLunarDayCount(
    lunarDraft.year,
    activeMonthOption.month,
    activeMonthOption.isLeapMonth
  );
  const dayOptions = Array.from({ length: dayCount }, (_, index) => index + 1);
  const visibleValue =
    activeCalendarType === 'solar'
      ? profile.birthDate || ''
      : profile.birthDateLunar || '';

  const hintText =
    activeCalendarType === 'solar'
      ? profile.birthDateLunar
        ? `已自动换算为 ${profile.birthDateLunar}`
        : '保存时会自动换算成农历后再继续。'
      : profile.birthDateLunarUtc8
        ? `内部将按 UTC+8 归一为 ${profile.birthDateLunarUtc8}`
        : '请选择农历日期，系统会同步换算到 UTC+8。';

  return (
    <div className={styles.birthField}>
      <div className={styles.birthFieldHeader}>
        <span className={styles.birthFieldLabel}>出生日期</span>
        <div className={styles.calendarSwitchInline}>
          {(['lunar', 'solar'] as CalendarType[]).map((optionCalendarType) => (
            <button
              key={optionCalendarType}
              type="button"
              className={
                activeCalendarType === optionCalendarType
                  ? styles.calendarToggleActive
                  : styles.calendarToggle
              }
              onClick={() => {
                setIsLunarPickerOpen(false);
                onChange(toggleCalendarType(profile, optionCalendarType));
              }}
            >
              {optionCalendarType === 'lunar' ? '阴历' : '阳历'}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.birthInputRow} ref={pickerRef}>
        <button
          type="button"
          className={styles.dateFieldButton}
          onClick={() => {
            if (activeCalendarType === 'solar') {
              solarInputRef.current?.showPicker?.();
              solarInputRef.current?.focus();
              return;
            }

            setIsLunarPickerOpen((current) => !current);
          }}
        >
          <span className={visibleValue ? styles.dateFieldValue : styles.dateFieldPlaceholder}>
            {visibleValue || '请选择日期'}
          </span>
          <svg viewBox="0 0 24 24" className={styles.dateFieldIcon} aria-hidden="true">
            <path d="M7 3v3M17 3v3M4 9h16M5 6h14a1 1 0 0 1 1 1v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a1 1 0 0 1 1-1Z" />
          </svg>
          {activeCalendarType === 'solar' ? (
            <input
              ref={solarInputRef}
              className={styles.hiddenDateInput}
              type="date"
              value={profile.birthDate}
              onChange={(event) => onChange(toSolarProfile(profile, event.target.value))}
              tabIndex={-1}
              aria-hidden="true"
            />
          ) : null}
        </button>

        {activeCalendarType === 'lunar' && isLunarPickerOpen ? (
          <div className={styles.lunarPopover}>
            <div className={styles.lunarPopoverGrid}>
              <select
                value={String(lunarDraft.year)}
                onChange={(event) => {
                  const nextYear = Number(event.target.value);
                  const nextMonthOption = getLunarMonthOptions(nextYear)[0];

                  setLunarDraft({
                    year: nextYear,
                    monthValue: nextMonthOption.value,
                    day: 1
                  });
                }}
              >
                {birthYears.map((year) => (
                  <option key={year} value={year}>
                    {year}年
                  </option>
                ))}
              </select>

              <select
                value={lunarDraft.monthValue}
                onChange={(event) =>
                  setLunarDraft((current) => ({
                    ...current,
                    monthValue: event.target.value,
                    day: 1
                  }))
                }
              >
                {monthOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>

              <select
                value={String(Math.min(lunarDraft.day, dayCount))}
                onChange={(event) =>
                  setLunarDraft((current) => ({
                    ...current,
                    day: Number(event.target.value)
                  }))
                }
              >
                {dayOptions.map((day) => (
                  <option key={day} value={day}>
                    {day}日
                  </option>
                ))}
              </select>
            </div>

            <div className={styles.lunarPopoverActions}>
              <button
                type="button"
                className={styles.secondaryInlineButton}
                onClick={() => setIsLunarPickerOpen(false)}
              >
                取消
              </button>
              <button
                type="button"
                className={styles.primaryInlineButton}
                onClick={() => {
                  onChange(
                    toLunarProfile(
                      profile,
                      lunarDraft.year,
                      activeMonthOption.month,
                      Math.min(lunarDraft.day, dayCount),
                      activeMonthOption.isLeapMonth
                    )
                  );
                  setIsLunarPickerOpen(false);
                }}
              >
                确认
              </button>
            </div>
          </div>
        ) : null}
      </div>

      <span className={styles.fieldHint}>{hintText}</span>
    </div>
  );
};

export const FortuneExperience = () => {
  const {
    user,
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
  } = useConsultationFlow();
  const [editingProfile, setEditingProfile] = useState<UserProfileInput | null>(null);
  const transcriptRef = useRef<HTMLDivElement | null>(null);
  const selectedPlanOption =
    PAYMENT_PLAN_OPTIONS.find((option) => option.code === selectedPaymentPlan) || PAYMENT_PLAN_OPTIONS[0];
  const requestedAssetCategory = useMemo(
    () =>
      inferRequestedAssetCategory(
        conversation,
        profile.uploadedAssets.map((asset) => asset.category)
      ),
    [conversation, profile.uploadedAssets]
  );

  useEffect(() => {
    if (stage === 'chat' && transcriptRef.current) {
      transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
    }
  }, [conversation, stage]);

  const buildSolarProfile = (currentProfile: UserProfileInput, birthDate: string): UserProfileInput => {
    if (!birthDate) {
      return {
        ...currentProfile,
        birthCalendarType: 'solar',
        birthDate,
        birthDateLunar: '',
        birthIsLeapMonth: false
      };
    }

    try {
      const lunarDate = convertSolarToLunar(birthDate);

      return {
        ...currentProfile,
        birthCalendarType: 'solar',
        birthDate,
        birthDateLunar: formatLunarDate(lunarDate),
        birthIsLeapMonth: false
      };
    } catch {
      return {
        ...currentProfile,
        birthCalendarType: 'solar',
        birthDate,
        birthDateLunar: '',
        birthIsLeapMonth: false
      };
    }
  };

  const buildLunarProfile = (
    currentProfile: UserProfileInput,
    year: number,
    month: number,
    day: number,
    isLeapMonth: boolean
  ): UserProfileInput => ({
    ...currentProfile,
    birthCalendarType: 'lunar',
    birthDate: buildStoredLunarDate(year, month, day),
    birthDateLunar: formatLunarDate({
      year,
      month,
      day,
      isLeapMonth
    }),
    birthIsLeapMonth: isLeapMonth
  });

  const switchCalendarType = (
    currentProfile: UserProfileInput,
    calendarType: CalendarType
  ): UserProfileInput => {
    if (calendarType === currentProfile.birthCalendarType) {
      return currentProfile;
    }

    if (calendarType === 'solar') {
      return {
        ...currentProfile,
        birthCalendarType: 'solar',
        birthDate: '',
        birthDateLunar: '',
        birthIsLeapMonth: false
      };
    }

    if (currentProfile.birthDate) {
      try {
        const lunarDate = convertSolarToLunar(currentProfile.birthDate);
        return buildLunarProfile(
          currentProfile,
          lunarDate.year,
          lunarDate.month,
          lunarDate.day,
          lunarDate.isLeapMonth
        );
      } catch {
        return {
          ...currentProfile,
          birthCalendarType: 'lunar',
          birthDate: '',
          birthDateLunar: '',
          birthIsLeapMonth: false
        };
      }
    }

    return {
      ...currentProfile,
      birthCalendarType: 'lunar',
      birthDate: '',
      birthDateLunar: '',
      birthIsLeapMonth: false
    };
  };

  const renderBirthDateField = (
    currentProfile: UserProfileInput,
    onChange: (nextProfile: UserProfileInput) => void
  ) => {
    const activeCalendarType = currentProfile.birthCalendarType || 'lunar';
    const lunarBirthParts = parseStoredLunarDate(
      currentProfile.birthDate,
      Boolean(currentProfile.birthIsLeapMonth)
    );
    const selectedYear = lunarBirthParts?.year;
    const selectedMonth = lunarBirthParts?.month;
    const selectedDay = lunarBirthParts?.day;
    const monthOptions = selectedYear ? getLunarMonthOptions(selectedYear) : [];
    const selectedMonthValue = lunarBirthParts
      ? `${lunarBirthParts.isLeapMonth ? 'leap-' : ''}${lunarBirthParts.month}`
      : '';
    const selectedMonthOption = monthOptions.find((option) => option.value === selectedMonthValue);
    const dayCount =
      selectedYear && selectedMonthOption
        ? getLunarDayCount(selectedYear, selectedMonthOption.month, selectedMonthOption.isLeapMonth)
        : 30;

    return (
      <label className={styles.birthDateField}>
        <span className={styles.birthDateLabelRow}>
          <span>出生日期</span>
        </span>

        <div className={styles.calendarSwitch}>
          {(['lunar', 'solar'] as CalendarType[]).map((optionCalendarType) => (
            <button
              key={optionCalendarType}
              type="button"
              className={
                activeCalendarType === optionCalendarType
                  ? styles.calendarToggleActive
                  : styles.calendarToggle
              }
              onClick={() => onChange(switchCalendarType(currentProfile, optionCalendarType))}
            >
              {optionCalendarType === 'lunar' ? '阴历' : '阳历'}
            </button>
          ))}
        </div>

        {activeCalendarType === 'solar' ? (
          <div className={styles.birthDateRow}>
            <input
              className={styles.dateInputControl}
              type="date"
              value={currentProfile.birthDate}
              onChange={(event) => onChange(buildSolarProfile(currentProfile, event.target.value))}
            />
            {currentProfile.birthDateLunar ? (
              <span className={styles.fieldHint}>已自动换算为 {currentProfile.birthDateLunar}</span>
            ) : (
              <span className={styles.fieldHint}>保存时会自动换算成农历后再继续。</span>
            )}
          </div>
        ) : (
          <div className={styles.birthDateRow}>
            <div className={styles.lunarDatePicker}>
              <select
                value={selectedYear ? String(selectedYear) : ''}
                onChange={(event) => {
                  const nextYear = Number(event.target.value);

                  if (!nextYear) {
                    onChange({
                      ...currentProfile,
                      birthDate: '',
                      birthDateLunar: '',
                      birthIsLeapMonth: false
                    });
                    return;
                  }

                  const nextMonthOption = getLunarMonthOptions(nextYear)[0];
                  onChange(
                    buildLunarProfile(
                      currentProfile,
                      nextYear,
                      nextMonthOption.month,
                      1,
                      nextMonthOption.isLeapMonth
                    )
                  );
                }}
              >
                <option value="">年份</option>
                {birthYears.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>

              <select
                value={selectedMonthValue}
                disabled={!selectedYear}
                onChange={(event) => {
                  if (!selectedYear) {
                    return;
                  }

                  const nextMonthOption = getLunarMonthOptions(selectedYear).find(
                    (option) => option.value === event.target.value
                  );

                  if (!nextMonthOption) {
                    return;
                  }

                  const nextDay = Math.min(
                    selectedDay || 1,
                    getLunarDayCount(
                      selectedYear,
                      nextMonthOption.month,
                      nextMonthOption.isLeapMonth
                    )
                  );
                  onChange(
                    buildLunarProfile(
                      currentProfile,
                      selectedYear,
                      nextMonthOption.month,
                      nextDay,
                      nextMonthOption.isLeapMonth
                    )
                  );
                }}
              >
                <option value="">月份</option>
                {monthOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>

              <select
                value={selectedDay ? String(selectedDay) : ''}
                disabled={!selectedYear || !selectedMonth}
                onChange={(event) => {
                  if (!selectedYear || !selectedMonthOption) {
                    return;
                  }

                  const nextDay = Number(event.target.value);

                  if (!nextDay) {
                    return;
                  }

                  onChange(
                    buildLunarProfile(
                      currentProfile,
                      selectedYear,
                      selectedMonthOption.month,
                      nextDay,
                      selectedMonthOption.isLeapMonth
                    )
                  );
                }}
              >
                <option value="">日期</option>
                {Array.from({ length: dayCount }, (_, index) => index + 1).map((day) => (
                  <option key={day} value={day}>
                    {day}
                  </option>
                ))}
              </select>
            </div>

            <span className={styles.fieldHint}>
              {currentProfile.birthDateLunar || '请按农历选择年月日。'}
            </span>
          </div>
        )}
      </label>
    );
  };

  const updateProfileField = <K extends keyof UserProfileInput>(
    currentProfile: UserProfileInput,
    field: K,
    value: UserProfileInput[K]
  ): UserProfileInput =>
    normalizeProfileDraft({
      ...currentProfile,
      [field]: value
    });

  const renderProfileFields = (
    currentProfile: UserProfileInput,
    onChange: (nextProfile: UserProfileInput) => void
  ) => (
    <>
      <div className={styles.formGrid}>
        <label>
          称呼
          <input
            value={currentProfile.displayName}
            onChange={(event) =>
              onChange(updateProfileField(currentProfile, 'displayName', event.target.value))
            }
            placeholder="例如：晚风"
          />
        </label>

        <label>
          性别
          <select
            value={currentProfile.gender}
            onChange={(event) =>
              onChange(updateProfileField(currentProfile, 'gender', event.target.value as GenderOption))
            }
          >
            {genderOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className={styles.birthDateTimeGrid}>
        <BirthDateField profile={currentProfile} onChange={onChange} />

        <div className={styles.birthField}>
          <div className={styles.birthFieldHeader}>
            <span className={styles.birthFieldLabel}>出生时间</span>
          </div>

          <div className={styles.birthTimeRow}>
            <input
              type="time"
              value={currentProfile.birthTime}
              onChange={(event) =>
                onChange(updateProfileField(currentProfile, 'birthTime', event.target.value))
              }
            />

            <select
              value={currentProfile.birthTimezone || 'UTC+8'}
              onChange={(event) =>
                onChange(updateProfileField(currentProfile, 'birthTimezone', event.target.value))
              }
            >
              {TIMEZONE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <span className={styles.fieldHint}>
            {currentProfile.birthTimeUtc8
              ? `将统一换算为 UTC+8 ${currentProfile.birthDateUtc8 || ''} ${currentProfile.birthTimeUtc8}`.trim()
              : '可选择出生时间所属时区，系统会统一换算为 UTC+8。'}
          </span>
        </div>
      </div>

      <label className={styles.fullWidth}>
        出生地
        <input
          value={currentProfile.birthLocation}
          onChange={(event) =>
            onChange(updateProfileField(currentProfile, 'birthLocation', event.target.value))
          }
          placeholder="例如：杭州"
        />
      </label>
    </>
  );

  const handleProfileUpdate = async () => {
    if (!editingProfile) {
      return;
    }

    await updateSavedProfile(editingProfile);
    setEditingProfile(null);
  };

  const handleComposerKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();

      if (!followUpQuestion.trim() || isSubmitting) {
        return;
      }

      void sendFollowUp();
    }
  };

  return (
    <main className={styles.page}>
      <div className={styles.backgroundGlow} />
      <section className={styles.firstFold}>
        <HeroSection />

        <section
          className={`${styles.layout} ${stage === 'intake' ? styles.layoutSingle : styles.layoutChat}`}
        >
          {stage === 'intake' ? (
            <section className={styles.intakeCard}>
              <div className={`${styles.cardHeader} ${styles.intakeHeader}`}>
                <span className="consult-badge">資訊填寫</span>
                <h2 className={styles.intakeTitle}>錄入個人資訊　定製專屬命理解析</h2>
              </div>

              {user ? (
                <div className={styles.loggedInBox}>
                  <strong>当前已登录</strong>
                  <span>本次咨询会自动保存到当前账号；如果想匿名咨询，请先在右上角退出登录。</span>
                </div>
              ) : (
                <div className={styles.preferenceGrid}>
                  {savePreferenceOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      className={
                        savePreference === option.value ? styles.preferenceCardActive : styles.preferenceCard
                      }
                      onClick={() => setSavePreference(option.value)}
                    >
                      <strong>{option.label}</strong>
                      <span>{option.description}</span>
                    </button>
                  ))}
                </div>
              )}

              {renderProfileFields(profile, (nextProfile) => setProfile(nextProfile))}

              {!user && savePreference === 'save' ? (
                <div className={styles.registrationBox}>
                  <div className={styles.boxTitle}>保留记录时，先建立咨询账号</div>
                  <div className={styles.formGrid}>
                    <label>
                      账号类型
                      <select
                        value={registration.contactType}
                        onChange={(event) =>
                          setRegistration({
                            ...registration,
                            contactType: event.target.value as RegistrationInput['contactType']
                          })
                        }
                      >
                        {contactTypeOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label>
                      {registration.contactType === 'email' ? '邮箱' : '手机号'}
                      <input
                        value={registration.contactValue}
                        onChange={(event) =>
                          setRegistration({
                            ...registration,
                            contactValue: event.target.value
                          })
                        }
                        placeholder={registration.contactType === 'email' ? 'name@example.com' : '13800000000'}
                      />
                    </label>
                  </div>

                  <label className={styles.fullWidth}>
                    设置密码
                    <input
                      type="password"
                      value={registration.password}
                      onChange={(event) =>
                        setRegistration({
                          ...registration,
                          password: event.target.value
                        })
                      }
                      placeholder="至少 6 位"
                    />
                  </label>
                </div>
              ) : null}

              <button
                type="button"
                className={styles.primaryButton}
                disabled={isSubmitting}
                onClick={saveProfile}
              >
                {isSubmitting ? '保存中' : '保存信息'}
              </button>

              {errorMessage ? <p className={styles.error}>{errorMessage}</p> : null}

              <section className={styles.panelDisclaimer}>{consultationDisclaimer}</section>
            </section>
          ) : (
            <section className={styles.chatStage}>
              <section className={styles.chatCard}>
                <div className={styles.chatHeader}>
                  <div className={styles.cardHeader}>
                    <div className={styles.cardHeaderTop}>
                      <span className={styles.eyebrow}>命理对话</span>
                      <button
                        type="button"
                        className={styles.inlineEditButton}
                        onClick={() => setEditingProfile({ ...profile })}
                      >
                        修改个人信息
                      </button>
                    </div>
                    <h2>现在可以直接开始问</h2>
                    <p>对话里需要什么资料，老师会当下告诉你，不提前堆给你多余步骤。</p>
                  </div>

                  {activeAccount || user ? (
                    <div className={styles.accountBanner}>
                      <div>
                        <strong>咨询账号已建立并已登录</strong>
                        <p>
                          {maskContactValue((activeAccount || user)!.contactValue)} · 本次资料与聊天记录会自动保留。
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className={styles.guestBanner}>
                      <div>
                        <strong>当前为匿名咨询</strong>
                        <p>如需长期保留资料与聊天记录，可在付费时一并建立账号。</p>
                      </div>
                    </div>
                  )}

                  <div className={styles.statusRow}>
                    <span>{isPaid ? '已进入付费深度咨询' : `免费咨询剩余 ${freeTurnsRemaining} 次`}</span>
                    {paymentRequired && !isPaid ? (
                      <button
                        type="button"
                        className={styles.inlinePayButton}
                        onClick={() => setPaymentModalOpen(true)}
                      >
                        查看支付方式
                      </button>
                    ) : null}
                  </div>
                </div>

                <div className={styles.messageList} ref={transcriptRef}>
                  {conversation.map((message, index) => (
                    <article
                      key={`${message.role}-${index}`}
                      className={message.role === 'assistant' ? styles.assistantBubble : styles.userBubble}
                    >
                      {message.headline ? <strong>{message.headline}</strong> : null}
                      <p>{message.content}</p>
                    </article>
                  ))}
                </div>

                <div className={styles.chatComposer}>
                  {profile.uploadedAssets.length > 0 ? (
                    <div className={styles.assetSummary}>
                      已收到 {profile.uploadedAssets.length} 份资料：
                      {profile.uploadedAssets.map((asset) => asset.fileName).join('、')}
                    </div>
                  ) : null}

                  <div className={styles.composer}>
                    <label
                      className={`${styles.attachButton} ${
                        isUploadingAssets ? styles.attachButtonBusy : ''
                      }`}
                      title={
                        requestedAssetCategory
                          ? '老师刚刚要求补资料，点击上传。'
                          : '上传补充资料'
                      }
                    >
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        disabled={isUploadingAssets}
                        onChange={(event) => {
                          uploadAssetsToConversation(
                            event.target.files,
                            requestedAssetCategory || 'other'
                          );
                          event.currentTarget.value = '';
                        }}
                      />
                      <svg viewBox="0 0 24 24" className={styles.attachIcon} aria-hidden="true">
                        <path d="M12 5v14M5 12h14" />
                      </svg>
                    </label>

                    <textarea
                      value={followUpQuestion}
                      onChange={(event) => setFollowUpQuestion(event.target.value)}
                      onKeyDown={handleComposerKeyDown}
                      className={styles.composerInput}
                      placeholder={
                        requestedAssetCategory
                          ? '老师刚刚让你补资料，上传后也可以继续追问。'
                          : conversation.length <= 1
                            ? '有问题，尽管问。'
                            : '继续追问。'
                      }
                      disabled={isSubmitting}
                    />

                    <button
                      type="button"
                      className={styles.sendButton}
                      disabled={isSubmitting}
                      onClick={sendFollowUp}
                      aria-label="发送"
                      title="发送"
                    >
                      <svg viewBox="0 0 24 24" className={styles.sendIcon} aria-hidden="true">
                        <path d="M5 12h11M12 5l7 7-7 7" />
                      </svg>
                    </button>
                  </div>

                  {errorMessage ? <p className={styles.error}>{errorMessage}</p> : null}
                </div>

                <section className={styles.panelDisclaimer}>{consultationDisclaimer}</section>
              </section>
            </section>
          )}
        </section>
      </section>

      {editingProfile ? (
        <div className={styles.modalOverlay}>
          <div className={styles.modalCard}>
            <div className={styles.cardHeader}>
              <span className={styles.eyebrow}>个人信息</span>
              <h2>修改个人信息</h2>
              <p>保存后，后续判断会立刻按最新信息继续。</p>
            </div>

            {renderProfileFields(editingProfile, (nextProfile) => setEditingProfile(nextProfile))}

            <div className={styles.modalActions}>
              <button
                type="button"
                className={styles.secondaryButton}
                onClick={() => setEditingProfile(null)}
                disabled={isSubmitting}
              >
                取消
              </button>
              <button
                type="button"
                className={styles.primaryButton}
                onClick={handleProfileUpdate}
                disabled={isSubmitting}
              >
                {isSubmitting ? '保存中' : '保存修改'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {paymentModalOpen ? (
        <div className={styles.modalOverlay}>
          <div className={styles.modalCard}>
            <div className={styles.paymentHeader}>
              <span className={styles.eyebrow}>支付中心</span>
              <h2>继续咨询</h2>
              <p>选择方案与支付方式即可继续。</p>
            </div>

            <div className={styles.paymentPlanGrid}>
              {PAYMENT_PLAN_OPTIONS.map((option) => (
                <button
                  key={option.code}
                  type="button"
                  className={
                    selectedPaymentPlan === option.code
                      ? styles.paymentPlanCardActive
                      : styles.paymentPlanCard
                  }
                  onClick={() => setSelectedPaymentPlan(option.code)}
                >
                  <span>{option.label}</span>
                  <strong>{formatMoney(option.amountCents, option.currency)}</strong>
                  <p>{option.description}</p>
                </button>
              ))}
            </div>

            <div className={styles.paymentMethodGrid}>
              {PAYMENT_METHOD_OPTIONS.map((option) => (
                <button
                  key={option.code}
                  type="button"
                  className={
                    selectedPaymentMethod === option.code
                      ? styles.paymentMethodCardActive
                      : styles.paymentMethodCard
                  }
                  onClick={() => setSelectedPaymentMethod(option.code)}
                >
                  <div className={styles.methodTitleRow}>
                    <strong>{option.label}</strong>
                    {option.recommended ? <span className={styles.recommendedTag}>推荐</span> : null}
                  </div>
                  <p>{option.description}</p>
                </button>
              ))}
            </div>

            {user ? (
              <div className={styles.paymentAccountBox}>
                <strong>当前支付账号</strong>
                <p>{maskContactValue(user.contactValue)}</p>
              </div>
            ) : null}

            {requiresRegistrationForPayment ? (
              <div className={styles.registrationBox}>
                <div className={styles.boxTitle}>支付时建立咨询账号</div>
                <div className={styles.formGrid}>
                  <label>
                    账号类型
                    <select
                      value={paymentRegistration.contactType}
                      onChange={(event) =>
                        setPaymentRegistration({
                          ...paymentRegistration,
                          contactType: event.target.value as RegistrationInput['contactType']
                        })
                      }
                    >
                      {contactTypeOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    {paymentRegistration.contactType === 'email' ? '邮箱' : '手机号'}
                    <input
                      value={paymentRegistration.contactValue}
                      onChange={(event) =>
                        setPaymentRegistration({
                          ...paymentRegistration,
                          contactValue: event.target.value
                        })
                      }
                      placeholder={
                        paymentRegistration.contactType === 'email'
                          ? 'name@example.com'
                          : '13800000000'
                      }
                    />
                  </label>
                </div>

                <label className={styles.fullWidth}>
                  设置密码
                  <input
                    type="password"
                    value={paymentRegistration.password}
                    onChange={(event) =>
                      setPaymentRegistration({
                        ...paymentRegistration,
                        password: event.target.value
                      })
                    }
                    placeholder="至少 6 位"
                  />
                </label>
              </div>
            ) : null}

            <div className={styles.modalActions}>
              <button
                type="button"
                className={styles.secondaryButton}
                onClick={() => setPaymentModalOpen(false)}
                disabled={isCheckingOut}
              >
                取消
              </button>
              <button
                type="button"
                className={styles.primaryButton}
                onClick={checkoutConsultation}
                disabled={isCheckingOut}
              >
                {isCheckingOut
                  ? '处理中'
                  : `确认支付 ${formatMoney(selectedPlanOption.amountCents, selectedPlanOption.currency)}`}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
};
