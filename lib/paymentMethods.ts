import type { PaymentMethod } from '@/types/consultation';

export interface PaymentMethodConfig {
  code: PaymentMethod;
  label: string;
  description: string;
  recommended?: boolean;
}

export const PAYMENT_METHODS: Record<PaymentMethod, PaymentMethodConfig> = {
  usdt: {
    code: 'usdt',
    label: 'USDT',
    description: '到账更快，优先推荐。',
    recommended: true
  },
  wechat_pay: {
    code: 'wechat_pay',
    label: '微信支付',
    description: '适合日常国内支付。'
  },
  alipay: {
    code: 'alipay',
    label: '支付宝',
    description: '适合常用支付宝账户。'
  },
  visa: {
    code: 'visa',
    label: 'Visa',
    description: '适合国际银行卡支付。'
  }
};

export const PAYMENT_METHOD_OPTIONS = Object.values(PAYMENT_METHODS);
