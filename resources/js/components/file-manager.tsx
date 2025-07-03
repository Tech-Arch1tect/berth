import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Folder, File, ArrowLeft, RefreshCw, FolderOpen, Eye, Plus, Trash2, ChevronRight, Home } from 'lucide-react';
import FileViewer from '@/components/file-viewer';

interface FileInfo {
    name: string;
    isDir: boolean;
    size: number;
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
    const [newFileName, setNewFileName] = useState('');
    const [newFileContent, setNewFileContent] = useState('');
    const [isCreating, setIsCreating] = useState(false);
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
    const [fileToDelete, setFileToDelete] = useState<FileInfo | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

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

    const createFile = async () => {
        if (!newFileName.trim()) {
            setError('File name is required');
            return;
        }

        setIsCreating(true);
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
                    content: newFileContent
                })
            });

            if (response.ok) {
                setCreateDialogOpen(false);
                setNewFileName('');
                setNewFileContent('');
                await fetchFiles(currentPath); // Refresh the file list
            } else {
                const errorData = await response.json();
                setError(errorData.error || 'Failed to create file');
            }
        } catch (err) {
            setError(`Failed to create file: ${err}`);
        } finally {
            setIsCreating(false);
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
                                <DialogContent className="max-w-2xl">
                                    <DialogHeader>
                                        <DialogTitle className="flex items-center gap-2">
                                            <Plus className="h-5 w-5 text-primary" />
                                            Create New File
                                        </DialogTitle>
                                        <DialogDescription>
                                            Create a new file in <span className="font-mono bg-muted px-1 rounded">{currentPath === '.' ? 'root' : currentPath}</span>
                                        </DialogDescription>
                                    </DialogHeader>
                                    <div className="space-y-6">
                                        <div className="space-y-2">
                                            <label htmlFor="fileName" className="text-sm font-semibold">
                                                File Name
                                            </label>
                                            <Input
                                                id="fileName"
                                                value={newFileName}
                                                onChange={(e) => setNewFileName(e.target.value)}
                                                placeholder="example.txt"
                                                className="font-mono"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label htmlFor="fileContent" className="text-sm font-semibold">
                                                File Content
                                            </label>
                                            <textarea
                                                id="fileContent"
                                                value={newFileContent}
                                                onChange={(e) => setNewFileContent(e.target.value)}
                                                placeholder="Enter file content..."
                                                rows={12}
                                                className="w-full px-3 py-3 border border-border rounded-lg text-sm bg-card text-card-foreground font-mono resize-vertical focus:ring-2 focus:ring-ring focus:border-transparent"
                                            />
                                        </div>
                                    </div>
                                    <DialogFooter>
                                        <Button
                                            variant="outline"
                                            onClick={() => {
                                                setCreateDialogOpen(false);
                                                setNewFileName('');
                                                setNewFileContent('');
                                            }}
                                        >
                                            Cancel
                                        </Button>
                                        <Button
                                            onClick={createFile}
                                            disabled={isCreating || !newFileName.trim()}
                                            className="transition-all hover:scale-105"
                                        >
                                            {isCreating ? 'Creating...' : 'Create File'}
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
            <CardContent>
                {error ? (
                    <div className="text-center py-12">
                        <div className="w-20 h-20 bg-destructive/10 rounded-full flex items-center justify-center mx-auto mb-4">
                            <File className="h-10 w-10 text-destructive" />
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
                                            <div className="flex items-center justify-between p-4 rounded-xl bg-muted/20 border border-border/50 hover:bg-muted/40 hover:border-border transition-all duration-200">
                                                <div 
                                                    className={`flex items-center gap-4 flex-1 ${file.isDir ? 'cursor-pointer' : ''}`}
                                                    onClick={() => file.isDir && handleFileClick(file)}
                                                >
                                                    <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-background border border-border/50">
                                                        {file.isDir ? (
                                                            <Folder className="h-5 w-5 text-blue-500" />
                                                        ) : (
                                                            <File className="h-5 w-5 text-muted-foreground" />
                                                        )}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="font-medium text-sm truncate group-hover:text-primary transition-colors">
                                                            {file.name}
                                                        </div>
                                                        <div className="flex items-center gap-2 mt-1">
                                                            <Badge variant={file.isDir ? "secondary" : "outline"} className="text-xs">
                                                                {file.isDir ? 'Directory' : 'File'}
                                                            </Badge>
                                                            {!file.isDir && (
                                                                <span className="text-xs text-muted-foreground">
                                                                    {formatFileSize(file.size)}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    {!file.isDir && (
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => handleFileClick(file)}
                                                            className="transition-all hover:scale-105"
                                                        >
                                                            <Eye size={14} className="mr-1" />
                                                            View
                                                        </Button>
                                                    )}
                                                    {file.isDir && (
                                                        <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                                                    )}
                                                    {canWrite && (
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => handleDeleteClick(file)}
                                                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                                        >
                                                            <Trash2 size={14} />
                                                        </Button>
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
        </Card>
    );
}