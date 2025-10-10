import React from 'react';
import { Head, Link } from '@inertiajs/react';
import Layout from '../../components/layout/Layout';
import { FileManager } from '../../components/files/FileManager';
import { Breadcrumb } from '../../components/common/Breadcrumb';
import { Server } from '../../types/server';
import { cn } from '../../utils/cn';
import { theme } from '../../theme';
import { ServerStackProvider } from '../../contexts/ServerStackContext';

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
      <ServerStackProvider serverId={serverid} stackName={stackname} serverName={server.name}>
        <div className="py-12">
          <div className="max-w-7xl mx-auto sm:px-6 lg:px-8">
            {/* Header */}
            <div className="mb-8">
              <Breadcrumb
                items={[
                  { label: `${server.name} Stacks`, href: `/servers/${serverid}/stacks` },
                  { label: stackname, href: `/servers/${serverid}/stacks/${stackname}` },
                  { label: 'Files' },
                ]}
              />

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
            <FileManager canRead={canRead} canWrite={canWrite} />
          </div>
        </div>
      </ServerStackProvider>
    </Layout>
  );
};

export default FileManagerPage;
