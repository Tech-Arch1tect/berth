import React, { useCallback, useMemo } from 'react';
import { FileManagerLayout } from './layout';
import { FileTree, FileDetailsPanel } from './tree';
import { TabBar } from './tabs';
import { EditorArea } from './editor';
import { FileContextMenu, FolderContextMenu, TabContextMenu, TreeContextMenu } from './menus';
import { StatusBar } from './StatusBar';
import { FileManagerToolbar } from './FileManagerToolbar';
import { FileOperationModal } from './modals/FileOperationModal';
import { FileUploadModal } from './modals/FileUploadModal';
import { ChmodModal } from './modals/ChmodModal';
import { ChownModal } from './modals/ChownModal';
import { ArchiveOperationModal } from './modals/ArchiveOperationModal';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { EmptyState } from '../common/EmptyState';
import { useFileManager } from '../../hooks/useFileManager';
import { useNestedFileTree } from '../../hooks/useNestedFileTree';
import { useTabs } from '../../hooks/useTabs';
import { useContextMenu } from '../../hooks/useContextMenu';
import { cn } from '../../utils/cn';
import { ExclamationTriangleIcon, LockClosedIcon } from '@heroicons/react/24/outline';
import { useServerStack } from '../../contexts/ServerStackContext';
import type { GetApiV1ServersServeridStacksStacknameFiles200EntriesItem } from '../../api/generated/models';
import { OpenTab } from '../../types/files';
import { showToast } from '../../utils/toast';
import { useFiles } from '../../hooks/useFiles';
import { useFileMutations } from '../../hooks/useFileQueries';

interface FileManagerProps {
  canRead: boolean;
  canWrite: boolean;
}

