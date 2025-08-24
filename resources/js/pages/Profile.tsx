import { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import FlashMessages from '../components/FlashMessages';
import { Head, Link, useForm, usePage } from '@inertiajs/react';
import { User } from '../types';

interface ProfileProps {
  title: string;
  csrfToken?: string;
}

export default function Profile({ title, csrfToken }: ProfileProps) {
  const { props } = usePage();
  const user = props.currentUser as User;
  const [totpEnabled, setTotpEnabled] = useState<boolean | null>(null);
  const [showDisableForm, setShowDisableForm] = useState(false);
  const {
    data: disableData,
    setData: setDisableData,
    post: postDisable,
    processing: disableProcessing,
  } = useForm({
    password: '',
    code: '',
  });

  useEffect(() => {
    // Fetch TOTP status
    fetch('/api/totp/status')
      .then((response) => response.json())
      .then((data) => setTotpEnabled(data.enabled))
      .catch((error) => console.error('Failed to fetch TOTP status:', error));
  }, []);

  const disableTOTP = (e: React.FormEvent) => {
    e.preventDefault();
    postDisable('/auth/totp/disable', {
      headers: {
        'X-CSRF-Token': csrfToken || '',
      },
      onSuccess: () => {
        setShowDisableForm(false);
        setDisableData({ password: '', code: '' });
        setTotpEnabled(false);
      },
    });
  };

  return (
    <Layout>
      <Head title={title} />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="py-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-8">Profile</h1>

          <FlashMessages className="mb-6" />

          <div className="space-y-6">
            {/* User Information */}
            <div className="bg-white dark:bg-gray-800 shadow rounded-lg">
              <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                <h2 className="text-lg font-semibold text-gray-800 dark:text-white">
                  User Information
                </h2>
              </div>
              <div className="px-6 py-4 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Username
                    </label>
                    <div className="mt-1 p-2 bg-gray-50 dark:bg-gray-700 rounded-md">
                      <span className="text-gray-900 dark:text-white">{user.username}</span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Email
                    </label>
                    <div className="mt-1 p-2 bg-gray-50 dark:bg-gray-700 rounded-md">
                      <span className="text-gray-900 dark:text-white">{user.email}</span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Member since
                    </label>
                    <div className="mt-1 p-2 bg-gray-50 dark:bg-gray-700 rounded-md">
                      <span className="text-gray-900 dark:text-white">
                        {new Date(user.created_at).toLocaleDateString('en-GB', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                        })}
                      </span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Last updated
                    </label>
                    <div className="mt-1 p-2 bg-gray-50 dark:bg-gray-700 rounded-md">
                      <span className="text-gray-900 dark:text-white">
                        {new Date(user.updated_at).toLocaleDateString('en-GB', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                        })}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Security Settings */}
            <div className="bg-white dark:bg-gray-800 shadow rounded-lg">
              <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                <h2 className="text-lg font-semibold text-gray-800 dark:text-white">
                  Security Settings
                </h2>
              </div>
              <div className="px-6 py-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-medium text-gray-900 dark:text-white">
                      Two-Factor Authentication
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                      Add an extra layer of security to your account with TOTP authentication.
                    </p>
                    <div className="mt-2">
                      {totpEnabled === null ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200">
                          Loading...
                        </span>
                      ) : totpEnabled ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-400">
                          ✓ Enabled
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 dark:bg-red-900/20 text-red-800 dark:text-red-400">
                          ✗ Disabled
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex space-x-3">
                    {totpEnabled ? (
                      <button
                        onClick={() => setShowDisableForm(true)}
                        className="bg-red-600 dark:bg-red-700 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-red-700 dark:hover:bg-red-600 focus:ring-2 focus:ring-red-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800"
                      >
                        Disable 2FA
                      </button>
                    ) : (
                      <Link
                        href="/auth/totp/setup"
                        className="bg-blue-600 dark:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 dark:hover:bg-blue-600 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800"
                      >
                        Enable 2FA
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* TOTP Disable Modal */}
          {showDisableForm && (
            <div className="fixed inset-0 bg-gray-600 dark:bg-gray-900 bg-opacity-50 dark:bg-opacity-70 overflow-y-auto h-full w-full z-50">
              <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white dark:bg-gray-800">
                <div className="mt-3">
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                    Disable Two-Factor Authentication
                  </h3>

                  <form onSubmit={disableTOTP}>
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Current Password
                      </label>
                      <input
                        type="password"
                        value={disableData.password}
                        onChange={(e) => setDisableData('password', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:ring-2 focus:ring-red-500 focus:border-red-500"
                        required
                      />
                    </div>

                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        TOTP Code
                      </label>
                      <input
                        type="text"
                        value={disableData.code}
                        onChange={(e) => setDisableData('code', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:ring-2 focus:ring-red-500 focus:border-red-500"
                        placeholder="123456"
                        maxLength={6}
                        required
                      />
                    </div>

                    <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 p-3 rounded-md mb-4">
                      <p className="text-sm text-yellow-700 dark:text-yellow-300">
                        <strong>Warning:</strong> Disabling 2FA will make your account less secure.
                      </p>
                    </div>

                    <div className="flex space-x-3">
                      <button
                        type="submit"
                        disabled={disableProcessing}
                        className="flex-1 bg-red-600 dark:bg-red-700 text-white py-2 px-4 rounded-md hover:bg-red-700 dark:hover:bg-red-600 focus:ring-2 focus:ring-red-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800 disabled:opacity-50"
                      >
                        {disableProcessing ? 'Disabling...' : 'Disable 2FA'}
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setShowDisableForm(false);
                          setDisableData({ password: '', code: '' });
                        }}
                        className="flex-1 bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-200 py-2 px-4 rounded-md hover:bg-gray-400 dark:hover:bg-gray-500 focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
