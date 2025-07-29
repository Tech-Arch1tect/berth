import FileViewer from '@/components/file-viewer';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useCreateFile, useDeleteFile, useRenameFile, useStackFiles } from '@/hooks/queries/use-file-manager';
import { getFileIcon, getFileTypeLabel, isEditable } from '@/utils/file-icons';
import {
    ArrowLeft,
    ChevronRight,
    Download,
    Edit2,
    Eye,
    File as FileIcon,
    FileText,
    Files,
    Folder,
    FolderOpen,
    Home,
    Plus,
    RefreshCw,
    Trash2,
    Upload,
} from 'lucide-react';
import { useState } from 'react';

interface FileInfo {
    name: string;
    isDir: boolean;
    size: number;
    mimeType: string;
    isBinary: boolean;
    modTime: string;
}

interface FileManagerProps {
    serverId: number;
    stackName: string;
    title?: string;
    canWrite?: boolean;
}

export default function FileManager({ serverId, stackName, title = 'Stack Files', canWrite = false }: FileManagerProps) {
    const [currentPath, setCurrentPath] = useState<string>('.');
    const [viewingFile, setViewingFile] = useState<{ path: string; name: string } | null>(null);
    const [createDialogOpen, setCreateDialogOpen] = useState(false);
    const [createMode, setCreateMode] = useState<'text' | 'upload'>('text');
    const [newFileName, setNewFileName] = useState('');
    const [newFileContent, setNewFileContent] = useState('');
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [dragOver, setDragOver] = useState(false);
    const [createError, setCreateError] = useState<string | null>(null);
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
    const [fileToDelete, setFileToDelete] = useState<FileInfo | null>(null);
    const [renameDialogOpen, setRenameDialogOpen] = useState(false);
    const [fileToRename, setFileToRename] = useState<FileInfo | null>(null);
    const [newRenameFileName, setNewRenameFileName] = useState('');
    const [renameError, setRenameError] = useState<string | null>(null);

    const { data: files, isLoading, error, refetch: refetchFiles } = useStackFiles(serverId, stackName, currentPath);

    const createFileMutation = useCreateFile(serverId, stackName);
    const renameFileMutation = useRenameFile(serverId, stackName);
    const deleteFileMutation = useDeleteFile(serverId, stackName);

    const navigateToPath = (path: string) => {
        setCurrentPath(path);
    };

    const navigateUp = () => {
        if (currentPath === '.' || currentPath === '/') return;

        const pathParts = currentPath.split('/').filter((part) => part !== '');
        pathParts.pop();
        const parentPath = pathParts.length === 0 ? '.' : pathParts.join('/');
        navigateToPath(parentPath);
    };

    const formatFileSize = (bytes: number): string => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    };

    const getBreadcrumbs = () => {
        if (currentPath === '.') return ['root'];
        const parts = currentPath.split('/').filter((part) => part !== '');
        return ['root', ...parts];
    };

    const handleFileClick = (file: FileInfo) => {
        if (file.isDir) {
            const newPath = currentPath === '.' ? file.name : `${currentPath}/${file.name}`;
            navigateToPath(newPath);
        } else {
            const filePath = currentPath === '.' ? file.name : `${currentPath}/${file.name}`;
            setViewingFile({ path: filePath, name: file.name });
        }
    };

    const closeFileViewer = () => {
        setViewingFile(null);
    };

    const handleDownloadFile = (file: FileInfo) => {
        const filePath = currentPath === '.' ? file.name : `${currentPath}/${file.name}`;

        const downloadUrl = `/api/servers/${serverId}/stacks/${stackName}/file/download?path=${encodeURIComponent(filePath)}`;

        const link = document.createElement('a');
        link.href = downloadUrl;
        link.download = file.name;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const createFile = async () => {
        if (createMode === 'text') {
            return await createTextFile();
        } else {
            return await uploadFile();
        }
    };

    const createTextFile = async () => {
        if (!newFileName.trim()) {
            setCreateError('File name is required');
            return;
        }

        setCreateError(null);
        try {
            const filePath = currentPath === '.' ? newFileName : `${currentPath}/${newFileName}`;
            await createFileMutation.mutateAsync({
                path: filePath,
                content: newFileContent,
                isBinary: false,
                isBase64: false,
            });
            resetCreateDialog();
        } catch (err) {
            setCreateError(err instanceof Error ? err.message : 'Failed to create file');
        }
    };

    const uploadFile = async () => {
        if (!selectedFile) {
            setCreateError('Please select a file to upload');
            return;
        }

        const maxSizeBytes = 100 * 1024 * 1024;
        if (selectedFile.size > maxSizeBytes) {
            setCreateError(`File size (${(selectedFile.size / 1024 / 1024).toFixed(1)}MB) exceeds the maximum allowed size of 100MB`);
            return;
        }

        const fileName = newFileName.trim() || selectedFile.name;

        setCreateError(null);
        try {
            const filePath = currentPath === '.' ? fileName : `${currentPath}/${fileName}`;

            const isBinary =
                !selectedFile.type.startsWith('text/') &&
                !['application/json', 'application/xml', 'application/yaml', 'application/x-yaml'].includes(selectedFile.type);

            let content: string;
            let isBase64 = false;

            if (isBinary) {
                content = await new Promise<string>((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = () => {
                        const base64 = reader.result as string;
                        const base64Content = base64.split(',')[1];
                        resolve(base64Content);
                    };
                    reader.onerror = () => reject(reader.error);
                    reader.readAsDataURL(selectedFile);
                });
                isBase64 = true;
            } else {
                content = await selectedFile.text();
                isBase64 = false;
            }

            await createFileMutation.mutateAsync({
                path: filePath,
                content: content,
                isBinary: isBinary,
                isBase64: isBase64,
            });
            resetCreateDialog();
        } catch (err) {
            setCreateError(err instanceof Error ? err.message : 'Failed to upload file');
        }
    };

    const resetCreateDialog = () => {
        setCreateDialogOpen(false);
        setCreateMode('text');
        setNewFileName('');
        setNewFileContent('');
        setSelectedFile(null);
        setDragOver(false);
        setCreateError(null);
    };

    const handleFileSelect = (file: File) => {
        setSelectedFile(file);
        setCreateError(null);
        if (!newFileName.trim()) {
            setNewFileName(file.name);
        }
    };

    const handleFileDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setDragOver(false);

        const files = Array.from(e.dataTransfer.files);
        if (files.length > 0) {
            setCreateMode('upload');
            handleFileSelect(files[0]);
        }
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setDragOver(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        setDragOver(false);
    };

    const handleRenameClick = (file: FileInfo) => {
        setFileToRename(file);
        setNewRenameFileName(file.name);
        setRenameError(null);
        setRenameDialogOpen(true);
    };

    const renameFile = async () => {
        if (!fileToRename || !newRenameFileName.trim()) {
            setRenameError('File name is required');
            return;
        }

        if (newRenameFileName.trim() === fileToRename.name) {
            setRenameDialogOpen(false);
            return;
        }

        setRenameError(null);

        try {
            const filePath = currentPath === '.' ? fileToRename.name : `${currentPath}/${fileToRename.name}`;

            await renameFileMutation.mutateAsync({
                path: filePath,
                newName: newRenameFileName.trim(),
            });

            setRenameDialogOpen(false);
            setFileToRename(null);
            setNewRenameFileName('');
        } catch (err) {
            setRenameError(err instanceof Error ? err.message : 'Failed to rename file');
        }
    };

    const deleteFileOrFolder = async () => {
        if (!fileToDelete) return;

        try {
            const filePath = currentPath === '.' ? fileToDelete.name : `${currentPath}/${fileToDelete.name}`;

            await deleteFileMutation.mutateAsync({
                path: filePath,
                isDir: fileToDelete.isDir,
            });

            setDeleteConfirmOpen(false);
            setFileToDelete(null);
        } catch {
            setDeleteConfirmOpen(false);
        }
    };

    const handleDeleteClick = (file: FileInfo) => {
        setFileToDelete(file);
        setDeleteConfirmOpen(true);
    };

    const handleFileDeleted = () => {
        refetchFiles();
    };

    const handleFileRenamed = (oldName: string, newName: string) => {
        if (viewingFile && viewingFile.name === oldName) {
            const newPath = currentPath === '.' ? newName : `${currentPath}/${newName}`;
            setViewingFile({ path: newPath, name: newName });
        }

        refetchFiles();
    };

    return (
        <Card className="shadow-sm">
            <CardHeader className="pb-4">
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div className="space-y-3">
                        <CardTitle className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500/20 to-blue-600/20">
                                <FolderOpen className="h-5 w-5 text-blue-600" />
                            </div>
                            <div>
                                <span className="text-xl">{title}</span>
                                {files && (
                                    <p className="text-sm font-normal text-muted-foreground">
                                        {files.files.length} items in {currentPath === '.' ? 'root' : currentPath}
                                    </p>
                                )}
                            </div>
                        </CardTitle>

                        <div className="flex items-center gap-2 text-sm">
                            <Home className="h-4 w-4 text-muted-foreground" />
                            <div className="flex flex-wrap items-center gap-1">
                                {getBreadcrumbs().map((part, index) => (
                                    <div key={index} className="flex items-center gap-1">
                                        {index > 0 && <ChevronRight className="h-3 w-3 text-muted-foreground" />}
                                        <Badge variant="secondary" className="font-mono text-xs">
                                            {part}
                                        </Badge>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <Button onClick={() => refetchFiles()} disabled={isLoading} variant="outline" size="lg" className="gap-2">
                            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                            Refresh
                        </Button>
                        {canWrite && (
                            <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
                                <DialogTrigger asChild>
                                    <Button size="lg" className="gap-2">
                                        <Plus className="h-4 w-4" />
                                        Create File
                                    </Button>
                                </DialogTrigger>
                                <DialogContent className="flex max-h-[85vh] w-[90vw] max-w-4xl flex-col">
                                    <DialogHeader>
                                        <DialogTitle className="flex items-center gap-2">
                                            <Plus className="h-5 w-5 text-primary" />
                                            {createMode === 'text' ? 'Create New File' : 'Upload File'}
                                        </DialogTitle>
                                        <DialogDescription>
                                            {createMode === 'text' ? 'Create a new text file' : 'Upload a file'} in{' '}
                                            <span className="rounded bg-muted px-1 font-mono">{currentPath === '.' ? 'root' : currentPath}</span>
                                        </DialogDescription>
                                    </DialogHeader>
                                    <div className="flex flex-1 flex-col space-y-6 overflow-hidden">
                                        <div className="flex items-center justify-center space-x-1 rounded-lg bg-muted p-1">
                                            <Button
                                                variant={createMode === 'text' ? 'default' : 'ghost'}
                                                size="sm"
                                                onClick={() => {
                                                    setCreateMode('text');
                                                    setCreateError(null);
                                                }}
                                                className="flex-1"
                                            >
                                                <FileText className="mr-2 h-4 w-4" />
                                                Create Text File
                                            </Button>
                                            <Button
                                                variant={createMode === 'upload' ? 'default' : 'ghost'}
                                                size="sm"
                                                onClick={() => {
                                                    setCreateMode('upload');
                                                    setCreateError(null);
                                                }}
                                                className="flex-1"
                                            >
                                                <Upload className="mr-2 h-4 w-4" />
                                                Upload File
                                            </Button>
                                        </div>

                                        {createError && (
                                            <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-3">
                                                <div className="flex items-center gap-2">
                                                    <div className="flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full bg-destructive">
                                                        <span className="text-xs font-bold text-destructive-foreground">!</span>
                                                    </div>
                                                    <p className="text-sm font-medium text-destructive">{createError}</p>
                                                </div>
                                            </div>
                                        )}

                                        {createMode === 'text' ? (
                                            <>
                                                <div className="flex-shrink-0 space-y-2">
                                                    <label htmlFor="fileName" className="text-sm font-semibold">
                                                        File Name
                                                    </label>
                                                    <Input
                                                        id="fileName"
                                                        value={newFileName}
                                                        onChange={(e) => {
                                                            setNewFileName(e.target.value);
                                                            setCreateError(null);
                                                        }}
                                                        placeholder="example.txt"
                                                        className="font-mono"
                                                    />
                                                </div>
                                                <div className="flex flex-1 flex-col space-y-2 overflow-hidden">
                                                    <label htmlFor="fileContent" className="text-sm font-semibold">
                                                        File Content
                                                    </label>
                                                    <textarea
                                                        id="fileContent"
                                                        value={newFileContent}
                                                        onChange={(e) => setNewFileContent(e.target.value)}
                                                        placeholder="Enter file content..."
                                                        className="min-h-[400px] w-full flex-1 resize-none rounded-xl border border-border/20 bg-gradient-to-br from-background to-muted/10 px-4 py-4 font-mono text-sm text-foreground shadow-inner focus:border-transparent focus:ring-2 focus:ring-ring"
                                                    />
                                                </div>
                                            </>
                                        ) : (
                                            <>
                                                <div className="flex-shrink-0 space-y-2">
                                                    <label htmlFor="fileName" className="text-sm font-semibold">
                                                        File Name (optional)
                                                    </label>
                                                    <Input
                                                        id="fileName"
                                                        value={newFileName}
                                                        onChange={(e) => {
                                                            setNewFileName(e.target.value);
                                                            setCreateError(null);
                                                        }}
                                                        placeholder={selectedFile ? selectedFile.name : 'Will use original filename if empty'}
                                                        className="font-mono"
                                                    />
                                                </div>
                                                <div className="flex flex-1 flex-col space-y-2 overflow-hidden">
                                                    <label className="text-sm font-semibold">Select File</label>
                                                    <div
                                                        className={`flex min-h-[400px] flex-1 flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 text-center transition-colors ${
                                                            dragOver ? 'border-primary bg-primary/5' : 'border-border/50 hover:border-border/80'
                                                        }`}
                                                        onDrop={handleFileDrop}
                                                        onDragOver={handleDragOver}
                                                        onDragLeave={handleDragLeave}
                                                    >
                                                        {selectedFile ? (
                                                            <div className="space-y-4">
                                                                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-lg bg-primary/10">
                                                                    <Files className="h-8 w-8 text-primary" />
                                                                </div>
                                                                <div>
                                                                    <h3 className="text-lg font-medium">{selectedFile.name}</h3>
                                                                    <p className="text-sm text-muted-foreground">
                                                                        {selectedFile.size > 1024 * 1024
                                                                            ? `${(selectedFile.size / 1024 / 1024).toFixed(1)} MB`
                                                                            : `${(selectedFile.size / 1024).toFixed(1)} KB`}{' '}
                                                                        • {selectedFile.type || 'Unknown type'}
                                                                    </p>
                                                                    {selectedFile.size > 100 * 1024 * 1024 && (
                                                                        <p className="mt-1 text-sm text-destructive">⚠️ File exceeds 100MB limit</p>
                                                                    )}
                                                                </div>
                                                                <Button variant="outline" onClick={() => setSelectedFile(null)} size="sm">
                                                                    Choose Different File
                                                                </Button>
                                                            </div>
                                                        ) : (
                                                            <div className="space-y-4">
                                                                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-lg bg-muted">
                                                                    <Upload className="h-8 w-8 text-muted-foreground" />
                                                                </div>
                                                                <div>
                                                                    <h3 className="text-lg font-medium">Drop your file here</h3>
                                                                    <p className="text-sm text-muted-foreground">or click to browse files</p>
                                                                </div>
                                                                <input
                                                                    type="file"
                                                                    onChange={(e) => {
                                                                        const file = e.target.files?.[0];
                                                                        if (file) handleFileSelect(file);
                                                                    }}
                                                                    className="hidden"
                                                                    id="fileUpload"
                                                                />
                                                                <Button
                                                                    variant="outline"
                                                                    onClick={() => document.getElementById('fileUpload')?.click()}
                                                                >
                                                                    Choose File
                                                                </Button>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                    <DialogFooter>
                                        <Button variant="outline" onClick={resetCreateDialog}>
                                            Cancel
                                        </Button>
                                        <Button
                                            onClick={createFile}
                                            disabled={createFileMutation.isPending || (createMode === 'text' ? !newFileName.trim() : !selectedFile)}
                                            className="transition-all hover:scale-105"
                                        >
                                            {createFileMutation.isPending
                                                ? createMode === 'text'
                                                    ? 'Creating...'
                                                    : 'Uploading...'
                                                : createMode === 'text'
                                                  ? 'Create File'
                                                  : 'Upload File'}
                                        </Button>
                                    </DialogFooter>
                                </DialogContent>
                            </Dialog>
                        )}
                        <Button
                            onClick={() => refetchFiles()}
                            disabled={isLoading}
                            variant="outline"
                            size="sm"
                            className="transition-all hover:scale-105"
                        >
                            <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                            Refresh
                        </Button>
                    </div>
                </div>
            </CardHeader>
            <CardContent
                className="relative"
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={(e) => {
                    handleFileDrop(e);
                    setCreateDialogOpen(true);
                }}
            >
                {dragOver && (
                    <div className="absolute inset-0 z-10 flex items-center justify-center rounded-lg border-2 border-dashed border-primary bg-primary/5">
                        <div className="text-center">
                            <Upload className="mx-auto mb-4 h-12 w-12 text-primary" />
                            <h3 className="text-lg font-semibold text-primary">Drop file to upload</h3>
                            <p className="text-muted-foreground">Release to upload file to current directory</p>
                        </div>
                    </div>
                )}

                {error ? (
                    <div className="py-12 text-center">
                        <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-destructive/10">
                            <FileIcon className="h-10 w-10 text-destructive" />
                        </div>
                        <h3 className="mb-2 text-lg font-semibold">Error Loading Files</h3>
                        <p className="mb-4 text-destructive">{error?.message || 'Unknown error'}</p>
                        <Button onClick={() => refetchFiles()} variant="outline" className="transition-all hover:scale-105">
                            <RefreshCw className="mr-2 h-4 w-4" />
                            Retry
                        </Button>
                    </div>
                ) : isLoading ? (
                    <div className="py-12 text-center">
                        <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
                            <RefreshCw className="h-10 w-10 animate-spin text-primary" />
                        </div>
                        <h3 className="mb-2 text-lg font-semibold">Loading Files</h3>
                        <p className="text-muted-foreground">Please wait while we fetch the directory contents...</p>
                    </div>
                ) : files ? (
                    <div className="space-y-6">
                        {currentPath !== '.' && (
                            <div className="flex items-center gap-2">
                                <Button onClick={navigateUp} variant="outline" size="sm" className="transition-all hover:scale-105">
                                    <ArrowLeft size={14} className="mr-1" />
                                    Back to Parent
                                </Button>
                            </div>
                        )}

                        <div className="space-y-2">
                            {files.files.length === 0 ? (
                                <div className="py-12 text-center">
                                    <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-muted/30">
                                        <Folder className="h-10 w-10 text-muted-foreground" />
                                    </div>
                                    <h3 className="mb-2 text-lg font-semibold">Empty Directory</h3>
                                    <p className="text-muted-foreground">This directory contains no files or folders.</p>
                                </div>
                            ) : (
                                files.files
                                    .sort((a, b) => {
                                        if (a.isDir && !b.isDir) return -1;
                                        if (!a.isDir && b.isDir) return 1;
                                        return a.name.localeCompare(b.name);
                                    })
                                    .map((file, index) => (
                                        <div
                                            key={file.name}
                                            className="group duration-300 animate-in slide-in-from-bottom-4"
                                            style={{ animationDelay: `${index * 50}ms` }}
                                        >
                                            <div className="flex items-center justify-between rounded-xl border border-border/30 bg-gradient-to-r from-muted/30 to-muted/10 p-4 transition-all duration-300 group-hover:translate-x-1 hover:border-border/60 hover:bg-gradient-to-r hover:from-muted/50 hover:to-muted/20 hover:shadow-md">
                                                <div
                                                    className={`flex flex-1 items-center gap-4 ${file.isDir ? 'cursor-pointer' : ''}`}
                                                    onClick={() => file.isDir && handleFileClick(file)}
                                                >
                                                    <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-border/50 bg-background">
                                                        {getFileIcon(file.name, file.mimeType || 'application/octet-stream', file.isDir)}
                                                    </div>
                                                    <div className="min-w-0 flex-1">
                                                        <div className="truncate text-sm font-medium transition-colors group-hover:text-primary">
                                                            {file.name}
                                                        </div>
                                                        <div className="mt-1 flex items-center gap-2">
                                                            <Badge variant={file.isDir ? 'secondary' : 'outline'} className="text-xs">
                                                                {file.isDir
                                                                    ? 'Directory'
                                                                    : getFileTypeLabel(
                                                                          file.name,
                                                                          file.mimeType || 'application/octet-stream',
                                                                          file.isBinary || false,
                                                                      )}
                                                            </Badge>
                                                            {!file.isDir && (
                                                                <span className="text-xs text-muted-foreground">{formatFileSize(file.size)}</span>
                                                            )}
                                                            {!file.isDir && file.isBinary && (
                                                                <Badge variant="destructive" className="text-xs">
                                                                    Binary
                                                                </Badge>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    {!file.isDir && (
                                                        <>
                                                            {isEditable(file.mimeType || 'application/octet-stream', file.isBinary || false) ? (
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    onClick={() => handleFileClick(file)}
                                                                    className="transition-all hover:scale-105"
                                                                >
                                                                    <Eye size={14} className="mr-1" />
                                                                    View
                                                                </Button>
                                                            ) : (
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    onClick={() => handleDownloadFile(file)}
                                                                    className="transition-all hover:scale-105"
                                                                >
                                                                    <Download size={14} className="mr-1" />
                                                                    Download
                                                                </Button>
                                                            )}
                                                        </>
                                                    )}
                                                    {file.isDir && (
                                                        <ChevronRight className="h-4 w-4 text-muted-foreground transition-colors group-hover:text-primary" />
                                                    )}
                                                    {canWrite && (
                                                        <>
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                onClick={() => handleRenameClick(file)}
                                                                className="text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                                                                title="Rename"
                                                            >
                                                                <Edit2 size={14} />
                                                            </Button>
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                onClick={() => handleDeleteClick(file)}
                                                                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                                                            >
                                                                <Trash2 size={14} />
                                                            </Button>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="py-12 text-center">
                        <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-muted/30">
                            <FolderOpen className="h-10 w-10 text-muted-foreground" />
                        </div>
                        <h3 className="mb-2 text-lg font-semibold">Ready to Browse</h3>
                        <p className="text-muted-foreground">Click refresh to load the directory contents.</p>
                    </div>
                )}
            </CardContent>

            {viewingFile && (
                <FileViewer
                    serverId={serverId}
                    stackName={stackName}
                    filePath={viewingFile.path}
                    fileName={viewingFile.name}
                    isOpen={!!viewingFile}
                    onClose={closeFileViewer}
                    canWrite={canWrite}
                    onFileDeleted={handleFileDeleted}
                    onFileRenamed={handleFileRenamed}
                />
            )}

            <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-destructive/10">
                                <Trash2 className="h-4 w-4 text-destructive" />
                            </div>
                            Delete {fileToDelete?.isDir ? 'Directory' : 'File'}
                        </DialogTitle>
                        <DialogDescription className="space-y-2">
                            <p>
                                Are you sure you want to delete <span className="rounded bg-muted px-1 font-mono">{fileToDelete?.name}</span>?
                            </p>
                            {fileToDelete?.isDir && (
                                <p className="text-sm text-destructive">⚠️ This will delete the directory and all its contents.</p>
                            )}
                            <p className="text-sm text-muted-foreground">This action cannot be undone.</p>
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => {
                                setDeleteConfirmOpen(false);
                                setFileToDelete(null);
                            }}
                            disabled={deleteFileMutation.isPending}
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={deleteFileOrFolder}
                            disabled={deleteFileMutation.isPending}
                            className="transition-all hover:scale-105"
                        >
                            {deleteFileMutation.isPending ? 'Deleting...' : `Delete ${fileToDelete?.isDir ? 'Directory' : 'File'}`}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={renameDialogOpen} onOpenChange={setRenameDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                                <Edit2 className="h-4 w-4 text-primary" />
                            </div>
                            Rename {fileToRename?.isDir ? 'Directory' : 'File'}
                        </DialogTitle>
                        <DialogDescription>
                            {fileToRename && (
                                <span>
                                    Enter a new name for <strong>{fileToRename.name}</strong>
                                </span>
                            )}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4">
                        {renameError && (
                            <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-3">
                                <div className="flex items-center gap-2">
                                    <div className="flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full bg-destructive">
                                        <span className="text-xs font-bold text-destructive-foreground">!</span>
                                    </div>
                                    <p className="text-sm font-medium text-destructive">{renameError}</p>
                                </div>
                            </div>
                        )}

                        <div className="space-y-2">
                            <label htmlFor="renameInput" className="text-sm font-semibold">
                                New Name
                            </label>
                            <Input
                                id="renameInput"
                                value={newRenameFileName}
                                onChange={(e) => {
                                    setNewRenameFileName(e.target.value);
                                    setRenameError(null);
                                }}
                                placeholder="Enter new name..."
                                className="font-mono"
                                disabled={renameFileMutation.isPending}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        renameFile();
                                    }
                                }}
                            />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => {
                                setRenameDialogOpen(false);
                                setRenameError(null);
                            }}
                            disabled={renameFileMutation.isPending}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={renameFile}
                            disabled={renameFileMutation.isPending || !newRenameFileName.trim() || newRenameFileName.trim() === fileToRename?.name}
                        >
                            {renameFileMutation.isPending ? 'Renaming...' : 'Rename'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </Card>
    );
}