export const FileManager: React.FC<FileManagerProps> = ({ canRead, canWrite }) => {
  const { serverId, stackName } = useServerStack();

  const fm = useFileManager({ serverid: serverId, stackname: stackName, canRead, canWrite });

  const filesApi = useFiles({
    serverid: serverId,
    stackname: stackName,
    onError: (error) => showToast.error(error),
  });

  const {
    tabs,
    activeTabId,
    openTab,
    refreshTab,
    closeTab,
    setActiveTab,
    updateTabContent,
    markTabClean,
    closeOtherTabs,
    closeAllTabs,
  } = useTabs();

  const fileMenu = useContextMenu<GetApiV1ServersServeridStacksStacknameFiles200EntriesItem>();
  const folderMenu = useContextMenu<GetApiV1ServersServeridStacksStacknameFiles200EntriesItem>();
  const tabMenu = useContextMenu<OpenTab>();
  const treeMenu = useContextMenu<null>();

  const [isSaving, setIsSaving] = React.useState(false);

  const activeTab = useMemo(
    () => tabs.find((t) => t.id === activeTabId) || null,
    [tabs, activeTabId]
  );

  const handleOpenFile = useCallback(
    async (entry: GetApiV1ServersServeridStacksStacknameFiles200EntriesItem) => {
      const existingTab = tabs.find((t) => t.path === entry.path);

      try {
        const fileContent = await filesApi.readFile(entry.path);

        if (existingTab) {
          refreshTab(fileContent);
          setActiveTab(existingTab.id);
        } else {
          openTab(fileContent);
        }
      } catch (error) {
        console.error('Failed to open file:', error);
        showToast.error('Failed to open file');
      }
    },
    [tabs, setActiveTab, openTab, refreshTab, filesApi]
  );

  const fileTree = useNestedFileTree({
    serverid: serverId,
    stackname: stackName,
    onFileSelect: handleOpenFile,
    enabled: canRead,
  });

  const mutations = useFileMutations({ serverid: serverId, stackname: stackName });

  const handleMove = useCallback(
    async (sourcePath: string, targetDirectory: string) => {
      const fileName = sourcePath.split('/').pop() || '';
      const newPath = targetDirectory ? `${targetDirectory}/${fileName}` : fileName;

      try {
        await mutations.renameFile.mutateAsync({
          old_path: sourcePath,
          new_path: newPath,
        });
        showToast.success(`Moved ${fileName} to ${targetDirectory || 'root'}`);
      } catch (error) {
        console.error('Failed to move file:', error);
        showToast.error('Failed to move file');
      }
    },
    [mutations]
  );

  const handleFileContextMenu = useCallback(
    (e: React.MouseEvent, entry: GetApiV1ServersServeridStacksStacknameFiles200EntriesItem) => {
      if (entry.is_directory) {
        folderMenu.open(e, entry);
      } else {
        fileMenu.open(e, entry);
      }
    },
    [fileMenu, folderMenu]
  );

  const handleTabContextMenu = useCallback(
    (e: React.MouseEvent, tab: OpenTab) => {
      tabMenu.open(e, tab);
    },
    [tabMenu]
  );

  const handleTreeBackgroundContextMenu = useCallback(
    (e: React.MouseEvent) => {
      treeMenu.open(e, null);
    },
    [treeMenu]
  );

  const handleContentChange = useCallback(
    (content: string) => {
      if (activeTabId) {
        updateTabContent(activeTabId, content);
      }
    },
    [activeTabId, updateTabContent]
  );

  const handleSave = useCallback(async () => {
    if (!activeTab || !activeTab.isDirty) return;

    setIsSaving(true);
    try {
      await fm.handleFileSave({
        path: activeTab.path,
        content: activeTab.content,
      });
      markTabClean(activeTab.id);
      showToast.success('File saved successfully');
    } catch (error) {
      console.error('Failed to save file:', error);
      showToast.error('Failed to save file');
    } finally {
      setIsSaving(false);
    }
  }, [activeTab, fm, markTabClean]);

  const handleCloseTab = useCallback(
    (tabId: string) => {
      const tab = tabs.find((t) => t.id === tabId);
      if (tab?.isDirty) {
        if (!window.confirm(`${tab.name} has unsaved changes. Close anyway?`)) {
          return;
        }
      }
      closeTab(tabId);
    },
    [tabs, closeTab]
  );

  const handleFileOpen = useCallback(
    (file: GetApiV1ServersServeridStacksStacknameFiles200EntriesItem) => {
      handleOpenFile(file);
    },
    [handleOpenFile]
  );

  const handleFileRename = useCallback(
    (file: GetApiV1ServersServeridStacksStacknameFiles200EntriesItem) => {
      fm.handleFileOperation('rename', file);
    },
    [fm]
  );

  const handleFileCopy = useCallback(
    (file: GetApiV1ServersServeridStacksStacknameFiles200EntriesItem) => {
      fm.handleFileOperation('copy', file);
    },
    [fm]
  );

  const handleFileCopyPath = useCallback(
    (file: GetApiV1ServersServeridStacksStacknameFiles200EntriesItem) => {
      navigator.clipboard.writeText(file.path);
      showToast.success('Path copied to clipboard');
    },
    []
  );

  const handleFileDownload = useCallback(
    (file: GetApiV1ServersServeridStacksStacknameFiles200EntriesItem) => {
      fm.handleDownload(file);
    },
    [fm]
  );

  const handleFileChmod = useCallback(
    (file: GetApiV1ServersServeridStacksStacknameFiles200EntriesItem) => {
      fm.handleFileOperation('chmod', file);
    },
    [fm]
  );

  const handleFileChown = useCallback(
    (file: GetApiV1ServersServeridStacksStacknameFiles200EntriesItem) => {
      fm.handleFileOperation('chown', file);
    },
    [fm]
  );

  const handleFileDelete = useCallback(
    (file: GetApiV1ServersServeridStacksStacknameFiles200EntriesItem) => {
      fm.handleFileOperation('delete', file);
    },
    [fm]
  );

  const handleNewFile = useCallback(
    (folder: GetApiV1ServersServeridStacksStacknameFiles200EntriesItem) => {
      fm.handleFileOperation('create', undefined, folder.path);
    },
    [fm]
  );

  const handleNewFolder = useCallback(
    (folder: GetApiV1ServersServeridStacksStacknameFiles200EntriesItem) => {
      fm.handleFileOperation('mkdir', undefined, folder.path);
    },
    [fm]
  );

  const handleUpload = useCallback(
    (folder: GetApiV1ServersServeridStacksStacknameFiles200EntriesItem) => {
      fm.handleFileOperation('upload', undefined, folder.path);
    },
    [fm]
  );

  const handleNewFileInRoot = useCallback(() => {
    fm.handleFileOperation('create', undefined, '');
  }, [fm]);

  const handleNewFolderInRoot = useCallback(() => {
    fm.handleFileOperation('mkdir', undefined, '');
  }, [fm]);

  const handleUploadToRoot = useCallback(() => {
    fm.handleFileOperation('upload', undefined, '');
  }, [fm]);

  const handleCreateArchive = useCallback(
    (entry: GetApiV1ServersServeridStacksStacknameFiles200EntriesItem) => {
      fm.handleFileOperation('create_archive', entry, entry.path);
    },
    [fm]
  );

  const handleCreateArchiveOfRoot = useCallback(() => {
    fm.handleFileOperation(
      'create_archive',
      {
        name: '.',
        path: '',
        is_directory: true,
        size: 0,
        mode: '',
        mod_time: '',
        owner: '',
        group: '',
      },
      ''
    );
  }, [fm]);

  const handleExtractArchive = useCallback(
    (file: GetApiV1ServersServeridStacksStacknameFiles200EntriesItem) => {
      fm.handleFileOperation('extract_archive', file);
    },
    [fm]
  );

  const handleTabClose = useCallback(
    (tab: OpenTab) => {
      handleCloseTab(tab.id);
    },
    [handleCloseTab]
  );

  const handleTabCloseOthers = useCallback(
    (tab: OpenTab) => {
      const dirtyTabs = tabs.filter((t) => t.id !== tab.id && t.isDirty);
      if (dirtyTabs.length > 0) {
        if (!window.confirm(`${dirtyTabs.length} file(s) have unsaved changes. Close anyway?`)) {
          return;
        }
      }
      closeOtherTabs(tab.id);
    },
    [tabs, closeOtherTabs]
  );

  const handleTabCloseAll = useCallback(() => {
    const dirtyTabs = tabs.filter((t) => t.isDirty);
    if (dirtyTabs.length > 0) {
      if (!window.confirm(`${dirtyTabs.length} file(s) have unsaved changes. Close anyway?`)) {
        return;
      }
    }
    closeAllTabs();
  }, [tabs, closeAllTabs]);

  const handleTabCopyPath = useCallback((tab: OpenTab) => {
    navigator.clipboard.writeText(tab.path);
    showToast.success('Path copied to clipboard');
  }, []);

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

  const sidebarContent = (
    <div className="h-full flex flex-col">
      <div className="flex-1 overflow-auto">
        {fileTree.rootLoading && fileTree.rootEntries.length === 0 ? (
          <LoadingSpinner size="sm" text="Loading..." />
        ) : fileTree.rootError ? (
          <EmptyState
            icon={ExclamationTriangleIcon}
            title="Failed to load"
            description={fileTree.rootError.message || 'Could not load files'}
            variant="error"
            size="sm"
            action={{
              label: 'Retry',
              onClick: fileTree.refetchAll,
            }}
          />
        ) : (
          <FileTree
            entries={fileTree.rootEntries}
            rootPath={fileTree.rootPath}
            onSelect={fileTree.selectEntry}
            onContextMenu={handleFileContextMenu}
            onBackgroundContextMenu={handleTreeBackgroundContextMenu}
            onMove={handleMove}
            canWrite={canWrite}
            isExpanded={fileTree.isExpanded}
            isSelected={fileTree.isSelected}
            isLoading={fileTree.isLoading}
            getChildren={fileTree.getChildren}
          />
        )}
      </div>
      <FileDetailsPanel entry={fileTree.selectedEntry} />
    </div>
  );

  const editorContent = (
    <div className="h-full flex flex-col">
      <TabBar
        tabs={tabs}
        activeTabId={activeTabId}
        onSelectTab={setActiveTab}
        onCloseTab={handleCloseTab}
        onContextMenu={handleTabContextMenu}
      />

      <EditorArea
        activeTab={activeTab}
        canWrite={canWrite}
        isSaving={isSaving}
        onSave={handleSave}
        onContentChange={handleContentChange}
      />
    </div>
  );

  const toolbar = (
    <FileManagerToolbar
      canRead={canRead}
      canWrite={canWrite}
      onCreateFolder={() => fm.handleFileOperation('mkdir', undefined, '')}
      onCreateFile={() => fm.handleFileOperation('create', undefined, '')}
      onUpload={() => fm.handleFileOperation('upload', undefined, '')}
    />
  );

  return (
    <div className={cn('h-full flex flex-col bg-white dark:bg-zinc-900')}>
      <FileManagerLayout
        toolbar={toolbar}
        sidebar={sidebarContent}
        editor={editorContent}
        statusBar={<StatusBar activeTab={activeTab} canWrite={canWrite} />}
      />

      <FileContextMenu
        isOpen={fileMenu.isOpen}
        position={fileMenu.position}
        file={fileMenu.data}
        canWrite={canWrite}
        onClose={fileMenu.close}
        onOpen={handleFileOpen}
        onRename={handleFileRename}
        onCopy={handleFileCopy}
        onCopyPath={handleFileCopyPath}
        onDownload={handleFileDownload}
        onChmod={handleFileChmod}
        onChown={handleFileChown}
        onExtractArchive={handleExtractArchive}
        onDelete={handleFileDelete}
      />

      <FolderContextMenu
        isOpen={folderMenu.isOpen}
        position={folderMenu.position}
        folder={folderMenu.data}
        canWrite={canWrite}
        onClose={folderMenu.close}
        onNewFile={handleNewFile}
        onNewFolder={handleNewFolder}
        onUpload={handleUpload}
        onRename={handleFileRename}
        onChmod={handleFileChmod}
        onChown={handleFileChown}
        onCreateArchive={handleCreateArchive}
        onDelete={handleFileDelete}
      />

      <TabContextMenu
        isOpen={tabMenu.isOpen}
        position={tabMenu.position}
        tab={tabMenu.data}
        onClose={tabMenu.close}
        onCloseTab={handleTabClose}
        onCloseOthers={handleTabCloseOthers}
        onCloseAll={handleTabCloseAll}
        onCopyPath={handleTabCopyPath}
      />

      <TreeContextMenu
        isOpen={treeMenu.isOpen}
        position={treeMenu.position}
        canWrite={canWrite}
        onClose={treeMenu.close}
        onNewFile={handleNewFileInRoot}
        onNewFolder={handleNewFolderInRoot}
        onUpload={handleUploadToRoot}
        onCreateArchive={handleCreateArchiveOfRoot}
      />

      <FileOperationModal
        isOpen={fm.isOperationModalOpen}
        operation={fm.currentOperation}
        selectedFile={fm.selectedFile}
        targetDirectory={fm.targetDirectory}
        onClose={fm.closeOperationModal}
        onConfirm={fm.handleOperationConfirm}
        getDirectoryStats={fm.getDirectoryStats}
      />

      <FileUploadModal
        isOpen={fm.isUploadModalOpen}
        targetDirectory={fm.targetDirectory}
        onClose={fm.closeUploadModal}
        onUpload={fm.handleFileUpload}
        getDirectoryStats={fm.getDirectoryStats}
      />

      <ChmodModal
        isOpen={fm.isChmodModalOpen}
        entry={fm.selectedFile}
        loading={fm.loading}
        onClose={fm.closeChmodModal}
        onConfirm={fm.handleChmodConfirm}
      />

      <ChownModal
        isOpen={fm.isChownModalOpen}
        entry={fm.selectedFile}
        loading={fm.loading}
        onClose={fm.closeChownModal}
        onConfirm={fm.handleChownConfirm}
      />

      <ArchiveOperationModal
        isOpen={fm.isArchiveModalOpen}
        operation={fm.archiveOperation}
        selectedFile={fm.selectedFile || undefined}
        onClose={fm.closeArchiveModal}
        onCreateArchive={fm.handleCreateArchive}
        onExtractArchive={fm.handleExtractArchive}
      />
    </div>
  );
};
