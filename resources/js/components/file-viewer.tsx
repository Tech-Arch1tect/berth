import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { File, Download, Copy, Eye } from 'lucide-react';

interface FileData {
    stack: string;
    path: string;
    content: string;
    size: number;
}

interface FileViewerProps {
    serverId: number;
    stackName: string;
    filePath: string;
    fileName: string;
    isOpen: boolean;
    onClose: () => void;
}

export default function FileViewer({ serverId, stackName, filePath, fileName, isOpen, onClose }: FileViewerProps) {
    const [fileData, setFileData] = useState<FileData | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchFile = async () => {
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
    };

    useEffect(() => {
        fetchFile();
    }, [isOpen, filePath, serverId, stackName]);

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
            const blob = new Blob([fileData.content], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = fileName;
            a.click();
            URL.revokeObjectURL(url);
        }
    };


    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-6xl max-h-[90vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <File size={20} />
                        {fileName}
                        {fileData && (
                            <Badge variant="outline" className="text-xs">
                                {formatFileSize(fileData.size)}
                            </Badge>
                        )}
                    </DialogTitle>
                    {fileData && (
                        <div className="flex items-center gap-2 mt-2">
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
                                <div className="bg-gray-50 dark:bg-gray-800 px-4 py-2 border-b text-sm text-gray-600 dark:text-gray-400">
                                    <span>Path: {fileData.path}</span>
                                    <span className="ml-4">Size: {formatFileSize(fileData.size)}</span>
                                </div>
                                <pre className="bg-gray-900 text-green-400 p-4 text-sm font-mono whitespace-pre-wrap overflow-auto h-full">
                                    {fileData.content}
                                </pre>
                            </div>
                        </div>
                    ) : (
                        <div className="flex items-center justify-center h-64">
                            <div className="text-center text-gray-500 dark:text-gray-400">
                                <Eye className="mx-auto h-12 w-12 mb-4 opacity-50" />
                                <p>Click to view file content</p>
                            </div>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}