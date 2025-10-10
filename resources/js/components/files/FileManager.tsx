import React from 'react';
import { FileList } from './FileList';
import { FileEditor } from './FileEditor';
import { FileManagerToolbar } from './FileManagerToolbar';
import { FileOperationModal } from './modals/FileOperationModal';
import { FileUploadModal } from './modals/FileUploadModal';
import { ChmodModal } from './modals/ChmodModal';
import { ChownModal } from './modals/ChownModal';
import { ArchiveOperationModal } from './modals/ArchiveOperationModal';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { EmptyState } from '../common/EmptyState';
import { useFileManager } from '../../hooks/useFileManager';
import { cn } from '../../utils/cn';
import { theme } from '../../theme';
import { ExclamationTriangleIcon, LockClosedIcon } from '@heroicons/react/24/outline';
import { useServerStack } from '../../contexts/ServerStackContext';

interface FileManagerProps {
  canRead: boolean;
  canWrite: boolean;
}

export const FileManager: React.FC<FileManagerProps> = ({ canRead, canWrite }) => {
  const { serverId, stackName } = useServerStack();

  const fm = useFileManager({ serverid: serverId, stackname: stackName, canRead, canWrite });

  if (!canRead) {
    return (
      <EmptyState
        icon={LockClosedIcon}
        title="Access Denied"
        description="You don't have permission to access files in this stack."
        variant="error"
        size="md"
      />
    );
  }

  return (
    <div className={cn('h-full flex flex-col', theme.surface.subtle)}>
      {/* Toolbar */}
      <FileManagerToolbar
        currentPath={fm.currentPath}
        canRead={canRead}
        canWrite={canWrite}
        onCreateFolder={() => fm.handleFileOperation('mkdir')}
        onCreateFile={() => fm.handleFileOperation('create')}
        onUpload={() => fm.handleFileOperation('upload')}
      />

      {/* Content Area */}
      <div className="flex-1 overflow-hidden">
        {fm.loading && !fm.directoryListing ? (
          <LoadingSpinner size="lg" text="Loading files..." fullScreen />
        ) : fm.directoryListing ? (
          <div className="h-full overflow-hidden">
            <FileList
              entries={fm.directoryListing.entries || []}
              onNavigate={fm.handleNavigate}
              onFileSelect={fm.handleFileSelect}
              onFileOperation={fm.handleFileOperation}
              onDownload={fm.handleDownload}
              currentPath={fm.currentPath}
              canWrite={canWrite}
            />
          </div>
        ) : (
          <EmptyState
            icon={ExclamationTriangleIcon}
            title="Failed to load directory"
            description="There was an error loading the file listing."
            variant="error"
            size="md"
            action={{
              label: 'Try Again',
              onClick: () => fm.loadDirectory(fm.currentPath),
            }}
          />
        )}
      </div>

      {/* File Editor Modal */}
      <FileEditor
        file={fm.fileContent}
        isOpen={fm.isEditorOpen}
        onClose={fm.closeEditor}
        onSave={fm.handleFileSave}
        canWrite={canWrite}
      />

      {/* File Operation Modal */}
      <FileOperationModal
        isOpen={fm.isOperationModalOpen}
        operation={fm.currentOperation}
        selectedFile={fm.selectedFile}
        currentPath={fm.currentPath}
        onClose={fm.closeOperationModal}
        onConfirm={fm.handleOperationConfirm}
        getDirectoryStats={fm.getDirectoryStats}
      />

      {/* File Upload Modal */}
      <FileUploadModal
        isOpen={fm.isUploadModalOpen}
        currentPath={fm.currentPath}
        onClose={fm.closeUploadModal}
        onUpload={fm.handleFileUpload}
        getDirectoryStats={fm.getDirectoryStats}
      />

      {/* Chmod Modal */}
      <ChmodModal
        isOpen={fm.isChmodModalOpen}
        entry={fm.selectedFile}
        loading={fm.loading}
        onClose={fm.closeChmodModal}
        onConfirm={fm.handleChmodConfirm}
      />

      {/* Chown Modal */}
      <ChownModal
        isOpen={fm.isChownModalOpen}
        entry={fm.selectedFile}
        loading={fm.loading}
        onClose={fm.closeChownModal}
        onConfirm={fm.handleChownConfirm}
      />

      {/* Archive Operation Modal */}
      <ArchiveOperationModal
        isOpen={fm.isArchiveModalOpen}
        operation={fm.archiveOperation}
        currentPath={fm.currentPath}
        selectedFile={fm.selectedFile || undefined}
        onClose={fm.closeArchiveModal}
        onCreateArchive={fm.handleCreateArchive}
        onExtractArchive={fm.handleExtractArchive}
      />
    </div>
  );
};
