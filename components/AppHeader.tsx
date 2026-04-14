'use client';

import { useState } from 'react';
import styles from '@/components/AppHeader.module.css';
import { useAuth } from '@/hooks/useAuth';
import type { LoginInput } from '@/types/auth';

const defaultLoginInput: LoginInput = {
  contactType: 'email',
  contactValue: '',
  password: ''
};

const maskContactValue = (contactValue: string) => {
  if (contactValue.includes('@')) {
    const [prefix, suffix] = contactValue.split('@');
    return `${prefix.slice(0, 2)}***@${suffix}`;
  }

  if (contactValue.length >= 7) {
    return `${contactValue.slice(0, 3)}****${contactValue.slice(-4)}`;
  }

  return contactValue;
};

export const AppHeader = () => {
  const { user, isLoading, login, logout } = useAuth();
  const [loginModalOpen, setLoginModalOpen] = useState(false);
  const [loginInput, setLoginInput] = useState<LoginInput>(defaultLoginInput);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleLogin = async () => {
    setIsSubmitting(true);
    setErrorMessage('');

    try {
      await login(loginInput);
      setLoginModalOpen(false);
      setLoginInput(defaultLoginInput);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to log in.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogout = async () => {
    setIsSubmitting(true);
    setErrorMessage('');

    try {
      await logout();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to log out.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <header className={styles.shell}>
        <div className={styles.brand}>
          <strong>Fortune AI</strong>
          <span>命理咨询与长期记录同步到同一账号</span>
        </div>

        <div className={styles.actions}>
          {user ? (
            <>
              <div className={styles.userChip}>
                <span>{user.displayName || '已登录'}</span>
                <span>{maskContactValue(user.contactValue)}</span>
              </div>
              <button
                type="button"
                className={styles.buttonSecondary}
                onClick={handleLogout}
                disabled={isSubmitting}
              >
                Logout
              </button>
            </>
          ) : (
            <button
              type="button"
              className={styles.buttonPrimary}
              onClick={() => setLoginModalOpen(true)}
              disabled={isLoading}
            >
              Login
            </button>
          )}
        </div>
      </header>

      {loginModalOpen ? (
        <div className={styles.overlay}>
          <div className={styles.card}>
            <h2 className={styles.title}>Login</h2>
            <p className={styles.subtitle}>已注册会直接登录；未注册会自动创建账号并登录，历史咨询和后续记录会统一绑定到当前账号。</p>

            <div className={styles.formGrid}>
              <label>
                账号类型
                <select
                  value={loginInput.contactType}
                  onChange={(event) =>
                    setLoginInput({
                      ...loginInput,
                      contactType: event.target.value as LoginInput['contactType']
                    })
                  }
                >
                  <option value="email">邮箱</option>
                  <option value="phone">手机号</option>
                </select>
              </label>

              <label>
                {loginInput.contactType === 'email' ? '邮箱' : '手机号'}
                <input
                  value={loginInput.contactValue}
                  onChange={(event) =>
                    setLoginInput({
                      ...loginInput,
                      contactValue: event.target.value
                    })
                  }
                  placeholder={
                    loginInput.contactType === 'email' ? 'name@example.com' : '13800000000'
                  }
                />
              </label>

              <label>
                密码
                <input
                  type="password"
                  value={loginInput.password}
                  onChange={(event) =>
                    setLoginInput({
                      ...loginInput,
                      password: event.target.value
                    })
                  }
                  placeholder="请输入密码"
                />
              </label>
            </div>

            {errorMessage ? <p className={styles.error}>{errorMessage}</p> : null}

            <div className={styles.modalActions}>
              <button
                type="button"
                className={styles.buttonSecondary}
                onClick={() => setLoginModalOpen(false)}
                disabled={isSubmitting}
              >
                取消
              </button>
              <button
                type="button"
                className={styles.buttonPrimary}
                onClick={handleLogin}
                disabled={isSubmitting}
              >
                {isSubmitting ? '登录中' : '确认登录'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
};
