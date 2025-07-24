import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ArrowLeft, RefreshCw, FolderOpen, Eye, Plus, Trash2, ChevronRight, Home, Download, Upload, FileText, Files, File as FileIcon, Folder, Edit2 } from 'lucide-react';
import FileViewer from '@/components/file-viewer';
import { getFileIcon, getFileTypeLabel, isEditable } from '@/utils/file-icons';

interface FileInfo {
    name: string;
    isDir: boolean;
    size: number;
    mimeType: string;
    isBinary: boolean;
    modTime: string;
}

interface FilesResponse {
    stack: string;
    path: string;
    files: FileInfo[];
}

interface FileManagerProps {
    serverId: number;
    stackName: string;
    title?: string;
    canWrite?: boolean;
}

export default function FileManager({ serverId, stackName, title = "Stack Files", canWrite = false }: FileManagerProps) {
    const [files, setFiles] = useState<FilesResponse | null>(null);
    const [currentPath, setCurrentPath] = useState<string>('.');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [viewingFile, setViewingFile] = useState<{ path: string; name: string } | null>(null);
    const [createDialogOpen, setCreateDialogOpen] = useState(false);
    const [createMode, setCreateMode] = useState<'text' | 'upload'>('text');
    const [newFileName, setNewFileName] = useState('');
    const [newFileContent, setNewFileContent] = useState('');
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [isCreating, setIsCreating] = useState(false);
    const [dragOver, setDragOver] = useState(false);
    const [createError, setCreateError] = useState<string | null>(null);
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
    const [fileToDelete, setFileToDelete] = useState<FileInfo | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [renameDialogOpen, setRenameDialogOpen] = useState(false);
    const [fileToRename, setFileToRename] = useState<FileInfo | null>(null);
    const [newRenameFileName, setNewRenameFileName] = useState('');
    const [isRenaming, setIsRenaming] = useState(false);
    const [renameError, setRenameError] = useState<string | null>(null);

    const fetchFiles = useCallback(async (path: string = '.') => {
        setIsLoading(true);
        setError(null);
        try {
            const params = new URLSearchParams({ path });
            const response = await fetch(`/api/servers/${serverId}/stacks/${stackName}/files?${params}`);
            
            if (response.ok) {
                const filesData = await response.json();
                setFiles(filesData);
                setCurrentPath(path);
            } else {
                const errorData = await response.json();
                setError(errorData.error || 'Failed to fetch files');
            }
        } catch (err) {
            setError(`Failed to fetch files: ${err}`);
        } finally {
            setIsLoading(false);
        }
    }, [serverId, stackName]);

    useEffect(() => {
        fetchFiles('.');
    }, [serverId, stackName, fetchFiles]);

    const navigateToPath = (path: string) => {
        fetchFiles(path);
    };

    const navigateUp = () => {
        if (currentPath === '.' || currentPath === '/') return;
        
        const pathParts = currentPath.split('/').filter(part => part !== '');
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
        const parts = currentPath.split('/').filter(part => part !== '');
        return ['root', ...parts];
    };

    const handleFileClick = (file: FileInfo) => {
        if (file.isDir) {
            const newPath = currentPath === '.' 
                ? file.name 
                : `${currentPath}/${file.name}`;
            navigateToPath(newPath);
        } else {
            const filePath = currentPath === '.' 
                ? file.name 
                : `${currentPath}/${file.name}`;
            setViewingFile({ path: filePath, name: file.name });
        }
    };

    const closeFileViewer = () => {
        setViewingFile(null);
    };

    const handleDownloadFile = (file: FileInfo) => {
        const filePath = currentPath === '.' 
            ? file.name 
            : `${currentPath}/${file.name}`;
        
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

        setIsCreating(true);
        setCreateError(null);
        try {
            const filePath = currentPath === '.' ? newFileName : `${currentPath}/${newFileName}`;
            const response = await fetch(`/api/servers/${serverId}/stacks/${stackName}/file`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || ''
                },
                body: JSON.stringify({
                    path: filePath,
                    content: newFileContent,
                    isBinary: false,
                    isBase64: false
                })
            });

            if (response.ok) {
                resetCreateDialog();
                await fetchFiles(currentPath);
            } else {
                const errorData = await response.json();
                setCreateError(errorData.error || 'Failed to create file');
            }
        } catch (err) {
            setCreateError(`Failed to create file: ${err}`);
        } finally {
            setIsCreating(false);
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
        
        setIsCreating(true);
        setCreateError(null);
        try {
            const filePath = currentPath === '.' ? fileName : `${currentPath}/${fileName}`;
            
            const isBinary = !selectedFile.type.startsWith('text/') && 
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

            const response = await fetch(`/api/servers/${serverId}/stacks/${stackName}/file`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || ''
                },
                body: JSON.stringify({
                    path: filePath,
                    content: content,
                    isBinary: isBinary,
                    isBase64: isBase64
                })
            });

            if (response.ok) {
                resetCreateDialog();
                await fetchFiles(currentPath);
            } else {
                const errorData = await response.json();
                setCreateError(errorData.error || 'Failed to upload file');
            }
        } catch (err) {
            setCreateError(`Failed to upload file: ${err}`);
        } finally {
            setIsCreating(false);
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

        setIsRenaming(true);
        setRenameError(null);

        try {
            const filePath = currentPath === '.' 
                ? fileToRename.name 
                : `${currentPath}/${fileToRename.name}`;

            const response = await fetch(`/api/servers/${serverId}/stacks/${stackName}/file?path=${encodeURIComponent(filePath)}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || ''
                },
                body: JSON.stringify({
                    newName: newRenameFileName.trim()
                })
            });

            if (response.ok) {
                setRenameDialogOpen(false);
                setFileToRename(null);
                setNewRenameFileName('');
                await fetchFiles(currentPath);
            } else {
                const errorData = await response.json();
                setRenameError(errorData.error || 'Failed to rename file');
            }
        } catch (err) {
            setRenameError(`Failed to rename file: ${err}`);
        } finally {
            setIsRenaming(false);
        }
    };

    const deleteFileOrFolder = async () => {
        if (!fileToDelete) return;
        
        setIsDeleting(true);
        setError(null);
        
        try {
            const filePath = currentPath === '.' ? fileToDelete.name : `${currentPath}/${fileToDelete.name}`;
            const params = new URLSearchParams({ path: filePath });
            
            if (fileToDelete.isDir) {
                params.append('recursive', 'true');
            }
            
            const response = await fetch(`/api/servers/${serverId}/stacks/${stackName}/file?${params}`, {
                method: 'DELETE',
                headers: {
                    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || ''
                }
            });

            if (response.ok) {
                setDeleteConfirmOpen(false);
                setFileToDelete(null);
                await fetchFiles(currentPath);
            } else {
                const errorData = await response.json();
                setError(errorData.error || 'Failed to delete file');
                setDeleteConfirmOpen(false);
            }
        } catch (err) {
            setError(`Failed to delete file: ${err}`);
            setDeleteConfirmOpen(false);
        } finally {
            setIsDeleting(false);
        }
    };

    const handleDeleteClick = (file: FileInfo) => {
        setFileToDelete(file);
        setDeleteConfirmOpen(true);
    };

    const handleFileDeleted = () => {
        fetchFiles(currentPath);
    };

    const handleFileRenamed = (oldName: string, newName: string) => {
        if (viewingFile && viewingFile.name === oldName) {
            const newPath = currentPath === '.' 
                ? newName 
                : `${currentPath}/${newName}`;
            setViewingFile({ path: newPath, name: newName });
        }
        
        fetchFiles(currentPath);
    };

    return (
        <Card className="bg-gradient-to-br from-card to-muted/20 border border-border/60 shadow-lg">
            <CardHeader className="pb-4">
                <div className="flex justify-between items-start">
                    <div className="space-y-2">
                        <CardTitle className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-gradient-to-br from-primary/20 to-accent/20 rounded-lg flex items-center justify-center">
                                <FolderOpen className="h-4 w-4 text-primary" />
                            </div>
                            <span className="text-lg">{title}</span>
                            {files && (
                                <Badge variant="outline" className="text-xs">
                                    {files.files.length} items
                                </Badge>
                            )}
                        </CardTitle>
                        
                        {/* Breadcrumb Navigation */}
                        <div className="flex items-center gap-2 text-sm">
                            <Home className="h-4 w-4 text-muted-foreground" />
                            <div className="flex items-center gap-1">
                                {getBreadcrumbs().map((part, index) => (
                                    <div key={index} className="flex items-center gap-1">
                                        {index > 0 && <ChevronRight className="h-3 w-3 text-muted-foreground" />}
                                        <span className="font-mono bg-muted/30 px-2 py-1 rounded-md text-xs">
                                            {part}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                        {canWrite && (
                            <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
                                <DialogTrigger asChild>
                                    <Button variant="outline" size="sm" className="transition-all hover:scale-105">
                                        <Plus className="mr-2 h-4 w-4" />
                                        Create File
                                    </Button>
                                </DialogTrigger>
                                <DialogContent className="max-w-4xl w-[90vw] max-h-[85vh] flex flex-col">
                                    <DialogHeader>
                                        <DialogTitle className="flex items-center gap-2">
                                            <Plus className="h-5 w-5 text-primary" />
                                            {createMode === 'text' ? 'Create New File' : 'Upload File'}
                                        </DialogTitle>
                                        <DialogDescription>
                                            {createMode === 'text' ? 'Create a new text file' : 'Upload a file'} in <span className="font-mono bg-muted px-1 rounded">{currentPath === '.' ? 'root' : currentPath}</span>
                                        </DialogDescription>
                                    </DialogHeader>
                                    <div className="flex-1 flex flex-col space-y-6 overflow-hidden">
                                        {/* Mode Toggle */}
                                        <div className="flex items-center justify-center space-x-1 bg-muted rounded-lg p-1">
                                            <Button
                                                variant={createMode === 'text' ? 'default' : 'ghost'}
                                                size="sm"
                                                onClick={() => {
                                                    setCreateMode('text');
                                                    setCreateError(null);
                                                }}
                                                className="flex-1"
                                            >
                                                <FileText className="w-4 h-4 mr-2" />
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
                                                <Upload className="w-4 h-4 mr-2" />
                                                Upload File
                                            </Button>
                                        </div>

                                        {/* Error Display */}
                                        {createError && (
                                            <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-4 h-4 rounded-full bg-destructive flex items-center justify-center flex-shrink-0">
                                                        <span className="text-destructive-foreground text-xs font-bold">!</span>
                                                    </div>
                                                    <p className="text-sm text-destructive font-medium">{createError}</p>
                                                </div>
                                            </div>
                                        )}

                                        {createMode === 'text' ? (
                                            <>
                                                <div className="space-y-2 flex-shrink-0">
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
                                                <div className="space-y-2 flex-1 flex flex-col overflow-hidden">
                                                    <label htmlFor="fileContent" className="text-sm font-semibold">
                                                        File Content
                                                    </label>
                                                    <textarea
                                                        id="fileContent"
                                                        value={newFileContent}
                                                        onChange={(e) => setNewFileContent(e.target.value)}
                                                        placeholder="Enter file content..."
                                                        className="flex-1 w-full px-4 py-4 border border-border/20 rounded-xl text-sm bg-gradient-to-br from-background to-muted/10 text-foreground font-mono resize-none focus:ring-2 focus:ring-ring focus:border-transparent shadow-inner min-h-[400px]"
                                                    />
                                                </div>
                                            </>
                                        ) : (
                                            <>
                                                <div className="space-y-2 flex-shrink-0">
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
                                                        placeholder={selectedFile ? selectedFile.name : "Will use original filename if empty"}
                                                        className="font-mono"
                                                    />
                                                </div>
                                                <div className="space-y-2 flex-1 flex flex-col overflow-hidden">
                                                    <label className="text-sm font-semibold">
                                                        Select File
                                                    </label>
                                                    <div 
                                                        className={`flex-1 border-2 border-dashed rounded-xl p-8 text-center transition-colors min-h-[400px] flex flex-col items-center justify-center ${
                                                            dragOver ? 'border-primary bg-primary/5' : 'border-border/50 hover:border-border/80'
                                                        }`}
                                                        onDrop={handleFileDrop}
                                                        onDragOver={handleDragOver}
                                                        onDragLeave={handleDragLeave}
                                                    >
                                                        {selectedFile ? (
                                                            <div className="space-y-4">
                                                                <div className="w-16 h-16 mx-auto rounded-lg bg-primary/10 flex items-center justify-center">
                                                                    <Files className="w-8 h-8 text-primary" />
                                                                </div>
                                                                <div>
                                                                    <h3 className="font-medium text-lg">{selectedFile.name}</h3>
                                                                    <p className="text-sm text-muted-foreground">
                                                                        {selectedFile.size > 1024 * 1024 
                                                                            ? `${(selectedFile.size / 1024 / 1024).toFixed(1)} MB` 
                                                                            : `${(selectedFile.size / 1024).toFixed(1)} KB`
                                                                        } • {selectedFile.type || 'Unknown type'}
                                                                    </p>
                                                                    {selectedFile.size > 100 * 1024 * 1024 && (
                                                                        <p className="text-sm text-destructive mt-1">
                                                                            ⚠️ File exceeds 100MB limit
                                                                        </p>
                                                                    )}
                                                                </div>
                                                                <Button
                                                                    variant="outline"
                                                                    onClick={() => setSelectedFile(null)}
                                                                    size="sm"
                                                                >
                                                                    Choose Different File
                                                                </Button>
                                                            </div>
                                                        ) : (
                                                            <div className="space-y-4">
                                                                <div className="w-16 h-16 mx-auto rounded-lg bg-muted flex items-center justify-center">
                                                                    <Upload className="w-8 h-8 text-muted-foreground" />
                                                                </div>
                                                                <div>
                                                                    <h3 className="font-medium text-lg">Drop your file here</h3>
                                                                    <p className="text-sm text-muted-foreground">
                                                                        or click to browse files
                                                                    </p>
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
                                        <Button
                                            variant="outline"
                                            onClick={resetCreateDialog}
                                        >
                                            Cancel
                                        </Button>
                                        <Button
                                            onClick={createFile}
                                            disabled={isCreating || (createMode === 'text' ? !newFileName.trim() : !selectedFile)}
                                            className="transition-all hover:scale-105"
                                        >
                                            {isCreating ? (
                                                createMode === 'text' ? 'Creating...' : 'Uploading...'
                                            ) : (
                                                createMode === 'text' ? 'Create File' : 'Upload File'
                                            )}
                                        </Button>
                                    </DialogFooter>
                                </DialogContent>
                            </Dialog>
                        )}
                        <Button
                            onClick={() => fetchFiles(currentPath)}
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
                {/* Drag and Drop Overlay */}
                {dragOver && (
                    <div className="absolute inset-0 bg-primary/5 border-2 border-dashed border-primary rounded-lg flex items-center justify-center z-10">
                        <div className="text-center">
                            <Upload className="w-12 h-12 text-primary mx-auto mb-4" />
                            <h3 className="text-lg font-semibold text-primary">Drop file to upload</h3>
                            <p className="text-muted-foreground">Release to upload file to current directory</p>
                        </div>
                    </div>
                )}

                {error ? (
                    <div className="text-center py-12">
                        <div className="w-20 h-20 bg-destructive/10 rounded-full flex items-center justify-center mx-auto mb-4">
                            <FileIcon className="h-10 w-10 text-destructive" />
                        </div>
                        <h3 className="text-lg font-semibold mb-2">Error Loading Files</h3>
                        <p className="text-destructive mb-4">{error}</p>
                        <Button
                            onClick={() => fetchFiles(currentPath)}
                            variant="outline"
                            className="transition-all hover:scale-105"
                        >
                            <RefreshCw className="mr-2 h-4 w-4" />
                            Retry
                        </Button>
                    </div>
                ) : isLoading ? (
                    <div className="text-center py-12">
                        <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                            <RefreshCw className="h-10 w-10 text-primary animate-spin" />
                        </div>
                        <h3 className="text-lg font-semibold mb-2">Loading Files</h3>
                        <p className="text-muted-foreground">Please wait while we fetch the directory contents...</p>
                    </div>
                ) : files ? (
                    <div className="space-y-6">
                        {/* Navigation Controls */}
                        {currentPath !== '.' && (
                            <div className="flex items-center gap-2">
                                <Button
                                    onClick={navigateUp}
                                    variant="outline"
                                    size="sm"
                                    className="transition-all hover:scale-105"
                                >
                                    <ArrowLeft size={14} className="mr-1" />
                                    Back to Parent
                                </Button>
                            </div>
                        )}

                        {/* File List */}
                        <div className="space-y-2">
                            {files.files.length === 0 ? (
                                <div className="text-center py-12">
                                    <div className="w-20 h-20 bg-muted/30 rounded-full flex items-center justify-center mx-auto mb-4">
                                        <Folder className="h-10 w-10 text-muted-foreground" />
                                    </div>
                                    <h3 className="text-lg font-semibold mb-2">Empty Directory</h3>
                                    <p className="text-muted-foreground">This directory contains no files or folders.</p>
                                </div>
                            ) : (
                                files.files
                                    .sort((a, b) => {
                                        // Directories first, then files
                                        if (a.isDir && !b.isDir) return -1;
                                        if (!a.isDir && b.isDir) return 1;
                                        return a.name.localeCompare(b.name);
                                    })
                                    .map((file, index) => (
                                        <div
                                            key={file.name}
                                            className="animate-in slide-in-from-bottom-4 duration-300 group"
                                            style={{ animationDelay: `${index * 50}ms` }}
                                        >
                                            <div className="flex items-center justify-between p-4 rounded-xl bg-gradient-to-r from-muted/30 to-muted/10 border border-border/30 hover:bg-gradient-to-r hover:from-muted/50 hover:to-muted/20 hover:border-border/60 hover:shadow-md transition-all duration-300 group-hover:translate-x-1">
                                                <div 
                                                    className={`flex items-center gap-4 flex-1 ${file.isDir ? 'cursor-pointer' : ''}`}
                                                    onClick={() => file.isDir && handleFileClick(file)}
                                                >
                                                    <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-background border border-border/50">
                                                        {getFileIcon(file.name, file.mimeType || 'application/octet-stream', file.isDir)}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="font-medium text-sm truncate group-hover:text-primary transition-colors">
                                                            {file.name}
                                                        </div>
                                                        <div className="flex items-center gap-2 mt-1">
                                                            <Badge variant={file.isDir ? "secondary" : "outline"} className="text-xs">
                                                                {file.isDir ? 'Directory' : getFileTypeLabel(file.name, file.mimeType || 'application/octet-stream', file.isBinary || false)}
                                                            </Badge>
                                                            {!file.isDir && (
                                                                <span className="text-xs text-muted-foreground">
                                                                    {formatFileSize(file.size)}
                                                                </span>
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
                                                        <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                                                    )}
                                                    {canWrite && (
                                                        <>
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                onClick={() => handleRenameClick(file)}
                                                                className="text-muted-foreground hover:text-foreground hover:bg-muted/50"
                                                                title="Rename"
                                                            >
                                                                <Edit2 size={14} />
                                                            </Button>
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                onClick={() => handleDeleteClick(file)}
                                                                className="text-destructive hover:text-destructive hover:bg-destructive/10"
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
                    <div className="text-center py-12">
                        <div className="w-20 h-20 bg-muted/30 rounded-full flex items-center justify-center mx-auto mb-4">
                            <FolderOpen className="h-10 w-10 text-muted-foreground" />
                        </div>
                        <h3 className="text-lg font-semibold mb-2">Ready to Browse</h3>
                        <p className="text-muted-foreground">Click refresh to load the directory contents.</p>
                    </div>
                )}
            </CardContent>
            
            {/* File Viewer */}
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
            
            {/* Delete Confirmation Dialog */}
            <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-destructive/10 rounded-lg flex items-center justify-center">
                                <Trash2 className="h-4 w-4 text-destructive" />
                            </div>
                            Delete {fileToDelete?.isDir ? 'Directory' : 'File'}
                        </DialogTitle>
                        <DialogDescription className="space-y-2">
                            <p>
                                Are you sure you want to delete <span className="font-mono bg-muted px-1 rounded">{fileToDelete?.name}</span>?
                            </p>
                            {fileToDelete?.isDir && (
                                <p className="text-destructive text-sm">
                                    ⚠️ This will delete the directory and all its contents.
                                </p>
                            )}
                            <p className="text-sm text-muted-foreground">
                                This action cannot be undone.
                            </p>
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => {
                                setDeleteConfirmOpen(false);
                                setFileToDelete(null);
                            }}
                            disabled={isDeleting}
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={deleteFileOrFolder}
                            disabled={isDeleting}
                            className="transition-all hover:scale-105"
                        >
                            {isDeleting ? 'Deleting...' : `Delete ${fileToDelete?.isDir ? 'Directory' : 'File'}`}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Rename Dialog */}
            <Dialog open={renameDialogOpen} onOpenChange={setRenameDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
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
                            <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3">
                                <div className="flex items-center gap-2">
                                    <div className="w-4 h-4 rounded-full bg-destructive flex items-center justify-center flex-shrink-0">
                                        <span className="text-destructive-foreground text-xs font-bold">!</span>
                                    </div>
                                    <p className="text-sm text-destructive font-medium">{renameError}</p>
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
                                disabled={isRenaming}
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
                            disabled={isRenaming}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={renameFile}
                            disabled={isRenaming || !newRenameFileName.trim() || newRenameFileName.trim() === fileToRename?.name}
                        >
                            {isRenaming ? 'Renaming...' : 'Rename'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </Card>
    );
}