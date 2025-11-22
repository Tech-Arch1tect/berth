import React, { useState } from 'react';
import { Head, useForm, usePage } from '@inertiajs/react';
import FlashMessages from '../../components/FlashMessages';
import { Modal } from '../../components/common/Modal';
import { Tabs } from '../../components/common/Tabs';
import { cn } from '../../utils/cn';
import { theme } from '../../theme';

interface Props {
  title: string;
}

interface ImportResult {
  success: boolean;
  encryption_secret: string;
  summary: {
    users_imported: number;
    roles_imported: number;
    servers_imported: number;
    totp_secrets_imported: number;
    permissions_imported: number;
  };
}

export default function Migration({ title }: Props) {
  const [activeTab, setActiveTab] = useState<'export' | 'import'>('export');
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [showEncryptionSecret, setShowEncryptionSecret] = useState(false);
  const [exportProcessing, setExportProcessing] = useState(false);
  const [errorModal, setErrorModal] = useState<{ isOpen: boolean; title: string; message: string }>(
    {
      isOpen: false,
      title: '',
      message: '',
    }
  );
  const { props } = usePage();
  const csrfToken = props.csrfToken as string | undefined;

  const exportForm = useForm({
    password: '',
  });

  const importForm = useForm({
    password: '',
    backup_file: null as File | null,
  });

  const handleExport = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!exportForm.data.password) {
      setErrorModal({
        isOpen: true,
        title: 'Password Required',
        message: 'Password is required for export',
      });
      return;
    }

    if (exportForm.data.password.length < 12) {
      setErrorModal({
        isOpen: true,
        title: 'Invalid Password',
        message: 'Password must be at least 12 characters long',
      });
      return;
    }

    try {
      setExportProcessing(true);

      const response = await fetch('/api/v1/admin/migration/export', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken || '',
        },
        credentials: 'include',
        body: JSON.stringify({ password: exportForm.data.password }),
      });

      if (!response.ok) {
        throw new Error(`Export failed: ${response.status} ${response.statusText}`);
      }

      const contentDisposition = response.headers.get('Content-Disposition');
      const filename = contentDisposition
        ? contentDisposition.split('filename=')[1]?.replace(/"/g, '')
        : `berth-backup-${Date.now()}.json`;

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      exportForm.reset();
    } catch (error) {
      console.error('Export failed:', error);
      setErrorModal({
        isOpen: true,
        title: 'Export Failed',
        message: `Export failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
    } finally {
      setExportProcessing(false);
    }
  };

  const handleImport = (e: React.FormEvent) => {
    e.preventDefault();

    if (!importForm.data.password) {
      setErrorModal({
        isOpen: true,
        title: 'Password Required',
        message: 'Password is required for import',
      });
      return;
    }

    if (!importForm.data.backup_file) {
      setErrorModal({
        isOpen: true,
        title: 'File Required',
        message: 'Backup file is required for import',
      });
      return;
    }

    const importFormData = new FormData();
    importFormData.append('password', importForm.data.password);
    importFormData.append('backup_file', importForm.data.backup_file);

    fetch('/api/v1/admin/migration/import', {
      method: 'POST',
      headers: {
        'X-CSRF-Token': csrfToken || '',
      },
      credentials: 'include',
      body: importFormData,
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Import failed: ${response.status} ${response.statusText}`);
        }
        return response.json();
      })
      .then((data) => {
        setImportResult(data);
        importForm.reset();
        setShowEncryptionSecret(true);
      })
      .catch((error) => {
        console.error('Import failed:', error);
        setErrorModal({
          isOpen: true,
          title: 'Import Failed',
          message: `Import failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        });
      });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    importForm.setData('backup_file', file);
  };

  return (
    <>
      <Head title={title} />

      <div className="py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-6">
            <h1 className={cn('text-xl font-semibold', theme.text.strong)}>Data Migration</h1>
            <p className={cn('mt-2 text-sm', theme.text.muted)}>
              Export and import your Berth configuration data including users, servers, roles, and
              permissions.
            </p>
          </div>

          <FlashMessages />

          <Tabs
            tabs={[
              { id: 'export', label: 'Export Data' },
              { id: 'import', label: 'Import Data' },
            ]}
            activeTab={activeTab}
            onTabChange={(tab) => setActiveTab(tab as 'export' | 'import')}
          >
            {activeTab === 'export' && (
              <div className="space-y-6">
                <div className={cn('p-4 rounded-lg', theme.intent.info.surface)}>
                  <h3 className={cn('text-sm font-medium mb-2', theme.intent.info.textStrong)}>
                    Export Information
                  </h3>
                  <ul className={cn('text-sm space-y-1', theme.intent.info.textMuted)}>
                    <li>• All users, roles, and permissions with original IDs preserved</li>
                    <li>• Server configurations and access tokens with original IDs</li>
                    <li>• TOTP secrets for 2FA users with original IDs</li>
                    <li>• Role-based access control settings and relationships</li>
                    <li>• Encryption secret for reference (not imported)</li>
                    <li>• Auto-increment sequence information for proper reset</li>
                  </ul>
                </div>

                <form onSubmit={handleExport} className="space-y-4">
                  <div>
                    <label className={cn('block mb-2', theme.forms.label)}>Export Password</label>
                    <input
                      type="password"
                      value={exportForm.data.password}
                      onChange={(e) => exportForm.setData('password', e.target.value)}
                      placeholder="Enter a strong password to encrypt the export (min 12 chars)"
                      className={cn('w-full', theme.forms.input)}
                      minLength={12}
                      required
                    />
                    <p className={cn('mt-1 text-sm', theme.text.subtle)}>
                      This password will be required to decrypt the backup during import.
                    </p>
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={exportProcessing}
                      className={cn(theme.buttons.primary, 'disabled:opacity-50')}
                    >
                      {exportProcessing ? 'Exporting...' : 'Export Data'}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {activeTab === 'import' && (
              <div className="space-y-6">
                <div className={cn('p-4 rounded-lg', theme.intent.warning.surface)}>
                  <h3 className={cn('text-sm font-medium mb-2', theme.intent.warning.textStrong)}>
                    ⚠️ Import Warning
                  </h3>
                  <ul className={cn('text-sm space-y-1', theme.intent.warning.textMuted)}>
                    <li>• This will COMPLETELY REPLACE ALL existing data</li>
                    <li>
                      • All users, roles, permissions, servers, and TOTP secrets will be replaced
                    </li>
                    <li>• Original IDs and relationships will be preserved</li>
                    <li>• Auto-increment sequences will be properly reset</li>
                    <li>• Ensure you have a backup of current data</li>
                    <li>• Server agents must be reconfigured after import</li>
                    <li>• You will need to update your .env file with the encryption secret</li>
                  </ul>
                </div>

                <form onSubmit={handleImport} className="space-y-4">
                  <div>
                    <label className={cn('block mb-2', theme.forms.label)}>Backup File</label>
                    <input
                      type="file"
                      onChange={handleFileChange}
                      accept=".json"
                      className={cn(
                        'block w-full text-sm',
                        theme.text.subtle,
                        'file:mr-4 file:py-2 file:px-4',
                        'file:rounded-full file:border-0',
                        'file:text-sm file:font-semibold',
                        theme.intent.info.surface,
                        theme.intent.info.textStrong,
                        'hover:file:bg-blue-100 dark:hover:file:bg-blue-900/40'
                      )}
                      required
                    />
                  </div>

                  <div>
                    <label className={cn('block mb-2', theme.forms.label)}>
                      Decryption Password
                    </label>
                    <input
                      type="password"
                      value={importForm.data.password}
                      onChange={(e) => importForm.setData('password', e.target.value)}
                      placeholder="Enter the password used during export"
                      className={cn('w-full', theme.forms.input)}
                      required
                    />
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={importForm.processing}
                      className={cn(theme.buttons.danger, 'disabled:opacity-50')}
                    >
                      {importForm.processing ? 'Importing...' : 'Import Data'}
                    </button>
                  </div>
                </form>
              </div>
            )}
          </Tabs>

          {/* Error Modal */}
          <Modal
            isOpen={errorModal.isOpen}
            onClose={() => setErrorModal({ isOpen: false, title: '', message: '' })}
            title={errorModal.title}
            size="sm"
            variant="danger"
            footer={
              <div className="flex justify-end">
                <button
                  onClick={() => setErrorModal({ isOpen: false, title: '', message: '' })}
                  className={theme.buttons.primary}
                >
                  OK
                </button>
              </div>
            }
          >
            <p className={cn(theme.text.standard)}>{errorModal.message}</p>
          </Modal>

          {/* Import Result Modal */}
          <Modal
            isOpen={!!(importResult && showEncryptionSecret)}
            onClose={() => {
              setShowEncryptionSecret(false);
              setImportResult(null);
            }}
            title="Import Completed Successfully"
            size="md"
            footer={
              <div className="flex justify-end">
                <button
                  onClick={() => {
                    setShowEncryptionSecret(false);
                    setImportResult(null);
                  }}
                  className={theme.buttons.primary}
                >
                  Close
                </button>
              </div>
            }
          >
            {importResult && (
              <div className="space-y-4">
                <div className={cn('p-4 rounded-lg', theme.intent.success.surface)}>
                  <h4 className={cn('font-medium mb-2', theme.intent.success.textStrong)}>
                    Import Summary
                  </h4>
                  <ul className={cn('text-sm space-y-1', theme.intent.success.textMuted)}>
                    <li>• {importResult.summary.users_imported} users imported</li>
                    <li>• {importResult.summary.roles_imported} roles imported</li>
                    <li>• {importResult.summary.servers_imported} servers imported</li>
                    <li>• {importResult.summary.permissions_imported} permissions imported</li>
                    <li>• {importResult.summary.totp_secrets_imported} TOTP secrets imported</li>
                  </ul>
                  <p className={cn('text-sm mt-2', theme.intent.success.textMuted)}>
                    All data has been completely replaced with imported configuration. Original IDs
                    and relationships have been preserved, and auto-increment sequences have been
                    properly reset for future data creation.
                  </p>
                </div>

                <div className={cn('p-4 rounded-lg', theme.intent.warning.surface)}>
                  <h4 className={cn('font-medium mb-2', theme.intent.warning.textStrong)}>
                    Required: Update Encryption Secret
                  </h4>
                  <p className={cn('text-sm mb-2', theme.intent.warning.textMuted)}>
                    Add this to your .env file:
                  </p>
                  <div
                    className={cn('p-2 rounded font-mono text-xs break-all', theme.surface.code)}
                  >
                    ENCRYPTION_SECRET={importResult.encryption_secret}
                  </div>
                  <p className={cn('text-sm mt-2', theme.intent.warning.textMuted)}>
                    Restart the application after updating your .env file.
                  </p>
                </div>
              </div>
            )}
          </Modal>
        </div>
      </div>
    </>
  );
}
