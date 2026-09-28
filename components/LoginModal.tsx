import React, { useState, useEffect } from 'react';
import { apiService } from '../services/api';
import { User } from '../types';
import { useTranslation } from '../i18n/LanguageContext';
import PhoneInput from 'react-phone-input-2';
import 'react-phone-input-2/lib/style.css';
import { auth as firebaseAuth, isFirebaseMockEnabled } from '../services/firebase';
import { RecaptchaVerifier, signInWithPhoneNumber, ConfirmationResult } from 'firebase/auth';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (user: User) => void;
}

type LoginMethod = 'email' | 'mobile';

export const LoginModal: React.FC<LoginModalProps> = ({ isOpen, onClose, onLoginSuccess }) => {
  const [isRegister, setIsRegister] = useState(false);
  const [isReset, setIsReset] = useState(false);

  // Login Tab State
  const [loginMethod, setLoginMethod] = useState<LoginMethod>('email');

  // OTP Login Flow States
  const [useOtp, setUseOtp] = useState(true);
  const [step, setStep] = useState<'input' | 'verify' | 'complete'>('input');
  const [otpCode, setOtpCode] = useState('');
  const [onboardingName, setOnboardingName] = useState('');
  const [countdown, setCountdown] = useState(0);
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);
  const [recaptchaVerifier, setRecaptchaVerifier] = useState<any>(null);

  // Form Fields (Legacy)
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState(''); // Stores raw phone with country code from PhoneInput
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [secretKey, setSecretKey] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  // Location / IP State
  const [defaultCountry, setDefaultCountry] = useState('nz');
  const [isChinaMainland, setIsChinaMainland] = useState(false);

  const { t } = useTranslation();

  // Detect basic location via Timezone on mount
  useEffect(() => {
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (
        tz === 'Asia/Shanghai' ||
        tz === 'Asia/Urumqi' ||
        tz === 'Asia/Chongqing' ||
        tz === 'Asia/Harbin'
      ) {
        setDefaultCountry('cn');
        setIsChinaMainland(true);
      } else {
        setDefaultCountry('nz');
        setIsChinaMainland(false);
      }
    } catch (e) {
      setDefaultCountry('nz');
    }
  }, []);

  // OTP Countdown Timer
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (countdown > 0) {
      timer = setTimeout(() => setCountdown((prev) => prev - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [countdown]);

  useEffect(() => {
    if (isOpen) {
      setError('');
      setValidationErrors({});
      setIsLoading(false);
      setPassword('');
      setPasswordConfirm('');
      setSecretKey('');
      setOtpCode('');
      setOnboardingName('');
      setStep('input');
      setCountdown(0);
      if (!isRegister) {
        setPhone('');
        setEmail('');
      }
    }
  }, [isOpen, isRegister, isReset, useOtp]);

  // Firebase reCAPTCHA initialization
  useEffect(() => {
    let verifier: RecaptchaVerifier | null = null;
    if (isOpen && loginMethod === 'mobile' && !isFirebaseMockEnabled) {
      try {
        verifier = new RecaptchaVerifier(firebaseAuth, 'recaptcha-container', {
          size: 'invisible',
          callback: () => {
            // reCAPTCHA solved
          },
          'expired-callback': () => {
            // expired
          }
        });
        setRecaptchaVerifier(verifier);
      } catch (e) {
        console.error('Firebase RecaptchaVerifier init error:', e);
      }
    }

    return () => {
      if (verifier) {
        try {
          verifier.clear();
        } catch (e) {
          /* Optional cleanup/cache failure does not block the page. */
        }
        setRecaptchaVerifier(null);
      }
    };
  }, [isOpen, loginMethod]);

  if (!isOpen) return null;

  const validate = () => {
    const errors: Record<string, string> = {};

    if (useOtp) {
      if (step === 'input') {
        if (loginMethod === 'email') {
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!email.trim()) errors.email = t.login.email + ' is required';
          else if (!emailRegex.test(email)) errors.email = 'Invalid email format';
        } else {
          if (!phone || phone.length < 5) errors.phone = 'Phone number is required';
        }
      } else if (step === 'verify') {
        if (!otpCode || otpCode.length !== 6) {
          errors.otpCode = 'Please enter a valid 6-digit verification code';
        }
      } else if (step === 'complete') {
        if (!onboardingName.trim()) {
          errors.onboardingName = 'Display name is required';
        }
      }
    } else {
      // Legacy Password validation logic
      if (isRegister) {
        if (!name.trim()) errors.name = t.login.name + ' is required';

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!email.trim()) errors.email = t.login.email + ' is required';
        else if (!emailRegex.test(email)) errors.email = 'Invalid email format';

        const pwdRegex = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{8,}$/;
        if (!password) errors.password = 'Password is required';
        else if (!pwdRegex.test(password))
          errors.password = 'Min 8 chars, letter & number required';

        if (password !== passwordConfirm) errors.passwordConfirm = t.login.passwordMismatch;

        if (isChinaMainland) {
          if (!phone || phone.length < 5) {
            errors.phone = 'Phone number is required in your region';
          }
        }
        if (phone && phone.length < 5) {
          errors.phone = 'Invalid phone number';
        }
      } else if (!isReset) {
        if (loginMethod === 'email') {
          if (!email.trim()) errors.email = t.login.email + ' is required';
        } else {
          if (!phone || phone.length < 5) errors.phone = 'Phone number is required';
        }
        if (!password) errors.password = 'Password is required';
      }
    }
    return errors;
  };

  const handleSendOtp = async () => {
    setError('');
    const vErrors = validate();
    if (Object.keys(vErrors).length > 0) {
      setValidationErrors(vErrors);
      return;
    }
    setValidationErrors({});
    setIsLoading(true);

    try {
      const identifier = loginMethod === 'email' ? email : `+${phone}`;
      if (loginMethod === 'mobile' && !isFirebaseMockEnabled) {
        if (!recaptchaVerifier) {
          throw new Error('reCAPTCHA is not initialized. Please try again.');
        }
        const confirmation = await signInWithPhoneNumber(
          firebaseAuth,
          identifier,
          recaptchaVerifier
        );
        setConfirmationResult(confirmation);
        setStep('verify');
        setCountdown(60);
      } else {
        await apiService.sendOtp(identifier);
        setStep('verify');
        setCountdown(60);
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to send verification code');
      if (loginMethod === 'mobile' && !isFirebaseMockEnabled && recaptchaVerifier) {
        try {
          recaptchaVerifier.clear();
          const verifier = new RecaptchaVerifier(firebaseAuth, 'recaptcha-container', {
            size: 'invisible'
          });
          setRecaptchaVerifier(verifier);
        } catch (e) {
          /* Optional cleanup/cache failure does not block the page. */
        }
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    setError('');
    const vErrors = validate();
    if (Object.keys(vErrors).length > 0) {
      setValidationErrors(vErrors);
      return;
    }
    setValidationErrors({});
    setIsLoading(true);

    try {
      const identifier = loginMethod === 'email' ? email : `+${phone}`;
      if (loginMethod === 'mobile' && !isFirebaseMockEnabled) {
        if (!confirmationResult) {
          throw new Error('Verification session expired. Please resend code.');
        }
        const userCredential = await confirmationResult.confirm(otpCode);
        const idToken = await userCredential.user.getIdToken();
        const response = await apiService.verifyFirebaseToken(idToken);
        if (response.isProfileCompleted && response.user) {
          onLoginSuccess(response.user);
          onClose();
        } else {
          setStep('complete');
        }
      } else {
        const response = await apiService.verifyOtp(identifier, otpCode);
        if (response.isProfileCompleted && response.user) {
          onLoginSuccess(response.user);
          onClose();
        } else {
          setStep('complete');
        }
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Verification failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCompleteProfile = async () => {
    setError('');
    const vErrors = validate();
    if (Object.keys(vErrors).length > 0) {
      setValidationErrors(vErrors);
      return;
    }
    setValidationErrors({});
    setIsLoading(true);

    try {
      const response = await apiService.completeProfile(
        onboardingName,
        loginMethod === 'email' ? email : undefined,
        loginMethod === 'mobile' ? `+${phone}` : undefined
      );
      onLoginSuccess(response.user);
      onClose();
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to update profile');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (useOtp) {
      if (step === 'input') {
        await handleSendOtp();
      } else if (step === 'verify') {
        await handleVerifyOtp();
      } else if (step === 'complete') {
        await handleCompleteProfile();
      }
    } else {
      // Legacy Password Flow
      setError('');
      const vErrors = validate();
      if (Object.keys(vErrors).length > 0) {
        setValidationErrors(vErrors);
        return;
      }
      setValidationErrors({});
      setIsLoading(true);

      try {
        if (isReset) {
          await apiService.resetPasswordBySecret(email, password, secretKey);
          setIsReset(false);
          setSecretKey('');
          setPassword('');
        } else if (isRegister) {
          const formattedPhone = phone ? `+${phone}` : undefined;
          const response = await apiService.register(
            name,
            email,
            password,
            passwordConfirm,
            formattedPhone
          );
          const user = response.user ?? (await apiService.getCurrentUser());
          if (!user)
            throw new Error('Registration succeeded but no authenticated session was found.');
          onLoginSuccess(user);
          onClose();
        } else {
          const accountIdentifier = loginMethod === 'email' ? email : `+${phone}`;
          const response = await apiService.login(accountIdentifier, password);
          const user = response.user ?? (await apiService.getCurrentUser());
          if (!user) throw new Error('Sign in succeeded but no authenticated session was found.');
          onLoginSuccess(user);
          onClose();
        }
      } catch (err: any) {
        console.error(err);
        setError(err.message || t.login.error);
      } finally {
        setIsLoading(false);
      }
    }
  };

  const toggleRegister = () => {
    setIsRegister(!isRegister);
    setIsReset(false);
    setError('');
    setValidationErrors({});
  };

  const toggleReset = () => {
    setIsReset(!isReset);
    setIsRegister(false);
    setError('');
    setValidationErrors({});
  };

  let title = t.login.welcome;
  let subtitle = t.login.subtitle;
  if (useOtp) {
    if (step === 'input') {
      title = t.login.welcome;
      subtitle = 'Sign in instantly with a verification code';
    } else if (step === 'verify') {
      title = 'Verify Identity';
      subtitle = `We sent a 6-digit code to ${loginMethod === 'email' ? email : '+' + phone}`;
    } else if (step === 'complete') {
      title = 'Complete Profile';
      subtitle = 'Just one step away! Fill in your basic details';
    }
  } else {
    if (isRegister) {
      title = t.login.welcomeRegister;
      subtitle = t.login.subtitleRegister;
    } else if (isReset) {
      title = t.login.welcomeReset;
      subtitle = t.login.subtitleReset;
    }
  }

  const RequiredStar = () => <span className="text-red-500 ml-1">*</span>;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose}></div>

      <div className="relative bg-white dark:bg-[#050914] border border-slate-200 dark:border-primary-500/30 rounded-3xl w-full max-w-md p-8 animate-fade-in shadow-2xl dark:shadow-[0_0_50px_rgba(245,158,11,0.1)] overflow-visible transition-colors duration-300">
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-5 mix-blend-overlay pointer-events-none rounded-3xl"></div>

        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:text-primary-400 dark:hover:bg-primary-900/20 transition-colors z-20"
        >
          <i className="fas fa-times"></i>
        </button>

        {/* Header */}
        <div className="mb-6 text-center relative z-10">
          <div className="inline-block mb-3 p-3 rounded-full bg-primary-50 dark:bg-primary-500/10 border border-primary-100 dark:border-primary-500/20 text-primary-600 dark:text-primary-400">
            <i
              className={`fas ${
                useOtp
                  ? step === 'input'
                    ? 'fa-fingerprint'
                    : step === 'verify'
                      ? 'fa-shield-alt'
                      : 'fa-user-tag'
                  : isReset
                    ? 'fa-key'
                    : 'fa-fingerprint'
              } text-xl`}
            ></i>
          </div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-primary-50 font-display tracking-wide">
            {title}
          </h2>
          <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm font-mono">{subtitle}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 relative z-10">
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-500/30 text-red-600 dark:text-red-300 text-sm rounded-xl text-center font-mono">
              <i className="fas fa-exclamation-triangle mr-2"></i>
              {error}
            </div>
          )}

          {/* OTP Flow - Step 1: Input */}
          {useOtp && step === 'input' && (
            <>
              {/* Method Switcher */}
              <div className="flex border-b border-slate-200 dark:border-slate-800 mb-6">
                <button
                  type="button"
                  onClick={() => setLoginMethod('email')}
                  className={`flex-1 py-3 text-sm font-bold uppercase tracking-wider transition-all relative ${loginMethod === 'email' ? 'text-primary-600 dark:text-primary-400' : 'text-slate-400 hover:text-slate-600'}`}
                >
                  <i className="fas fa-envelope mr-2"></i> Email
                  {loginMethod === 'email' && (
                    <span className="absolute bottom-0 left-0 w-full h-0.5 bg-primary-500 dark:bg-primary-400 rounded-t-full"></span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setLoginMethod('mobile')}
                  className={`flex-1 py-3 text-sm font-bold uppercase tracking-wider transition-all relative ${loginMethod === 'mobile' ? 'text-primary-600 dark:text-primary-400' : 'text-slate-400 hover:text-slate-600'}`}
                >
                  <i className="fas fa-mobile-alt mr-2"></i> Mobile
                  {loginMethod === 'mobile' && (
                    <span className="absolute bottom-0 left-0 w-full h-0.5 bg-primary-500 dark:bg-primary-400 rounded-t-full"></span>
                  )}
                </button>
              </div>

              {loginMethod === 'email' ? (
                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-2 pl-1">
                    {t.login.email} <RequiredStar />
                  </label>
                  <input
                    type="text"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-[#0a0f1e] border border-slate-200 dark:border-slate-800 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 outline-none transition-all text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 font-mono text-sm"
                    placeholder="link@example.com"
                  />
                  {validationErrors.email && (
                    <p className="text-red-500 text-[10px] mt-1 pl-1 font-bold">
                      {validationErrors.email}
                    </p>
                  )}
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-2 pl-1">
                    {t.login.phone} <RequiredStar />
                  </label>
                  <PhoneInput
                    country={defaultCountry}
                    value={phone}
                    onChange={(phone) => setPhone(phone)}
                    enableSearch={true}
                    disableSearchIcon={true}
                    autoFormat={false}
                    countryCodeEditable={false}
                    preferredCountries={['cn', 'hk', 'us', 'nz']}
                    inputClass="!w-full !h-[50px] !text-sm !font-mono !bg-slate-50 dark:!bg-[#0a0f1e] !border-slate-200 dark:!border-slate-800 focus:!border-primary-500 !text-slate-900 dark:!text-white !rounded-xl placeholder:!text-slate-400 dark:placeholder:!text-slate-600 transition-all !pl-[48px]"
                    buttonClass="!bg-transparent !border-0 !border-r !border-slate-200 dark:!border-slate-800 !rounded-l-xl"
                    dropdownClass="!bg-white dark:!bg-slate-900 !text-slate-800 dark:!text-slate-200 !border-slate-200 dark:!border-slate-700 !shadow-xl !rounded-lg !mt-1 !z-[9999]"
                    searchClass="!bg-white dark:!bg-slate-900 !text-slate-800 dark:!text-white !p-2"
                    dropdownStyle={{ zIndex: 9999 }}
                  />
                  {validationErrors.phone && (
                    <p className="text-red-500 text-[10px] mt-1 pl-1 font-bold">
                      {validationErrors.phone}
                    </p>
                  )}
                </div>
              )}
            </>
          )}

          {/* OTP Flow - Step 2: Verification */}
          {useOtp && step === 'verify' && (
            <div>
              <div className="flex justify-between items-center mb-2 pl-1">
                <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">
                  Verification Code
                </label>
                <button
                  type="button"
                  onClick={() => setStep('input')}
                  className="text-xs text-primary-500 hover:underline transition-all"
                >
                  Change Account
                </button>
              </div>
              <input
                type="text"
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className="w-full px-4 py-4 rounded-xl bg-slate-50 dark:bg-[#0a0f1e] border border-slate-200 dark:border-slate-800 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 outline-none transition-all text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 font-mono text-center text-3xl tracking-[0.4em] font-extrabold"
                placeholder="••••••"
              />
              {validationErrors.otpCode && (
                <p className="text-red-500 text-[10px] mt-1 pl-1 font-bold">
                  {validationErrors.otpCode}
                </p>
              )}

              <div className="mt-4 text-center text-xs text-slate-500 dark:text-slate-400 font-mono">
                {countdown > 0 ? (
                  <span>
                    Resend code in <strong className="text-primary-500">{countdown}s</strong>
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={handleSendOtp}
                    className="text-primary-500 hover:text-primary-600 font-bold underline transition-colors"
                  >
                    Resend Verification Code
                  </button>
                )}
              </div>
            </div>
          )}

          {/* OTP Flow - Step 3: Profile Completion */}
          {useOtp && step === 'complete' && (
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-2 pl-1">
                Display Name / 您的姓名 <RequiredStar />
              </label>
              <input
                type="text"
                value={onboardingName}
                onChange={(e) => setOnboardingName(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-[#0a0f1e] border border-slate-200 dark:border-slate-800 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 outline-none transition-all text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 font-mono text-sm"
                placeholder="John Doe"
              />
              {validationErrors.onboardingName && (
                <p className="text-red-500 text-[10px] mt-1 pl-1 font-bold">
                  {validationErrors.onboardingName}
                </p>
              )}
            </div>
          )}

          {/* Legacy Flow */}
          {!useOtp && (
            <>
              {/* Login Tabs */}
              {!isRegister && !isReset && (
                <div className="flex border-b border-slate-200 dark:border-slate-800 mb-6">
                  <button
                    type="button"
                    onClick={() => setLoginMethod('email')}
                    className={`flex-1 py-3 text-sm font-bold uppercase tracking-wider transition-all relative ${loginMethod === 'email' ? 'text-primary-600 dark:text-primary-400' : 'text-slate-400 hover:text-slate-600'}`}
                  >
                    <i className="fas fa-envelope mr-2"></i> Email
                    {loginMethod === 'email' && (
                      <span className="absolute bottom-0 left-0 w-full h-0.5 bg-primary-500 dark:bg-primary-400 rounded-t-full"></span>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setLoginMethod('mobile')}
                    className={`flex-1 py-3 text-sm font-bold uppercase tracking-wider transition-all relative ${loginMethod === 'mobile' ? 'text-primary-600 dark:text-primary-400' : 'text-slate-400 hover:text-slate-600'}`}
                  >
                    <i className="fas fa-mobile-alt mr-2"></i> Mobile
                    {loginMethod === 'mobile' && (
                      <span className="absolute bottom-0 left-0 w-full h-0.5 bg-primary-500 dark:bg-primary-400 rounded-t-full"></span>
                    )}
                  </button>
                </div>
              )}

              {isRegister && (
                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-2 pl-1">
                    {t.login.name} <RequiredStar />
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-[#0a0f1e] border border-slate-200 dark:border-slate-800 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 outline-none transition-all text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 font-mono text-sm"
                    placeholder="Ident: John Doe"
                  />
                  {validationErrors.name && (
                    <p className="text-red-500 text-[10px] mt-1 pl-1 font-bold">
                      {validationErrors.name}
                    </p>
                  )}
                </div>
              )}

              {(isRegister || isReset || loginMethod === 'email') && (
                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-2 pl-1">
                    {t.login.email} <RequiredStar />
                  </label>
                  <input
                    type="text"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-[#0a0f1e] border border-slate-200 dark:border-slate-800 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 outline-none transition-all text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 font-mono text-sm"
                    placeholder="link@example.com"
                  />
                  {validationErrors.email && (
                    <p className="text-red-500 text-[10px] mt-1 pl-1 font-bold">
                      {validationErrors.email}
                    </p>
                  )}
                </div>
              )}

              {(isRegister || (!isReset && loginMethod === 'mobile')) && (
                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-2 pl-1">
                    {t.login.phone}
                    {(loginMethod === 'mobile' || (isRegister && isChinaMainland)) && (
                      <RequiredStar />
                    )}
                    {isRegister && !isChinaMainland && (
                      <span className="opacity-50 font-normal lowercase ml-1">(optional)</span>
                    )}
                  </label>
                  <PhoneInput
                    country={defaultCountry}
                    value={phone}
                    onChange={(phone) => setPhone(phone)}
                    enableSearch={true}
                    disableSearchIcon={true}
                    autoFormat={false}
                    countryCodeEditable={false}
                    preferredCountries={['cn', 'hk', 'us', 'nz']}
                    inputClass="!w-full !h-[50px] !text-sm !font-mono !bg-slate-50 dark:!bg-[#0a0f1e] !border-slate-200 dark:!border-slate-800 focus:!border-primary-500 !text-slate-900 dark:!text-white !rounded-xl placeholder:!text-slate-400 dark:placeholder:!text-slate-600 transition-all !pl-[48px]"
                    buttonClass="!bg-transparent !border-0 !border-r !border-slate-200 dark:!border-slate-800 !rounded-l-xl"
                    dropdownClass="!bg-white dark:!bg-slate-900 !text-slate-800 dark:!text-slate-200 !border-slate-200 dark:!border-slate-700 !shadow-xl !rounded-lg !mt-1 !z-[9999]"
                    searchClass="!bg-white dark:!bg-slate-900 !text-slate-800 dark:!text-white !p-2"
                    dropdownStyle={{ zIndex: 9999 }}
                  />
                  {validationErrors.phone && (
                    <p className="text-red-500 text-[10px] mt-1 pl-1 font-bold">
                      {validationErrors.phone}
                    </p>
                  )}
                </div>
              )}

              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-2 pl-1">
                  {isReset ? t.login.newPassword : t.login.password} <RequiredStar />
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-[#0a0f1e] border border-slate-200 dark:border-slate-800 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 outline-none transition-all text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 font-mono text-sm"
                  placeholder="••••••••"
                />
                {validationErrors.password && (
                  <p className="text-red-500 text-[10px] mt-1 pl-1 font-bold">
                    {validationErrors.password}
                  </p>
                )}
              </div>

              {isRegister && (
                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-2 pl-1">
                    {t.login.confirmPassword} <RequiredStar />
                  </label>
                  <input
                    type="password"
                    value={passwordConfirm}
                    onChange={(e) => setPasswordConfirm(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-[#0a0f1e] border border-slate-200 dark:border-slate-800 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 outline-none transition-all text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 font-mono text-sm"
                    placeholder="••••••••"
                  />
                  {validationErrors.passwordConfirm && (
                    <p className="text-red-500 text-[10px] mt-1 pl-1 font-bold">
                      {validationErrors.passwordConfirm}
                    </p>
                  )}
                </div>
              )}

              {isReset && (
                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-2 pl-1">
                    {t.login.secretKey} <RequiredStar />
                  </label>
                  <input
                    type="password"
                    value={secretKey}
                    onChange={(e) => setSecretKey(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-[#0a0f1e] border border-red-200 dark:border-red-900/50 focus:border-red-500/50 focus:ring-2 focus:ring-red-500/20 outline-none transition-all text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 font-mono text-sm"
                    placeholder="Secret Protocol Key"
                    required={isReset}
                  />
                </div>
              )}
            </>
          )}

          {/* Firebase reCAPTCHA Container */}
          <div id="recaptcha-container" className="my-2"></div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3.5 bg-primary-500 dark:bg-primary-500 text-white dark:text-black rounded-xl font-bold uppercase tracking-widest hover:bg-primary-600 dark:hover:bg-primary-400 hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed mt-4 flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <i className="fas fa-circle-notch fa-spin"></i>
            ) : useOtp ? (
              step === 'input' ? (
                'Send Code'
              ) : step === 'verify' ? (
                'Verify & Login'
              ) : (
                'Complete & Onboard'
              )
            ) : isReset ? (
              t.login.reset
            ) : isRegister ? (
              t.login.register
            ) : (
              t.login.signin
            )}
          </button>
        </form>

        <div className="mt-8 flex flex-col items-center gap-3 relative z-10 border-t border-slate-100 dark:border-white/5 pt-4 text-xs font-medium uppercase tracking-wider">
          <button
            onClick={() => {
              setUseOtp(!useOtp);
              setIsRegister(false);
              setIsReset(false);
            }}
            className="text-primary-500 hover:text-primary-600 transition-colors font-bold tracking-widest mb-1"
          >
            {useOtp ? '👉 Use password login (Legacy)' : '👉 Use verification code login'}
          </button>

          {!useOtp && !isReset && (
            <button
              onClick={toggleRegister}
              className="text-slate-500 dark:text-slate-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
            >
              {isRegister ? t.login.toLogin : t.login.toRegister}
            </button>
          )}

          {!useOtp && !isRegister && (
            <button
              onClick={toggleReset}
              className="text-slate-400 dark:text-slate-500 hover:text-red-500 dark:hover:text-red-400 transition-colors"
            >
              {isReset ? t.login.backToLogin : t.login.forgotPassword}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
