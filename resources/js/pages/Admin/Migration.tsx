import React, { useState } from 'react';
import { Head, useForm, usePage } from '@inertiajs/react';
import Layout from '../../components/Layout';
import FlashMessages from '../../components/FlashMessages';

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
      alert('Password is required for export');
      return;
    }

    if (exportForm.data.password.length < 12) {
      alert('Password must be at least 12 characters long');
      return;
    }

    try {
      setExportProcessing(true);

      const response = await fetch('/admin/migration/export', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken || '',
        },
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
      alert(`Export failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setExportProcessing(false);
    }
  };

  const handleImport = (e: React.FormEvent) => {
    e.preventDefault();

    if (!importForm.data.password) {
      alert('Password is required for import');
      return;
    }

    if (!importForm.data.backup_file) {
      alert('Backup file is required for import');
      return;
    }

    const importFormData = new FormData();
    importFormData.append('password', importForm.data.password);
    importFormData.append('backup_file', importForm.data.backup_file);

    fetch('/admin/migration/import', {
      method: 'POST',
      headers: {
        'X-CSRF-Token': csrfToken || '',
      },
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
        alert(`Import failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    importForm.setData('backup_file', file);
  };

  return (
    <Layout>
      <Head title={title} />

      <div className="py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-white dark:bg-gray-800 shadow rounded-lg">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
                Data Migration
              </h1>
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                Export and import your Berth configuration data including users, servers, roles, and
                permissions.
              </p>
            </div>

            <FlashMessages />

            <div className="p-6">
              {/* Tab Navigation */}
              <div className="border-b border-gray-200 dark:border-gray-700 mb-6">
                <nav className="-mb-px flex space-x-8">
                  <button
                    onClick={() => setActiveTab('export')}
                    className={`py-2 px-1 border-b-2 font-medium text-sm ${
                      activeTab === 'export'
                        ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                        : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                    }`}
                  >
                    Export Data
                  </button>
                  <button
                    onClick={() => setActiveTab('import')}
                    className={`py-2 px-1 border-b-2 font-medium text-sm ${
                      activeTab === 'import'
                        ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                        : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                    }`}
                  >
                    Import Data
                  </button>
                </nav>
              </div>

              {/* Export Tab */}
              {activeTab === 'export' && (
                <div className="space-y-6">
                  <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                    <h3 className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-2">
                      Export Information
                    </h3>
                    <ul className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
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
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Export Password
                      </label>
                      <input
                        type="password"
                        value={exportForm.data.password}
                        onChange={(e) => exportForm.setData('password', e.target.value)}
                        placeholder="Enter a strong password to encrypt the export (min 12 chars)"
                        className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white shadow-sm focus:border-blue-500 focus:ring-blue-500"
                        minLength={12}
                        required
                      />
                      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        This password will be required to decrypt the backup during import.
                      </p>
                    </div>

                    <div className="flex justify-end">
                      <button
                        type="submit"
                        disabled={exportProcessing}
                        className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white px-4 py-2 rounded-md text-sm font-medium"
                      >
                        {exportProcessing ? 'Exporting...' : 'Export Data'}
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* Import Tab */}
              {activeTab === 'import' && (
                <div className="space-y-6">
                  <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg">
                    <h3 className="text-sm font-medium text-yellow-800 dark:text-yellow-200 mb-2">
                      ⚠️ Import Warning
                    </h3>
                    <ul className="text-sm text-yellow-700 dark:text-yellow-300 space-y-1">
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
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Backup File
                      </label>
                      <input
                        type="file"
                        onChange={handleFileChange}
                        accept=".json"
                        className="block w-full text-sm text-gray-500 dark:text-gray-400
                          file:mr-4 file:py-2 file:px-4
                          file:rounded-full file:border-0
                          file:text-sm file:font-semibold
                          file:bg-blue-50 file:text-blue-700
                          hover:file:bg-blue-100
                          dark:file:bg-blue-900 dark:file:text-blue-200"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Decryption Password
                      </label>
                      <input
                        type="password"
                        value={importForm.data.password}
                        onChange={(e) => importForm.setData('password', e.target.value)}
                        placeholder="Enter the password used during export"
                        className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white shadow-sm focus:border-blue-500 focus:ring-blue-500"
                        required
                      />
                    </div>

                    <div className="flex justify-end">
                      <button
                        type="submit"
                        disabled={importForm.processing}
                        className="bg-red-600 hover:bg-red-700 disabled:bg-red-300 text-white px-4 py-2 rounded-md text-sm font-medium"
                      >
                        {importForm.processing ? 'Importing...' : 'Import Data'}
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* Import Result Modal */}
              {importResult && showEncryptionSecret && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                  <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-lg w-full mx-4">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                      Import Completed Successfully
                    </h3>

                    <div className="space-y-4">
                      <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
                        <h4 className="font-medium text-green-800 dark:text-green-200 mb-2">
                          Import Summary
                        </h4>
                        <ul className="text-sm text-green-700 dark:text-green-300 space-y-1">
                          <li>• {importResult.summary.users_imported} users imported</li>
                          <li>• {importResult.summary.roles_imported} roles imported</li>
                          <li>• {importResult.summary.servers_imported} servers imported</li>
                          <li>
                            • {importResult.summary.permissions_imported} permissions imported
                          </li>
                          <li>
                            • {importResult.summary.totp_secrets_imported} TOTP secrets imported
                          </li>
                        </ul>
                        <p className="text-sm text-green-700 dark:text-green-300 mt-2">
                          All data has been completely replaced with imported configuration.
                          Original IDs and relationships have been preserved, and auto-increment
                          sequences have been properly reset for future data creation.
                        </p>
                      </div>

                      <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg">
                        <h4 className="font-medium text-yellow-800 dark:text-yellow-200 mb-2">
                          Required: Update Encryption Secret
                        </h4>
                        <p className="text-sm text-yellow-700 dark:text-yellow-300 mb-2">
                          Add this to your .env file:
                        </p>
                        <div className="bg-gray-100 dark:bg-gray-700 p-2 rounded font-mono text-xs break-all">
                          ENCRYPTION_SECRET={importResult.encryption_secret}
                        </div>
                        <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-2">
                          Restart the application after updating your .env file.
                        </p>
                      </div>
                    </div>

                    <div className="flex justify-end mt-6">
                      <button
                        onClick={() => {
                          setShowEncryptionSecret(false);
                          setImportResult(null);
                        }}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium"
                      >
                        Close
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
