import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { File, Download, Copy, Eye, Edit, Save, X, Trash2, AlertTriangle, Edit3 } from 'lucide-react';
import { getFileIcon, getFileTypeLabel, formatFileSize, isEditable } from '@/utils/file-icons';

interface FileData {
    stack: string;
    path: string;
    content: string;
    size: number;
    mimeType: string;
    isBinary: boolean;
    isBase64: boolean;
    modTime: string;
}

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

export default function FileViewer({ serverId, stackName, filePath, fileName, isOpen, onClose, canWrite = false, onFileDeleted, onFileRenamed }: FileViewerProps) {
    const [fileData, setFileData] = useState<FileData | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [editContent, setEditContent] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [showRenameDialog, setShowRenameDialog] = useState(false);
    const [newFileName, setNewFileName] = useState('');
    const [isRenaming, setIsRenaming] = useState(false);
    const [currentFileName, setCurrentFileName] = useState(fileName);

    const fetchFile = useCallback(async () => {
        if (!isOpen || !filePath) return;
        
        setIsLoading(true);
        setError(null);
        setFileData(null);
        
        try {
            const params = new URLSearchParams({ path: filePath });
            const response = await fetch(`/api/servers/${serverId}/stacks/${stackName}/file?${params}`);
            
            if (response.ok) {
                const data = await response.json();
                setFileData(data);
            } else {
                const errorData = await response.json();
                setError(errorData.error || 'Failed to fetch file');
            }
        } catch (err) {
            setError(`Failed to fetch file: ${err}`);
        } finally {
            setIsLoading(false);
        }
    }, [isOpen, filePath, serverId, stackName]);

    useEffect(() => {
        fetchFile();
    }, [isOpen, filePath, serverId, stackName, fetchFile]);

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
        
        setIsSaving(true);
        setError(null);
        
        try {
            const response = await fetch(`/api/servers/${serverId}/stacks/${stackName}/file`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || ''
                },
                body: JSON.stringify({
                    path: filePath,
                    content: editContent
                })
            });

            if (response.ok) {
                const updatedData = await response.json();
                setFileData({
                    ...fileData,
                    content: editContent,
                    size: updatedData.size || editContent.length
                });
                setIsEditing(false);
                setEditContent('');
            } else {
                const errorData = await response.json();
                setError(errorData.error || 'Failed to save file');
            }
        } catch (err) {
            setError(`Failed to save file: ${err}`);
        } finally {
            setIsSaving(false);
        }
    };

    const deleteFile = async () => {
        if (!fileData) return;
        
        setIsDeleting(true);
        setError(null);
        
        try {
            const params = new URLSearchParams({ path: filePath });
            const response = await fetch(`/api/servers/${serverId}/stacks/${stackName}/file?${params}`, {
                method: 'DELETE',
                headers: {
                    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || ''
                }
            });

            if (response.ok) {
                setShowDeleteConfirm(false);
                onClose();
                if (onFileDeleted) {
                    onFileDeleted();
                }
            } else {
                const errorData = await response.json();
                setError(errorData.error || 'Failed to delete file');
                setShowDeleteConfirm(false);
            }
        } catch (err) {
            setError(`Failed to delete file: ${err}`);
            setShowDeleteConfirm(false);
        } finally {
            setIsDeleting(false);
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

        setIsRenaming(true);
        setError(null);

        try {
            const response = await fetch(`/api/servers/${serverId}/stacks/${stackName}/file?path=${encodeURIComponent(filePath)}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || ''
                },
                body: JSON.stringify({ newName: newFileName.trim() })
            });

            if (response.ok) {
                const result = await response.json();
                const oldName = currentFileName;
                setCurrentFileName(newFileName.trim());
                setShowRenameDialog(false);
                setNewFileName('');
                
                if (onFileRenamed) {
                    onFileRenamed(oldName, newFileName.trim());
                }
            } else {
                const errorData = await response.json();
                setError(errorData.error || 'Failed to rename file');
            }
        } catch (err) {
            setError(`Failed to rename file: ${err}`);
        } finally {
            setIsRenaming(false);
        }
    };


    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-6xl max-h-[90vh] flex flex-col">
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
                        <div className="flex items-center gap-2 mt-2">
                            {isEditing ? (
                                <>
                                    <Button
                                        variant="default"
                                        size="sm"
                                        onClick={saveFile}
                                        disabled={isSaving}
                                    >
                                        <Save size={14} className="mr-1" />
                                        {isSaving ? 'Saving...' : 'Save'}
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={cancelEditing}
                                        disabled={isSaving}
                                    >
                                        <X size={14} className="mr-1" />
                                        Cancel
                                    </Button>
                                </>
                            ) : (
                                <>
                                    {canWrite && (
                                        <>
                                            {!fileData.isBinary && isEditable(fileData.mimeType, fileData.isBinary) && (
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={startEditing}
                                                >
                                                    <Edit size={14} className="mr-1" />
                                                    Edit
                                                </Button>
                                            )}
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={openRenameDialog}
                                            >
                                                <Edit3 size={14} className="mr-1" />
                                                Rename
                                            </Button>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => setShowDeleteConfirm(true)}
                                                className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:text-red-300 dark:hover:bg-red-950"
                                            >
                                                <Trash2 size={14} className="mr-1" />
                                                Delete
                                            </Button>
                                        </>
                                    )}
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={copyToClipboard}
                                        disabled={!fileData.content}
                                    >
                                        <Copy size={14} className="mr-1" />
                                        Copy
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={downloadFile}
                                    >
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
                        <div className="flex items-center justify-center h-64">
                            <div className="text-center">
                                <Eye className="mx-auto h-12 w-12 mb-4 animate-pulse opacity-50" />
                                <p className="text-gray-500 dark:text-gray-400">Loading file...</p>
                            </div>
                        </div>
                    ) : error ? (
                        <div className="flex items-center justify-center h-64">
                            <div className="text-center text-red-500 dark:text-red-400">
                                <File className="mx-auto h-12 w-12 mb-4 opacity-50" />
                                <p>{error}</p>
                                <Button
                                    onClick={fetchFile}
                                    variant="outline"
                                    size="sm"
                                    className="mt-2"
                                >
                                    Retry
                                </Button>
                            </div>
                        </div>
                    ) : fileData ? (
                        <div className="h-full overflow-auto">
                            <div className="h-full">
                                <div className="bg-muted/30 px-4 py-2 border-b border-border text-sm text-muted-foreground">
                                    <span>Path: {fileData.path}</span>
                                    <span className="ml-4">Size: {formatFileSize(fileData.size)}</span>
                                    {isEditing && <span className="ml-4 text-yellow-600 dark:text-yellow-400">Editing</span>}
                                </div>
                                {isEditing ? (
                                    <div className="border border-border rounded-lg overflow-hidden h-full">
                                        <div className="bg-muted/50 px-3 py-2 border-b border-border">
                                            <div className="flex items-center gap-2">
                                                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                                                <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                                                <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                                                <span className="text-xs text-muted-foreground ml-2 font-mono">{currentFileName} (editing)</span>
                                            </div>
                                        </div>
                                        <textarea
                                            value={editContent}
                                            onChange={(e) => setEditContent(e.target.value)}
                                            className="w-full p-4 text-sm font-mono bg-card text-foreground border-0 outline-none resize-none focus:ring-0"
                                            style={{ minHeight: '400px' }}
                                            placeholder="Enter file content..."
                                        />
                                    </div>
                                ) : (
                                    <div className="border border-border rounded-lg overflow-hidden h-full">
                                        <div className="bg-muted/50 px-3 py-2 border-b border-border">
                                            <div className="flex items-center gap-2">
                                                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                                                <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                                                <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                                                <span className="text-xs text-muted-foreground ml-2 font-mono">{currentFileName}</span>
                                            </div>
                                        </div>
                                        <div className="bg-card p-4 overflow-auto" style={{ minHeight: '400px' }}>
                                            {fileData.isBinary ? (
                                                <div className="flex flex-col items-center justify-center h-full text-center py-8">
                                                    <AlertTriangle className="w-16 h-16 text-yellow-500 mb-4" />
                                                    <h3 className="text-lg font-medium mb-2">Binary File</h3>
                                                    <p className="text-muted-foreground mb-4">
                                                        This file contains binary data and cannot be displayed as text.
                                                    </p>
                                                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                                        <span>Type: {getFileTypeLabel(fileName, fileData.mimeType, fileData.isBinary)}</span>
                                                        <span>Size: {formatFileSize(fileData.size)}</span>
                                                    </div>
                                                    <Button 
                                                        onClick={downloadFile} 
                                                        className="mt-4"
                                                        variant="outline"
                                                    >
                                                        <Download size={16} className="mr-2" />
                                                        Download File
                                                    </Button>
                                                </div>
                                            ) : fileData.mimeType?.startsWith('image/') ? (
                                                <div className="flex items-center justify-center h-full">
                                                    <img 
                                                        src={`data:${fileData.mimeType};base64,${fileData.content}`}
                                                        alt={currentFileName}
                                                        className="max-w-full max-h-full object-contain"
                                                        style={{ maxHeight: '400px' }}
                                                    />
                                                </div>
                                            ) : (
                                                <pre className="text-sm font-mono text-foreground whitespace-pre-wrap leading-relaxed">
                                                    {fileData.content}
                                                </pre>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="flex items-center justify-center h-64">
                            <div className="text-center text-muted-foreground">
                                <Eye className="mx-auto h-12 w-12 mb-4 opacity-50" />
                                <p>Click to view file content</p>
                            </div>
                        </div>
                    )}
                </div>
            </DialogContent>
            
            {/* Delete Confirmation Dialog */}
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
                        <Button
                            variant="outline"
                            onClick={() => setShowDeleteConfirm(false)}
                            disabled={isDeleting}
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={deleteFile}
                            disabled={isDeleting}
                        >
                            {isDeleting ? 'Deleting...' : 'Delete File'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            
            {/* Rename Dialog */}
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
                                disabled={isRenaming}
                            />
                        </div>
                        {error && (
                            <div className="text-sm text-red-600 dark:text-red-400">
                                {error}
                            </div>
                        )}
                    </div>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={closeRenameDialog}
                            disabled={isRenaming}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={renameFile}
                            disabled={isRenaming || !newFileName.trim() || newFileName.trim() === currentFileName}
                        >
                            {isRenaming ? 'Renaming...' : 'Rename'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </Dialog>
    );
}