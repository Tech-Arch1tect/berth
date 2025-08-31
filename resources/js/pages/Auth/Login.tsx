import { useForm, Head, Link } from '@inertiajs/react';
import { FormEventHandler } from 'react';
import Layout from '../../components/Layout';
import FlashMessages from '../../components/FlashMessages';

interface LoginProps {
  csrfToken?: string;
  emailVerificationEnabled?: boolean;
  rememberMeEnabled?: boolean;
  rememberMeDays?: number;
}

export default function Login({
  csrfToken,
  emailVerificationEnabled,
  rememberMeEnabled,
  rememberMeDays,
}: LoginProps) {
  const { data, setData, post, processing, errors } = useForm({
    username: '',
    password: '',
    remember_me: false,
  });

  const submit: FormEventHandler = (e) => {
    e.preventDefault();
    post('/auth/login', {
      headers: {
        'X-CSRF-Token': csrfToken || '',
      },
    });
  };

  return (
    <Layout>
      <Head title="Login" />
      <div className="min-h-full flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900 dark:text-white">
            Sign in to your account
          </h2>
        </div>

        <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
          <div className="bg-white dark:bg-gray-800 py-8 px-4 shadow sm:rounded-lg sm:px-10">
            <FlashMessages className="mb-4" />

            <form className="space-y-6" onSubmit={submit}>
              <div>
                <label
                  htmlFor="username"
                  className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2"
                >
                  Username
                </label>
                <input
                  id="username"
                  name="username"
                  type="text"
                  required
                  value={data.username}
                  onChange={(e) => setData('username', e.target.value)}
                  className="block w-full px-4 py-3 bg-white/50 dark:bg-slate-800/50 border border-slate-200/50 dark:border-slate-600/50 rounded-xl placeholder-slate-400 dark:placeholder-slate-500 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 dark:focus:border-blue-400 transition-all duration-200 backdrop-blur-sm"
                  placeholder="Enter your username"
                />
                {errors.username && (
                  <p className="mt-2 text-sm text-red-500 dark:text-red-400 flex items-center space-x-1">
                    <span>⚠️</span>
                    <span>{errors.username}</span>
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="password"
                  className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2"
                >
                  Password
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  value={data.password}
                  onChange={(e) => setData('password', e.target.value)}
                  className="block w-full px-4 py-3 bg-white/50 dark:bg-slate-800/50 border border-slate-200/50 dark:border-slate-600/50 rounded-xl placeholder-slate-400 dark:placeholder-slate-500 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 dark:focus:border-blue-400 transition-all duration-200 backdrop-blur-sm"
                  placeholder="Enter your password"
                />
                {errors.password && (
                  <p className="mt-2 text-sm text-red-500 dark:text-red-400 flex items-center space-x-1">
                    <span>⚠️</span>
                    <span>{errors.password}</span>
                  </p>
                )}
              </div>

              {rememberMeEnabled && (
                <div className="flex items-center space-x-3 p-4 bg-slate-50/50 dark:bg-slate-800/30 rounded-xl border border-slate-200/50 dark:border-slate-700/50">
                  <input
                    id="remember_me"
                    name="remember_me"
                    type="checkbox"
                    checked={data.remember_me}
                    onChange={(e) => setData('remember_me', e.target.checked)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 focus:ring-2 focus:ring-offset-0 border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 rounded transition-colors"
                  />
                  <label
                    htmlFor="remember_me"
                    className="text-sm text-slate-700 dark:text-slate-300"
                  >
                    Remember me for {rememberMeDays || 30} days
                  </label>
                </div>
              )}

              <div>
                <button
                  type="submit"
                  disabled={processing}
                  className="w-full flex justify-center items-center py-3 px-4 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 disabled:from-slate-400 disabled:to-slate-500 text-white font-medium rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                >
                  {processing ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                      Signing in...
                    </>
                  ) : (
                    'Sign in'
                  )}
                </button>
              </div>

              <div className="space-y-4 pt-6 border-t border-slate-200/50 dark:border-slate-700/50">
                <div className="text-center">
                  <Link
                    href="/auth/password-reset"
                    className="text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                  >
                    Forgot your password?
                  </Link>
                </div>

                {emailVerificationEnabled && (
                  <div className="text-center p-4 bg-blue-50/50 dark:bg-blue-900/20 rounded-xl border border-blue-200/30 dark:border-blue-800/30">
                    <form method="POST" action="/auth/resend-verification" className="space-y-3">
                      <input type="hidden" name="_token" value={csrfToken} />
                      <input
                        type="email"
                        name="email"
                        placeholder="Enter email to resend verification"
                        className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-600 bg-white/50 dark:bg-slate-800/50 text-slate-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      />
                      <button
                        type="submit"
                        className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 underline transition-colors"
                      >
                        Resend verification email
                      </button>
                    </form>
                  </div>
                )}
              </div>
            </form>
          </div>
        </div>
      </div>
    </Layout>
  );
}
