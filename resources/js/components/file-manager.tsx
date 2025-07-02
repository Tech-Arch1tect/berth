import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Folder, File, ArrowLeft, RefreshCw, FolderOpen, Eye, Plus } from 'lucide-react';
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

    const fetchFiles = async (path: string = '.') => {
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
    };

    useEffect(() => {
        fetchFiles('.');
    }, [serverId, stackName]);

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

    return (
        <Card>
            <CardHeader>
                <div className="flex justify-between items-center">
                    <CardTitle className="flex items-center gap-2">
                        <FolderOpen size={20} />
                        {title}
                        {files && (
                            <span className="text-sm text-gray-500 dark:text-gray-400">
                                ({files.files.length} items)
                            </span>
                        )}
                    </CardTitle>
                    <div className="flex items-center gap-2">
                        {canWrite && (
                            <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
                                <DialogTrigger asChild>
                                    <Button variant="outline" size="sm">
                                        <Plus className="mr-2 h-4 w-4" />
                                        Create File
                                    </Button>
                                </DialogTrigger>
                                <DialogContent>
                                    <DialogHeader>
                                        <DialogTitle>Create New File</DialogTitle>
                                        <DialogDescription>
                                            Create a new file in the current directory ({currentPath === '.' ? 'root' : currentPath})
                                        </DialogDescription>
                                    </DialogHeader>
                                    <div className="space-y-4">
                                        <div>
                                            <label htmlFor="fileName" className="text-sm font-medium">
                                                File Name
                                            </label>
                                            <Input
                                                id="fileName"
                                                value={newFileName}
                                                onChange={(e) => setNewFileName(e.target.value)}
                                                placeholder="example.txt"
                                                className="mt-1"
                                            />
                                        </div>
                                        <div>
                                            <label htmlFor="fileContent" className="text-sm font-medium">
                                                File Content
                                            </label>
                                            <textarea
                                                id="fileContent"
                                                value={newFileContent}
                                                onChange={(e) => setNewFileContent(e.target.value)}
                                                placeholder="Enter file content..."
                                                rows={10}
                                                className="mt-1 w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 font-mono resize-vertical"
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
                        >
                            <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                            Refresh
                        </Button>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                {error ? (
                    <div className="text-center py-8 text-red-500 dark:text-red-400">
                        <File className="mx-auto h-12 w-12 mb-4 opacity-50" />
                        <p>{error}</p>
                        <Button
                            onClick={() => fetchFiles(currentPath)}
                            variant="outline"
                            size="sm"
                            className="mt-2"
                        >
                            <RefreshCw className="mr-2 h-4 w-4" />
                            Retry
                        </Button>
                    </div>
                ) : isLoading ? (
                    <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                        <RefreshCw className="mx-auto h-12 w-12 mb-4 animate-spin opacity-50" />
                        <p>Loading files...</p>
                    </div>
                ) : files ? (
                    <div className="space-y-4">
                        {/* Breadcrumb Navigation */}
                        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                            <span>Path:</span>
                            <div className="flex items-center gap-1">
                                {getBreadcrumbs().map((part, index, array) => (
                                    <div key={index} className="flex items-center gap-1">
                                        {index > 0 && <span>/</span>}
                                        <span className="font-mono bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded text-xs">
                                            {part}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Navigation Controls */}
                        <div className="flex items-center gap-2">
                            {currentPath !== '.' && (
                                <Button
                                    onClick={navigateUp}
                                    variant="outline"
                                    size="sm"
                                >
                                    <ArrowLeft size={14} className="mr-1" />
                                    Back
                                </Button>
                            )}
                        </div>

                        {/* File List */}
                        <div className="space-y-1">
                            {files.files.length === 0 ? (
                                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                                    <Folder className="mx-auto h-12 w-12 mb-4 opacity-50" />
                                    <p>This directory is empty</p>
                                </div>
                            ) : (
                                files.files
                                    .sort((a, b) => {
                                        // Directories first, then files
                                        if (a.isDir && !b.isDir) return -1;
                                        if (!a.isDir && b.isDir) return 1;
                                        return a.name.localeCompare(b.name);
                                    })
                                    .map((file) => (
                                        <div
                                            key={file.name}
                                            className="flex items-center justify-between p-3 rounded-lg border dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800"
                                        >
                                            <div 
                                                className={`flex items-center gap-3 flex-1 ${file.isDir ? 'cursor-pointer' : ''}`}
                                                onClick={() => file.isDir && handleFileClick(file)}
                                            >
                                                {file.isDir ? (
                                                    <Folder size={20} className="text-blue-500 dark:text-blue-400" />
                                                ) : (
                                                    <File size={20} className="text-gray-500 dark:text-gray-400" />
                                                )}
                                                <div>
                                                    <div className="font-medium text-sm">
                                                        {file.name}
                                                    </div>
                                                    {!file.isDir && (
                                                        <div className="text-xs text-gray-500 dark:text-gray-400">
                                                            {formatFileSize(file.size)}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                {!file.isDir && (
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => handleFileClick(file)}
                                                    >
                                                        <Eye size={14} className="mr-1" />
                                                        View
                                                    </Button>
                                                )}
                                                <Badge variant={file.isDir ? "secondary" : "outline"} className="text-xs">
                                                    {file.isDir ? 'Directory' : 'File'}
                                                </Badge>
                                            </div>
                                        </div>
                                    ))
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                        <FolderOpen className="mx-auto h-12 w-12 mb-4 opacity-50" />
                        <p>Click refresh to load files</p>
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
                />
            )}
        </Card>
    );
}