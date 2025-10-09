import React from 'react';
import { Head, Link } from '@inertiajs/react';
import Layout from '../../components/Layout';
import { FileManager } from '../../components/files/FileManager';
import { Server } from '../../types/server';
import { cn } from '../../utils/cn';
import { theme } from '../../theme';

interface FileManagerProps {
  title: string;
  server: Server;
  serverid: number;
  stackname: string;
  permissions: string[];
}

const FileManagerPage: React.FC<FileManagerProps> = ({
  title,
  server,
  serverid,
  stackname,
  permissions = [],
}) => {
  const canRead = permissions.includes('files.read');
  const canWrite = permissions.includes('files.write');

  return (
    <Layout>
      <Head title={title} />

      <div className="py-12">
        <div className="max-w-7xl mx-auto sm:px-6 lg:px-8">
          {/* Header */}
          <div className="mb-8">
            <nav className="flex" aria-label="Breadcrumb">
              <ol className="inline-flex items-center space-x-1 md:space-x-3">
                <li className="inline-flex items-center">
                  <Link
                    href="/"
                    className={cn(
                      'inline-flex items-center text-sm font-medium transition-colors',
                      theme.text.muted,
                      'hover:text-blue-600 dark:hover:text-blue-400'
                    )}
                  >
                    <svg className="w-3 h-3 mr-2" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z"></path>
                    </svg>
                    Dashboard
                  </Link>
                </li>
                <li>
                  <div className="flex items-center">
                    <svg
                      className={cn('w-6 h-6', theme.text.subtle)}
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                        clipRule="evenodd"
                      ></path>
                    </svg>
                    <Link
                      href={`/servers/${serverid}/stacks`}
                      className={cn(
                        'ml-1 text-sm font-medium md:ml-2 transition-colors',
                        theme.text.muted,
                        'hover:text-blue-600 dark:hover:text-blue-400'
                      )}
                    >
                      {server.name} Stacks
                    </Link>
                  </div>
                </li>
                <li>
                  <div className="flex items-center">
                    <svg
                      className={cn('w-6 h-6', theme.text.subtle)}
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                        clipRule="evenodd"
                      ></path>
                    </svg>
                    <Link
                      href={`/servers/${serverid}/stacks/${stackname}`}
                      className={cn(
                        'ml-1 text-sm font-medium md:ml-2 transition-colors',
                        theme.text.muted,
                        'hover:text-blue-600 dark:hover:text-blue-400'
                      )}
                    >
                      {stackname}
                    </Link>
                  </div>
                </li>
                <li aria-current="page">
                  <div className="flex items-center">
                    <svg
                      className={cn('w-6 h-6', theme.text.subtle)}
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                        clipRule="evenodd"
                      ></path>
                    </svg>
                    <span className={cn('ml-1 text-sm font-medium md:ml-2', theme.text.subtle)}>
                      Files
                    </span>
                  </div>
                </li>
              </ol>
            </nav>

            <div className="mt-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center space-x-3">
                    <svg
                      className={cn('w-8 h-8', theme.text.info)}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M8 1v4M16 1v4"
                      />
                    </svg>
                    <h1 className={cn('text-3xl font-bold', theme.text.strong)}>File Manager</h1>
                  </div>
                  <p className={cn('mt-2', theme.text.muted)}>
                    Manage files and directories for <strong>{stackname}</strong> on {server.name}
                  </p>
                </div>
                <div className="flex items-center space-x-2">
                  <Link
                    href={`/servers/${serverid}/stacks/${stackname}`}
                    className={cn(theme.buttons.secondary)}
                  >
                    <svg
                      className="w-4 h-4 mr-2"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M10 19l-7-7m0 0l7-7m-7 7h18"
                      />
                    </svg>
                    Back to Stack
                  </Link>
                </div>
              </div>
            </div>
          </div>

          {/* File Manager Component */}
          <FileManager
            serverid={serverid}
            stackname={stackname}
            canRead={canRead}
            canWrite={canWrite}
          />
        </div>
      </div>
    </Layout>
  );
};

export default FileManagerPage;
