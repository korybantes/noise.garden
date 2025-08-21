import React, { useState } from 'react';
import { Key, Shield, Eye, EyeOff } from 'lucide-react';

interface WebAuthnSetupProps {
  username: string;
  onSuccess: (message: string) => void;
  onError: (error: string) => void;
}

// WebAuthn credential types
interface PublicKeyCredential extends Credential {
  rawId: ArrayBuffer;
  response: AuthenticatorAttestationResponse | AuthenticatorAssertionResponse;
}

interface AuthenticatorAttestationResponse extends AuthenticatorResponse {
  attestationObject: ArrayBuffer;
}

interface AuthenticatorAssertionResponse extends AuthenticatorResponse {
  authenticatorData: ArrayBuffer;
  signature: ArrayBuffer;
  userHandle: ArrayBuffer | null;
}

export function WebAuthnSetup({ username, onSuccess, onError }: WebAuthnSetupProps) {
  const [isRegistering, setIsRegistering] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [password, setPassword] = useState('');

  const isWebAuthnSupported = () => {
    return typeof window !== 'undefined' && 
           window.PublicKeyCredential && 
           typeof window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable === 'function' &&
           typeof window.PublicKeyCredential.isConditionalMediationAvailable === 'function';
  };

  const registerWebAuthn = async () => {
    if (!isWebAuthnSupported()) {
      onError('WebAuthn is not supported in your browser');
      return;
    }

    setIsRegistering(true);
    try {
      // Step 1: Get registration options from server
      const response = await fetch('/api/webauthn', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'generateRegistrationOptions',
          args: { username }
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to get registration options');
      }

      const options = await response.json();

      // Step 2: Create credentials in browser
      const credential = await navigator.credentials.create({
        publicKey: {
          ...options,
          challenge: Uint8Array.from(options.challenge, (c: string) => c.charCodeAt(0)),
          user: {
            id: Uint8Array.from(options.userID, (c: string) => c.charCodeAt(0)),
            name: options.userName,
            displayName: options.userName,
          },
        }
      }) as PublicKeyCredential | null;

      if (!credential) {
        throw new Error('Failed to create credentials');
      }

      // Step 3: Send credential to server for verification
      const verificationResponse = await fetch('/api/webauthn', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'verifyRegistration',
          args: {
            username,
            credential: {
              id: credential.id,
              type: credential.type,
              rawId: Array.from(new Uint8Array(credential.rawId)),
              response: {
                attestationObject: Array.from(new Uint8Array((credential.response as AuthenticatorAttestationResponse).attestationObject)),
                clientDataJSON: Array.from(new Uint8Array(credential.response.clientDataJSON)),
              }
            },
            passwordHash: password // In production, hash this client-side
          }
        })
      });

      if (!verificationResponse.ok) {
        const error = await verificationResponse.json();
        throw new Error(error.error || 'Failed to verify registration');
      }

      const result = await verificationResponse.json();
      onSuccess(result.message);
      setPassword('');
    } catch (error) {
      console.error('WebAuthn registration error:', error);
      onError(error instanceof Error ? error.message : 'Registration failed');
    } finally {
      setIsRegistering(false);
    }
  };

  const authenticateWithWebAuthn = async () => {
    if (!isWebAuthnSupported()) {
      onError('WebAuthn is not supported in your browser');
      return;
    }

    setIsAuthenticating(true);
    try {
      // Step 1: Get authentication options from server
      const response = await fetch('/api/webauthn', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'generateAuthenticationOptions',
          args: { username }
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to get authentication options');
      }

      const options = await response.json();

      // Step 2: Get credentials from browser
      const credential = await navigator.credentials.get({
        publicKey: {
          ...options,
          challenge: Uint8Array.from(options.challenge, (c: string) => c.charCodeAt(0)),
          allowCredentials: options.allowCredentials.map((cred: any) => ({
            ...cred,
            id: Uint8Array.from(cred.id, (c: string) => c.charCodeAt(0)),
          })),
        }
      }) as PublicKeyCredential | null;

      if (!credential) {
        throw new Error('Failed to get credentials');
      }

      // Step 3: Send credential to server for verification
      const verificationResponse = await fetch('/api/webauthn', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'verifyAuthentication',
          args: {
            username,
            credential: {
              id: credential.id,
              type: credential.type,
              rawId: Array.from(new Uint8Array(credential.rawId)),
              response: {
                authenticatorData: Array.from(new Uint8Array((credential.response as AuthenticatorAssertionResponse).authenticatorData)),
                clientDataJSON: Array.from(new Uint8Array(credential.response.clientDataJSON)),
                signature: Array.from(new Uint8Array((credential.response as AuthenticatorAssertionResponse).signature)),
                userHandle: Array.from(new Uint8Array((credential.response as AuthenticatorAssertionResponse).userHandle || new Uint8Array())),
              }
            }
          }
        })
      });

      if (!verificationResponse.ok) {
        const error = await verificationResponse.json();
        throw new Error(error.error || 'Failed to verify authentication');
      }

      const result = await verificationResponse.json();
      onSuccess('Authentication successful! You can now sign in with your passkey.');
    } catch (error) {
      console.error('WebAuthn authentication error:', error);
      onError(error instanceof Error ? error.message : 'Authentication failed');
    } finally {
      setIsAuthenticating(false);
    }
  };

  if (!isWebAuthnSupported()) {
    return (
      <div className="p-4 border border-amber-200 dark:border-amber-800 rounded bg-amber-50 dark:bg-amber-900/20">
        <div className="flex items-center gap-2 text-amber-700 dark:text-amber-300">
          <Shield size={16} />
          <span className="font-mono text-sm">WebAuthn not supported in your browser</span>
        </div>
        <p className="mt-2 text-xs font-mono text-amber-600 dark:text-amber-400">
          Passkeys require a modern browser with WebAuthn support. You can still use password authentication.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
        <Key size={16} />
        <span className="font-mono text-sm">Passkey Setup</span>
      </div>
      
      <div className="space-y-3">
        <div className="relative">
          <input
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter password for backup"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 font-mono text-sm"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
          >
            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
        
        <div className="flex gap-2">
          <button
            onClick={registerWebAuthn}
            disabled={isRegistering || !password.trim()}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded font-mono text-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isRegistering ? 'Setting up...' : 'Setup Passkey'}
          </button>
          
          <button
            onClick={authenticateWithWebAuthn}
            disabled={isAuthenticating}
            className="flex-1 px-4 py-2 bg-green-600 text-white rounded font-mono text-sm hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isAuthenticating ? 'Authenticating...' : 'Test Passkey'}
          </button>
        </div>
      </div>
      
      <div className="text-xs font-mono text-gray-600 dark:text-gray-400">
        <p>• Passkeys provide secure, passwordless authentication</p>
        <p>• Your password is still required as a backup method</p>
        <p>• Passkeys work across all your devices</p>
      </div>
    </div>
  );
} 