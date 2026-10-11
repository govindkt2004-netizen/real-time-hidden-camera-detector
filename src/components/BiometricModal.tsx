import React, { useState, useEffect } from 'react';
import { Fingerprint, Lock, ShieldCheck, KeyRound, AlertCircle, X, CheckCircle2 } from 'lucide-react';
import { BiometricService } from '../services/biometric';

interface Props {
  isOpen: boolean;
  mode: 'unlock' | 'enroll';
  onSuccess: () => void;
  onClose: () => void;
}

export const BiometricModal: React.FC<Props> = ({
  isOpen,
  mode,
  onSuccess,
  onClose,
}) => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [bioSupported, setBioSupported] = useState(false);
  const [authSuccess, setAuthSuccess] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setError(null);
      setPin('');
      setAuthSuccess(false);
      BiometricService.isBiometricAvailable().then(setBioSupported);

      // Auto-trigger biometric on unlock if supported
      if (mode === 'unlock') {
        handleBiometricPrompt();
      }
    }
  }, [isOpen, mode]);

  if (!isOpen) return null;

  const handleBiometricPrompt = async () => {
    setIsVerifying(true);
    setError(null);
    try {
      const res = await BiometricService.authenticateBiometric();
      if (res.success) {
        setAuthSuccess(true);
        setTimeout(() => {
          onSuccess();
        }, 500);
      } else if (res.error) {
        setError(res.error);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Biometric verification failed');
    } finally {
      setIsVerifying(false);
    }
  };

  const handlePinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pin || pin.length < 4) {
      setError('Please enter a 4-digit security PIN');
      return;
    }

    setIsVerifying(true);
    setError(null);

    try {
      if (mode === 'enroll') {
        await BiometricService.enrollWithBiometrics(pin);
        setAuthSuccess(true);
        setTimeout(() => {
          onSuccess();
        }, 500);
      } else {
        const valid = await BiometricService.verifyPin(pin);
        if (valid) {
          setAuthSuccess(true);
          setTimeout(() => {
            onSuccess();
          }, 500);
        } else {
          setError('Incorrect PIN. Please try again or use default (1234).');
        }
      }
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-sm rounded-2xl bg-slate-900 border border-slate-700 p-6 text-slate-100 shadow-2xl">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex flex-col items-center text-center">
          <div className="relative mb-4">
            <div className={`w-16 h-16 rounded-full flex items-center justify-center border-2 ${
              authSuccess
                ? 'bg-emerald-950/80 border-emerald-500 text-emerald-400'
                : 'bg-red-950/40 border-red-500/50 text-red-400'
            }`}>
              {authSuccess ? (
                <CheckCircle2 className="w-8 h-8 animate-scale" />
              ) : (
                <Fingerprint className={`w-8 h-8 ${isVerifying ? 'animate-pulse text-amber-400' : ''}`} />
              )}
            </div>
          </div>

          <h3 className="text-lg font-bold text-slate-100">
            {mode === 'enroll' ? 'Setup Biometric Security' : 'Biometric Security Gate'}
          </h3>
          <p className="mt-1 text-xs text-slate-400 max-w-xs">
            {mode === 'enroll'
              ? 'Enroll Touch ID / Face ID / Windows Hello or set a security PIN to protect sweep logs and incident records.'
              : 'Verify your identity using biometric sensors or enter your security PIN to unlock the evidence vault.'}
          </p>

          {error && (
            <div className="mt-3 w-full p-2.5 rounded-lg bg-red-950/60 border border-red-500/40 text-red-300 text-xs flex items-center gap-2 text-left">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
              <span>{error}</span>
            </div>
          )}

          {bioSupported && mode === 'unlock' && (
            <button
              onClick={handleBiometricPrompt}
              disabled={isVerifying || authSuccess}
              className="mt-4 w-full py-2.5 px-4 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-semibold flex items-center justify-center gap-2 shadow-lg shadow-red-900/40 transition-all cursor-pointer"
            >
              <Fingerprint className="w-4 h-4" />
              <span>{isVerifying ? 'Scanning Biometrics...' : 'Use Touch ID / Face ID'}</span>
            </button>
          )}

          <div className="my-4 w-full flex items-center gap-2 text-[11px] text-slate-500 uppercase tracking-widest font-mono">
            <div className="flex-1 h-px bg-slate-800"></div>
            <span>{bioSupported && mode === 'unlock' ? 'or Security PIN' : 'Security PIN'}</span>
            <div className="flex-1 h-px bg-slate-800"></div>
          </div>

          <form onSubmit={handlePinSubmit} className="w-full space-y-3">
            <div className="relative">
              <KeyRound className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
              <input
                type="password"
                maxLength={8}
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder={mode === 'enroll' ? 'Choose 4-6 digit PIN (e.g. 1234)' : 'Enter 4-6 digit PIN'}
                className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm font-mono tracking-widest focus:outline-none focus:border-red-500 transition-colors"
                autoFocus={!bioSupported}
              />
            </div>

            <button
              type="submit"
              disabled={isVerifying || authSuccess}
              className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center justify-center gap-2 border border-slate-600 transition-all cursor-pointer"
            >
              <Lock className="w-4 h-4" />
              <span>{mode === 'enroll' ? 'Save & Enable Protection' : 'Verify Security PIN'}</span>
            </button>
          </form>

          {mode === 'unlock' && (
            <p className="mt-3 text-[11px] text-slate-500 font-mono">
              Default factory PIN: 1234
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
