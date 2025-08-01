import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useDeleteFile, useRenameFile, useStackFile, useUpdateFile } from '@/hooks/queries/use-file-manager';
import { getFileTypeLabel, isEditable } from '@/utils/file-icons';
import { AlertTriangle, Copy, Download, Edit, Edit3, Eye, File, Save, Trash2, X } from 'lucide-react';
import { useEffect, useState } from 'react';

interface FileViewerProps {
    serverId: number;
    stackName: string;
    filePath: string;
    fileName: string;
    isOpen: boolean;
    onClose: () => void;
    canWrite?: boolean;
    onFileDeleted?: () => void;
    onFileRenamed?: (oldName: string, newName: string) => void;
}

export default function FileViewer({
    serverId,
    stackName,
    filePath,
    fileName,
    isOpen,
    onClose,
    canWrite = false,
    onFileDeleted,
    onFileRenamed,
}: FileViewerProps) {
    const [isEditing, setIsEditing] = useState(false);
    const [editContent, setEditContent] = useState('');
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [showRenameDialog, setShowRenameDialog] = useState(false);
    const [newFileName, setNewFileName] = useState('');
    const [currentFileName, setCurrentFileName] = useState(fileName);
    const [error, setError] = useState<string | null>(null);

    const { data: fileData, isLoading, error: queryError, refetch: refetchFile } = useStackFile(serverId, stackName, filePath, isOpen && !!filePath);

    const updateFileMutation = useUpdateFile(serverId, stackName);
    const renameFileMutation = useRenameFile(serverId, stackName);
    const deleteFileMutation = useDeleteFile(serverId, stackName);

    useEffect(() => {
        setCurrentFileName(fileName);
    }, [fileName]);

    const formatFileSize = (bytes: number): string => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    };

    const copyToClipboard = async () => {
        if (fileData?.content) {
            try {
                await navigator.clipboard.writeText(fileData.content);
            } catch (err) {
                console.error('Failed to copy to clipboard:', err);
            }
        }
    };

    const downloadFile = () => {
        if (fileData?.content) {
            if (fileData.isBinary && fileData.isBase64) {
                const byteCharacters = atob(fileData.content);
                const byteNumbers = new Array(byteCharacters.length);
                for (let i = 0; i < byteCharacters.length; i++) {
                    byteNumbers[i] = byteCharacters.charCodeAt(i);
                }
                const byteArray = new Uint8Array(byteNumbers);
                const blob = new Blob([byteArray], { type: fileData.mimeType || 'application/octet-stream' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = fileName;
                a.click();
                URL.revokeObjectURL(url);
            } else {
                const blob = new Blob([fileData.content], { type: fileData.mimeType || 'text/plain' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = fileName;
                a.click();
                URL.revokeObjectURL(url);
            }
        }
    };

    const startEditing = () => {
        if (fileData?.content) {
            setEditContent(fileData.content);
            setIsEditing(true);
        }
    };

    const cancelEditing = () => {
        setIsEditing(false);
        setEditContent('');
        setError(null);
    };

    const saveFile = async () => {
        if (!fileData) return;

        setError(null);

        try {
            await updateFileMutation.mutateAsync({
                path: filePath,
                content: editContent,
            });
            setIsEditing(false);
            setEditContent('');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to save file');
        }
    };

    const deleteFile = async () => {
        if (!fileData) return;

        setError(null);

        try {
            await deleteFileMutation.mutateAsync({
                path: filePath,
                isDir: false,
            });
            setShowDeleteConfirm(false);
            onClose();
            if (onFileDeleted) {
                onFileDeleted();
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to delete file');
            setShowDeleteConfirm(false);
        }
    };

    const openRenameDialog = () => {
        setNewFileName(currentFileName);
        setShowRenameDialog(true);
        setError(null);
    };

    const closeRenameDialog = () => {
        setShowRenameDialog(false);
        setNewFileName('');
        setError(null);
    };

    const renameFile = async () => {
        if (!newFileName.trim() || newFileName.trim() === currentFileName) {
            setError('Please enter a different name');
            return;
        }

        setError(null);

        try {
            await renameFileMutation.mutateAsync({
                path: filePath,
                newName: newFileName.trim(),
            });

            const oldName = currentFileName;
            setCurrentFileName(newFileName.trim());
            setShowRenameDialog(false);
            setNewFileName('');

            if (onFileRenamed) {
                onFileRenamed(oldName, newFileName.trim());
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to rename file');
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="flex max-h-[90vh] max-w-6xl flex-col">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <File size={20} />
                        {currentFileName}
                        {fileData && (
                            <Badge variant="outline" className="text-xs">
                                {formatFileSize(fileData.size)}
                            </Badge>
                        )}
                    </DialogTitle>
                    {fileData && (
                        <div className="mt-2 flex items-center gap-2">
                            {isEditing ? (
                                <>
                                    <Button variant="default" size="sm" onClick={saveFile} disabled={updateFileMutation.isPending}>
                                        <Save size={14} className="mr-1" />
                                        {updateFileMutation.isPending ? 'Saving...' : 'Save'}
                                    </Button>
                                    <Button variant="outline" size="sm" onClick={cancelEditing} disabled={updateFileMutation.isPending}>
                                        <X size={14} className="mr-1" />
                                        Cancel
                                    </Button>
                                </>
                            ) : (
                                <>
                                    {canWrite && (
                                        <>
                                            {!fileData.isBinary && isEditable(fileData.mimeType, fileData.isBinary) && (
                                                <Button variant="outline" size="sm" onClick={startEditing}>
                                                    <Edit size={14} className="mr-1" />
                                                    Edit
                                                </Button>
                                            )}
                                            <Button variant="outline" size="sm" onClick={openRenameDialog}>
                                                <Edit3 size={14} className="mr-1" />
                                                Rename
                                            </Button>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => setShowDeleteConfirm(true)}
                                                className="text-red-600 hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-950 dark:hover:text-red-300"
                                            >
                                                <Trash2 size={14} className="mr-1" />
                                                Delete
                                            </Button>
                                        </>
                                    )}
                                    <Button variant="outline" size="sm" onClick={copyToClipboard} disabled={!fileData.content}>
                                        <Copy size={14} className="mr-1" />
                                        Copy
                                    </Button>
                                    <Button variant="outline" size="sm" onClick={downloadFile}>
                                        <Download size={14} className="mr-1" />
                                        Download
                                    </Button>
                                </>
                            )}
                        </div>
                    )}
                </DialogHeader>

                <div className="flex-1 overflow-hidden">
                    {isLoading ? (
                        <div className="flex h-64 items-center justify-center">
                            <div className="text-center">
                                <Eye className="mx-auto mb-4 h-12 w-12 animate-pulse opacity-50" />
                                <p className="text-gray-500 dark:text-gray-400">Loading file...</p>
                            </div>
                        </div>
                    ) : error ? (
                        <div className="flex h-64 items-center justify-center">
                            <div className="text-center text-red-500 dark:text-red-400">
                                <File className="mx-auto mb-4 h-12 w-12 opacity-50" />
                                <p>{error}</p>
                                <Button onClick={() => refetchFile()} variant="outline" size="sm" className="mt-2">
                                    Retry
                                </Button>
                            </div>
                        </div>
                    ) : fileData ? (
                        <div className="h-full overflow-auto">
                            <div className="h-full">
                                <div className="border-b border-border bg-muted/30 px-4 py-2 text-sm text-muted-foreground">
                                    <span>Path: {fileData.path}</span>
                                    <span className="ml-4">Size: {formatFileSize(fileData.size)}</span>
                                    {isEditing && <span className="ml-4 text-yellow-600 dark:text-yellow-400">Editing</span>}
                                </div>
                                {isEditing ? (
                                    <div className="h-full overflow-hidden rounded-lg border border-border">
                                        <div className="border-b border-border bg-muted/50 px-3 py-2">
                                            <div className="flex items-center gap-2">
                                                <div className="h-2 w-2 rounded-full bg-green-500"></div>
                                                <div className="h-2 w-2 rounded-full bg-yellow-500"></div>
                                                <div className="h-2 w-2 rounded-full bg-red-500"></div>
                                                <span className="ml-2 font-mono text-xs text-muted-foreground">{currentFileName} (editing)</span>
                                            </div>
                                        </div>
                                        <textarea
                                            value={editContent}
                                            onChange={(e) => setEditContent(e.target.value)}
                                            className="w-full resize-none border-0 bg-card p-4 font-mono text-sm text-foreground outline-none focus:ring-0"
                                            style={{ minHeight: '400px' }}
                                            placeholder="Enter file content..."
                                        />
                                    </div>
                                ) : (
                                    <div className="h-full overflow-hidden rounded-lg border border-border">
                                        <div className="border-b border-border bg-muted/50 px-3 py-2">
                                            <div className="flex items-center gap-2">
                                                <div className="h-2 w-2 rounded-full bg-green-500"></div>
                                                <div className="h-2 w-2 rounded-full bg-yellow-500"></div>
                                                <div className="h-2 w-2 rounded-full bg-red-500"></div>
                                                <span className="ml-2 font-mono text-xs text-muted-foreground">{currentFileName}</span>
                                            </div>
                                        </div>
                                        <div className="overflow-auto bg-card p-4" style={{ minHeight: '400px' }}>
                                            {fileData.isBinary ? (
                                                <div className="flex h-full flex-col items-center justify-center py-8 text-center">
                                                    <AlertTriangle className="mb-4 h-16 w-16 text-yellow-500" />
                                                    <h3 className="mb-2 text-lg font-medium">Binary File</h3>
                                                    <p className="mb-4 text-muted-foreground">
                                                        This file contains binary data and cannot be displayed as text.
                                                    </p>
                                                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                                        <span>Type: {getFileTypeLabel(fileName, fileData.mimeType, fileData.isBinary)}</span>
                                                        <span>Size: {formatFileSize(fileData.size)}</span>
                                                    </div>
                                                    <Button onClick={downloadFile} className="mt-4" variant="outline">
                                                        <Download size={16} className="mr-2" />
                                                        Download File
                                                    </Button>
                                                </div>
                                            ) : fileData.mimeType?.startsWith('image/') ? (
                                                <div className="flex h-full items-center justify-center">
                                                    <img
                                                        src={`data:${fileData.mimeType};base64,${fileData.content}`}
                                                        alt={currentFileName}
                                                        className="max-h-full max-w-full object-contain"
                                                        style={{ maxHeight: '400px' }}
                                                    />
                                                </div>
                                            ) : (
                                                <pre className="font-mono text-sm leading-relaxed whitespace-pre-wrap text-foreground">
                                                    {fileData.content}
                                                </pre>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="flex h-64 items-center justify-center">
                            <div className="text-center text-muted-foreground">
                                <Eye className="mx-auto mb-4 h-12 w-12 opacity-50" />
                                <p>Click to view file content</p>
                            </div>
                        </div>
                    )}
                </div>
            </DialogContent>

            <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Trash2 size={20} className="text-red-500" />
                            Delete File
                        </DialogTitle>
                        <DialogDescription>
                            Are you sure you want to delete <strong>{currentFileName}</strong>? This action cannot be undone.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowDeleteConfirm(false)} disabled={deleteFileMutation.isPending}>
                            Cancel
                        </Button>
                        <Button variant="destructive" onClick={deleteFile} disabled={deleteFileMutation.isPending}>
                            {deleteFileMutation.isPending ? 'Deleting...' : 'Delete File'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={showRenameDialog} onOpenChange={closeRenameDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Edit3 size={20} />
                            Rename File
                        </DialogTitle>
                        <DialogDescription>
                            Enter a new name for <strong>{currentFileName}</strong>
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div>
                            <Input
                                value={newFileName}
                                onChange={(e) => setNewFileName(e.target.value)}
                                placeholder="Enter new file name"
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        renameFile();
                                    }
                                }}
                                disabled={renameFileMutation.isPending}
                            />
                        </div>
                        {(error || queryError) && (
                            <div className="text-sm text-red-600 dark:text-red-400">{error || queryError?.message || 'Unknown error'}</div>
                        )}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={closeRenameDialog} disabled={renameFileMutation.isPending}>
                            Cancel
                        </Button>
                        <Button
                            onClick={renameFile}
                            disabled={renameFileMutation.isPending || !newFileName.trim() || newFileName.trim() === currentFileName}
                        >
                            {renameFileMutation.isPending ? 'Renaming...' : 'Rename'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </Dialog>
    );
}
