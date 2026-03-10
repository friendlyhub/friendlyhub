import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { HelpCircle, Download, Eye, EyeOff, Copy, Check, ShieldCheck, Users } from 'lucide-react';
import { createApp, verifyDomain } from '../api/client';
import { useAuthStore } from '../stores/auth';
import type { VerificationInfo } from '../types';

const APP_ID_REGEX = /^[a-zA-Z0-9_-]+(\.[a-zA-Z0-9_-]+){2,}$/;

export default function NewApp() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [developerType, setDeveloperType] = useState<'original' | 'third_party' | null>(null);
  const [appId, setAppId] = useState('');
  const [originalAppId, setOriginalAppId] = useState('');
  const [showTooltip, setShowTooltip] = useState(false);
  const [appIdError, setAppIdError] = useState('');
  const [originalAppIdError, setOriginalAppIdError] = useState('');
  const [verification, setVerification] = useState<VerificationInfo | null>(null);
  const [showToken, setShowToken] = useState(false);
  const [copied, setCopied] = useState(false);
  const [verifyError, setVerifyError] = useState('');

  const mutation = useMutation({
    mutationFn: () =>
      createApp({
        app_id: appId,
        developer_type: developerType!,
        ...(developerType === 'third_party' ? { original_app_id: originalAppId } : {}),
      }),
    onSuccess: (data) => {
      if (data.verification) {
        setVerification(data.verification);
        if (data.verification.status === 'verified') {
          navigate(`/my/apps`);
        }
      } else {
        navigate(`/my/apps`);
      }
    },
  });

  const verifyMutation = useMutation({
    mutationFn: () => verifyDomain(appId),
    onSuccess: (data) => {
      if (data.status === 'verified' || data.status === 'already_verified') {
        navigate('/my/apps');
      } else {
        setVerifyError(data.message || 'Verification failed. Make sure the token file is accessible.');
      }
    },
  });

  const validateAppId = (value: string) => {
    if (!value) {
      setAppIdError('');
      return;
    }
    if (!APP_ID_REGEX.test(value)) {
      setAppIdError('Must be reverse-DNS format with at least 3 components (e.g. org.example.MyApp)');
    } else {
      setAppIdError('');
    }
  };

  const validateOriginalAppId = (value: string) => {
    if (!value) {
      setOriginalAppIdError('');
      return;
    }
    if (!APP_ID_REGEX.test(value)) {
      setOriginalAppIdError('Must be reverse-DNS format with at least 3 components');
    } else {
      setOriginalAppIdError('');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (appIdError || originalAppIdError) return;
    if (!developerType) return;
    if (developerType === 'third_party' && !originalAppId) return;
    mutation.mutate();
  };

  const handleCopyToken = async () => {
    if (verification?.token) {
      await navigator.clipboard.writeText(verification.token);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDownloadFile = () => {
    if (!verification?.token) return;
    const blob = new Blob([verification.token + '\n'], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'org.friendlyhub.VerifiedApps.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  const isFormValid =
    developerType &&
    appId &&
    !appIdError &&
    (developerType === 'original' || (originalAppId && !originalAppIdError));

  // If we've already registered and are showing verification UI
  if (verification && verification.status === 'pending') {
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">Verify Domain Ownership</h1>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          Your app <span className="font-mono font-semibold">{appId}</span> has been registered.
          Complete domain verification to get the verified badge.
        </p>

        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6 space-y-4">
          <p className="text-sm text-gray-700 dark:text-gray-300">
            Place a text file at the following URL containing your verification token:
          </p>

          <div className="bg-gray-50 dark:bg-gray-950 rounded-lg p-3 font-mono text-sm text-gray-800 dark:text-gray-200 break-all">
            {verification.well_known_url}
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Token:</span>
              <code className="bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded text-sm font-mono dark:text-gray-100">
                {showToken ? verification.token : '••••••••••••••••'}
              </code>
              <button
                onClick={() => setShowToken(!showToken)}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                title={showToken ? 'Hide' : 'Reveal'}
              >
                {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
              <button
                onClick={handleCopyToken}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                title="Copy token"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            onClick={handleDownloadFile}
            className="inline-flex items-center gap-2 text-sm text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 font-medium"
          >
            <Download className="w-4 h-4" />
            Download verification file
          </button>

          {verifyError && (
            <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg p-3 text-sm text-red-700 dark:text-red-400">
              {verifyError}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              onClick={() => {
                setVerifyError('');
                verifyMutation.mutate();
              }}
              disabled={verifyMutation.isPending}
              className="bg-emerald-600 text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50"
            >
              {verifyMutation.isPending ? 'Verifying...' : 'Verify Now'}
            </button>
            <button
              onClick={() => navigate('/my/apps')}
              className="text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-300 px-4 py-2.5 text-sm font-medium"
            >
              Verify Later
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-6">Register New App</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Developer Type Selection */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">I am:</span>
            <button
              type="button"
              onClick={() => setShowTooltip(!showTooltip)}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <HelpCircle className="w-4 h-4" />
            </button>
          </div>

          {showTooltip && (
            <div className="mb-4 bg-gray-800 text-white rounded-xl p-4 text-sm space-y-3 relative">
              <div className="absolute -top-2 left-16 w-4 h-4 bg-gray-800 rotate-45" />
              <div>
                <strong>Original Developer</strong>
                <p className="text-gray-300 mt-1">
                  Use this if you are the original developer of this package and have control over the
                  domain. You will need to verify domain ownership, after which your app will be
                  flagged as verified.
                </p>
              </div>
              <div>
                <strong>Third-Party Packager</strong>
                <p className="text-gray-300 mt-1">
                  Use this if you are submitting a Flatpak package for an app that you do not develop
                  yourself. You will not require domain verification for this option, however, your app
                  will not get a verified flag, and the original developer can claim ownership of this
                  app should they decide to publish to FriendlyHub themselves.
                </p>
              </div>
            </div>
          )}

          <div className="flex gap-4">
            <label
              className={`flex-1 flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-colors ${
                developerType === 'original'
                  ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950'
                  : 'border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700'
              }`}
            >
              <input
                type="radio"
                name="developerType"
                value="original"
                checked={developerType === 'original'}
                onChange={() => {
                  setDeveloperType('original');
                  setAppId('');
                  setAppIdError('');
                }}
                className="accent-emerald-600"
              />
              <div>
                <div className="flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span className="font-medium text-gray-900 dark:text-gray-100">Original Developer</span>
                </div>
              </div>
            </label>

            <label
              className={`flex-1 flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-colors ${
                developerType === 'third_party'
                  ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950'
                  : 'border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700'
              }`}
            >
              <input
                type="radio"
                name="developerType"
                value="third_party"
                checked={developerType === 'third_party'}
                onChange={() => {
                  setDeveloperType('third_party');
                  setAppId(user ? `io.github.${user.github_login}.` : '');
                  setAppIdError('');
                }}
                className="accent-emerald-600"
              />
              <div>
                <div className="flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-blue-500" />
                  <span className="font-medium text-gray-900 dark:text-gray-100">Third-Party Packager</span>
                </div>
              </div>
            </label>
          </div>
        </div>

        {/* App ID Field */}
        {developerType && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              App ID <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={appId}
              onChange={(e) => {
                setAppId(e.target.value);
                validateAppId(e.target.value);
              }}
              placeholder={developerType === 'original' ? 'org.myorganisation.myapp' : undefined}
              className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:bg-gray-800 dark:text-gray-100 ${
                appIdError ? 'border-red-300' : 'border-gray-300 dark:border-gray-600'
              }`}
            />
            {appIdError && <p className="text-xs text-red-600 dark:text-red-400 mt-1">{appIdError}</p>}
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {developerType === 'original'
                ? 'Reverse-DNS format, at least 3 components. You must own this domain.'
                : 'Reverse-DNS format, at least 3 components. This usually refers to your forge/code hosting (e.g. GitHub) username.'}
            </p>
          </div>
        )}

        {/* Original App ID (third-party only) */}
        {developerType === 'third_party' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Original App ID <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={originalAppId}
              onChange={(e) => {
                setOriginalAppId(e.target.value);
                validateOriginalAppId(e.target.value);
              }}
              placeholder="org.someorganisation.appname"
              className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:bg-gray-800 dark:text-gray-100 ${
                originalAppIdError ? 'border-red-300' : 'border-gray-300 dark:border-gray-600'
              }`}
            />
            {originalAppIdError && <p className="text-xs text-red-600 dark:text-red-400 mt-1">{originalAppIdError}</p>}
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">App ID of the original app</p>
          </div>
        )}

        {mutation.isError && (
          <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg p-3 text-sm text-red-700 dark:text-red-400">
            {(mutation.error as Error).message}
          </div>
        )}

        {developerType && (
          <button
            type="submit"
            disabled={mutation.isPending || !isFormValid}
            className="w-full bg-emerald-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50"
          >
            {mutation.isPending ? 'Registering...' : 'Register App'}
          </button>
        )}
      </form>
    </div>
  );
}
