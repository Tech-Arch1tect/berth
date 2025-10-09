import React from 'react';
import { Head, Link } from '@inertiajs/react';
import { cn } from '../../utils/cn';
import { theme } from '../../theme';

interface GenericErrorProps {
  code?: number;
  message?: string;
}

export default function GenericError({ code = 500, message }: GenericErrorProps) {
  const getErrorTitle = (code: number) => {
    switch (code) {
      case 400:
        return 'Bad Request';
      case 401:
        return 'Unauthorized';
      case 403:
        return 'Forbidden';
      case 404:
        return 'Not Found';
      case 429:
        return 'Too Many Requests';
      case 500:
        return 'Internal Server Error';
      default:
        return 'Error';
    }
  };

  return (
    <>
      <Head title={`${code} - ${getErrorTitle(code)}`} />

      <div className={cn('min-h-screen flex items-center justify-center', theme.layout.authShell)}>
        <div className="text-center">
          <h1 className={cn('text-9xl font-bold', theme.text.subtle)}>{code}</h1>
          <h2 className={cn('mt-4 text-2xl font-semibold', theme.text.strong)}>
            {message || getErrorTitle(code)}
          </h2>
          <p className={cn('mt-2', theme.text.muted)}>Something went wrong.</p>

          <div className="mt-6 space-x-4">
            <Link href="/" className={cn('inline-flex items-center', theme.buttons.primary)}>
              Go Home
            </Link>

            <button
              onClick={() => window.history.back()}
              className={cn('inline-flex items-center', theme.buttons.secondary)}
            >
              Go Back
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
