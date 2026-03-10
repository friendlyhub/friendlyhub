import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Download, Eye, EyeOff, Copy, Check } from 'lucide-react';
import { getApp, verifyDomain, checkDomainStatus } from '../api/client';

function extractDomain(appId: string): string | null {
  const parts = appId.split('.');
  if (parts.length < 3) return null;
  return `${parts[1]}.${parts[0]}`;
}

export default function VerifyApp() {
  const { appId } = useParams<{ appId: string }>();
  const navigate = useNavigate();
  const [showToken, setShowToken] = useState(false);
  const [copied, setCopied] = useState(false);
  const [verifyError, setVerifyError] = useState('');

  const { data: app, isLoading: appLoading } = useQuery({
    queryKey: ['app', appId],
    queryFn: () => getApp(appId!),
    enabled: !!appId,
  });

  const domain = appId ? extractDomain(appId) : null;

  const { data: domainStatus, isLoading: domainLoading } = useQuery({
    queryKey: ['domainStatus', domain],
    queryFn: () => checkDomainStatus(domain!),
    enabled: !!domain && !!app && !app.is_verified,
  });

  const verifyMutation = useMutation({
    mutationFn: () => verifyDomain(appId!),
    onSuccess: (data) => {
      if (data.status === 'verified' || data.status === 'already_verified') {
        navigate('/my/apps');
      } else {
        setVerifyError(data.message || 'Verification failed. Make sure the token file is accessible.');
      }
    },
  });

  const handleCopyToken = async () => {
    if (domainStatus?.token) {
      await navigator.clipboard.writeText(domainStatus.token);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDownloadFile = () => {
    if (!domainStatus?.token) return;
    const blob = new Blob([domainStatus.token + '\n'], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'org.friendlyhub.VerifiedApps.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  if (appLoading || domainLoading) {
    return <div className="text-center py-12 text-gray-500 dark:text-gray-400">Loading...</div>;
  }

  if (!app) {
    return <div className="text-center py-12 text-gray-500 dark:text-gray-400">App not found</div>;
  }

  if (app.is_verified) {
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center py-12 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800">
          <p className="text-gray-700 dark:text-gray-300 font-medium">This app is already verified.</p>
          <button
            onClick={() => navigate('/my/apps')}
            className="mt-4 text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 font-medium"
          >
            Back to My Apps
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">Verify Domain Ownership</h1>
      <p className="text-gray-600 dark:text-gray-400 mb-6">
        Verify ownership of <span className="font-semibold">{domain}</span> for{' '}
        <span className="font-mono font-semibold">{appId}</span>
      </p>

      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6 space-y-4">
        <p className="text-sm text-gray-700 dark:text-gray-300">
          Place a text file at the following URL containing your verification token:
        </p>

        <div className="bg-gray-50 dark:bg-gray-950 rounded-lg p-3 font-mono text-sm text-gray-800 dark:text-gray-200 break-all">
          {domainStatus?.well_known_url || `https://${domain}/.well-known/org.friendlyhub.VerifiedApps.txt`}
        </div>

        {domainStatus?.token && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Token:</span>
              <code className="bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded text-sm font-mono dark:text-gray-100">
                {showToken ? domainStatus.token : '••••••••••••••••'}
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
        )}

        <button
          onClick={handleDownloadFile}
          disabled={!domainStatus?.token}
          className="inline-flex items-center gap-2 text-sm text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 font-medium disabled:opacity-50"
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
            Back
          </button>
        </div>
      </div>
    </div>
  );
}
