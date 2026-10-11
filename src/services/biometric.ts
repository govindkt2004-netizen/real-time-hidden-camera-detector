/**
 * Biometric & Security Authentication Service
 * Utilizes standard WebAuthn API (Fingerprint / TouchID / FaceID / Windows Hello)
 * with local security PIN fallback for devices lacking biometric hardware.
 */

export interface AuthState {
  isAuthenticated: boolean;
  isEnrolled: boolean;
  biometricSupported: boolean;
  biometricType: 'fingerprint' | 'face' | 'platform' | 'pin';
}

const STORAGE_KEY_ENROLLED = 'cam_detector_auth_enrolled';
const STORAGE_KEY_PIN = 'cam_detector_auth_pin_hash';
const STORAGE_KEY_CRED_ID = 'cam_detector_webauthn_cred_id';

// Simple sha256 helper for PIN hashing
async function hashPin(pin: string): Promise<string> {
  const enc = new TextEncoder();
  const data = enc.encode(pin + '_cam_detector_salt_2026');
  const buf = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(buf));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export class BiometricService {
  /**
   * Check if the device browser supports platform authenticators (FaceID/TouchID/Windows Hello)
   */
  public static async isBiometricAvailable(): Promise<boolean> {
    if (typeof window === 'undefined') return false;
    if (!window.PublicKeyCredential) return false;

    try {
      if (typeof PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable === 'function') {
        return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
      }
      return true;
    } catch {
      return false;
    }
  }

  public static isAuthRequired(): boolean {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(STORAGE_KEY_ENROLLED) === 'true';
  }

  public static async enrollWithBiometrics(pinFallback: string): Promise<boolean> {
    const pinHash = await hashPin(pinFallback);
    localStorage.setItem(STORAGE_KEY_PIN, pinHash);

    const bioAvailable = await this.isBiometricAvailable();
    if (bioAvailable && window.PublicKeyCredential) {
      try {
        const challenge = new Uint8Array(32);
        crypto.getRandomValues(challenge);

        const userId = new Uint8Array(16);
        crypto.getRandomValues(userId);

        const createOptions: PublicKeyCredentialCreationOptions = {
          challenge,
          rp: {
            name: 'Hidden Camera Detector Security',
            id: window.location.hostname || 'localhost',
          },
          user: {
            id: userId,
            name: 'security-operator@device',
            displayName: 'Security Operator',
          },
          pubKeyCredParams: [
            { alg: -7, type: 'public-key' },  // ES256
            { alg: -257, type: 'public-key' }, // RS256
          ],
          authenticatorSelection: {
            authenticatorAttachment: 'platform',
            userVerification: 'preferred',
            requireResidentKey: false,
          },
          timeout: 60000,
          attestation: 'none',
        };

        const credential = await navigator.credentials.create({
          publicKey: createOptions,
        }) as PublicKeyCredential | null;

        if (credential) {
          const credIdBase64 = btoa(String.fromCharCode(...new Uint8Array(credential.rawId)));
          localStorage.setItem(STORAGE_KEY_CRED_ID, credIdBase64);
        }
      } catch (err) {
        console.warn('WebAuthn enrollment skipped or cancelled; using PIN fallback', err);
      }
    }

    localStorage.setItem(STORAGE_KEY_ENROLLED, 'true');
    return true;
  }

  public static async authenticateBiometric(): Promise<{ success: boolean; error?: string }> {
    const credIdBase64 = localStorage.getItem(STORAGE_KEY_CRED_ID);
    const bioAvailable = await this.isBiometricAvailable();

    if (!bioAvailable || !credIdBase64 || !window.PublicKeyCredential) {
      return { success: false, error: 'Biometric authenticator unavailable. Please use PIN.' };
    }

    try {
      const challenge = new Uint8Array(32);
      crypto.getRandomValues(challenge);

      const rawId = Uint8Array.from(atob(credIdBase64), c => c.charCodeAt(0));

      const getOptions: PublicKeyCredentialRequestOptions = {
        challenge,
        allowCredentials: [
          {
            id: rawId,
            type: 'public-key',
          },
        ],
        userVerification: 'required',
        timeout: 60000,
      };

      const assertion = await navigator.credentials.get({
        publicKey: getOptions,
      });

      if (assertion) {
        return { success: true };
      }
      return { success: false, error: 'Biometric verification failed' };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Biometric prompt cancelled';
      return { success: false, error: message };
    }
  }

  public static async verifyPin(pin: string): Promise<boolean> {
    const savedPinHash = localStorage.getItem(STORAGE_KEY_PIN);
    if (!savedPinHash) {
      // Default initial pin is 1234 if unconfigured
      return pin === '1234';
    }
    const enteredHash = await hashPin(pin);
    return enteredHash === savedPinHash;
  }

  public static removeAuth(): void {
    localStorage.removeItem(STORAGE_KEY_ENROLLED);
    localStorage.removeItem(STORAGE_KEY_PIN);
    localStorage.removeItem(STORAGE_KEY_CRED_ID);
  }
}
