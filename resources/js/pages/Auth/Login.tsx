import { useForm, Head, Link } from '@inertiajs/react';
import { FormEventHandler } from 'react';
import Layout from '../../components/layout/Layout';
import FlashMessages from '../../components/FlashMessages';
import { cn } from '../../utils/cn';
import { theme } from '../../theme';

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
          <h2 className={cn('mt-6 text-center text-3xl font-extrabold', theme.text.strong)}>
            Sign in to your account
          </h2>
        </div>

        <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
          <div className={theme.cards.auth}>
            <FlashMessages className="mb-4" />

            <form className="space-y-6" onSubmit={submit}>
              <div>
                <label htmlFor="username" className={cn(theme.forms.label, 'mb-2')}>
                  Username
                </label>
                <input
                  id="username"
                  name="username"
                  type="text"
                  required
                  value={data.username}
                  onChange={(e) => setData('username', e.target.value)}
                  className={theme.forms.input}
                  placeholder="Enter your username"
                />
                {errors.username && (
                  <p className={cn('mt-2 text-sm flex items-center space-x-1', theme.text.danger)}>
                    <span>⚠️</span>
                    <span>{errors.username}</span>
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="password" className={cn(theme.forms.label, 'mb-2')}>
                  Password
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  value={data.password}
                  onChange={(e) => setData('password', e.target.value)}
                  className={theme.forms.input}
                  placeholder="Enter your password"
                />
                {errors.password && (
                  <p className={cn('mt-2 text-sm flex items-center space-x-1', theme.text.danger)}>
                    <span>⚠️</span>
                    <span>{errors.password}</span>
                  </p>
                )}
              </div>

              {rememberMeEnabled && (
                <div
                  className={cn('flex items-center space-x-3 p-4 rounded-xl', theme.surface.muted)}
                >
                  <input
                    id="remember_me"
                    name="remember_me"
                    type="checkbox"
                    checked={data.remember_me}
                    onChange={(e) => setData('remember_me', e.target.checked)}
                    className={theme.forms.checkbox}
                  />
                  <label htmlFor="remember_me" className={cn('text-sm', theme.text.standard)}>
                    Remember me for {rememberMeDays || 30} days
                  </label>
                </div>
              )}

              <div>
                <button
                  type="submit"
                  disabled={processing}
                  className={cn('w-full flex justify-center items-center', theme.buttons.primary)}
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
                  <Link href="/auth/password-reset" className={cn(theme.link.subtle)}>
                    Forgot your password?
                  </Link>
                </div>

                {emailVerificationEnabled && (
                  <div className={cn('text-center p-4 rounded-xl', theme.intent.info.surface)}>
                    <form method="POST" action="/auth/resend-verification" className="space-y-3">
                      <input type="hidden" name="_token" value={csrfToken} />
                      <input
                        type="email"
                        name="email"
                        placeholder="Enter email to resend verification"
                        className={cn('w-full text-sm', theme.forms.input)}
                      />
                      <button type="submit" className={cn(theme.link.underlined)}>
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
