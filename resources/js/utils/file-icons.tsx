import { Code, Cog, Database, File, FileArchive, FileAudio, FileImage, FileSpreadsheet, FileText, FileVideo, Folder } from 'lucide-react';

export function getFileIcon(fileName: string, mimeType: string, isDir: boolean) {
    if (isDir) {
        return <Folder className="h-5 w-5 text-blue-500" />;
    }

    const ext = fileName.split('.').pop()?.toLowerCase() || '';

    if (mimeType.startsWith('text/')) {
        return <FileText className="h-5 w-5 text-gray-600" />;
    }

    if (mimeType.startsWith('image/')) {
        return <FileImage className="h-5 w-5 text-green-500" />;
    }

    if (mimeType.startsWith('video/')) {
        return <FileVideo className="h-5 w-5 text-purple-500" />;
    }

    if (mimeType.startsWith('audio/')) {
        return <FileAudio className="h-5 w-5 text-pink-500" />;
    }

    if (mimeType.includes('json') || mimeType.includes('xml') || mimeType.includes('yaml')) {
        return <Code className="h-5 w-5 text-blue-600" />;
    }

    if (mimeType.includes('zip') || mimeType.includes('tar') || mimeType.includes('gzip') || mimeType.includes('archive')) {
        return <FileArchive className="h-5 w-5 text-orange-500" />;
    }

    if (mimeType.includes('spreadsheet') || mimeType.includes('excel') || mimeType.includes('csv')) {
        return <FileSpreadsheet className="h-5 w-5 text-green-600" />;
    }

    if (mimeType.includes('database') || mimeType.includes('sqlite')) {
        return <Database className="h-5 w-5 text-blue-800" />;
    }

    const codeExtensions = ['js', 'ts', 'jsx', 'tsx', 'py', 'go', 'php', 'rb', 'java', 'cpp', 'c', 'cs', 'rs', 'swift', 'kt'];
    const configExtensions = ['json', 'yaml', 'yml', 'toml', 'ini', 'conf', 'config', 'env'];
    const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'webp', 'ico'];
    const archiveExtensions = ['zip', 'tar', 'gz', 'bz2', '7z', 'rar', 'xz'];
    const dockerExtensions = ['dockerfile'];
    const textExtensions = ['txt', 'md', 'log', 'csv', 'readme'];

    if (codeExtensions.includes(ext)) {
        return <Code className="h-5 w-5 text-blue-600" />;
    }

    if (configExtensions.includes(ext) || fileName.toLowerCase().includes('compose')) {
        return <Cog className="h-5 w-5 text-yellow-600" />;
    }

    if (imageExtensions.includes(ext)) {
        return <FileImage className="h-5 w-5 text-green-500" />;
    }

    if (archiveExtensions.includes(ext)) {
        return <FileArchive className="h-5 w-5 text-orange-500" />;
    }

    if (dockerExtensions.includes(ext) || fileName.toLowerCase().includes('docker')) {
        return <Code className="h-5 w-5 text-blue-500" />;
    }

    if (textExtensions.includes(ext)) {
        return <FileText className="h-5 w-5 text-gray-600" />;
    }

    return <File className="h-5 w-5 text-gray-500" />;
}

export function getFileTypeLabel(fileName: string, mimeType: string, isBinary: boolean): string {
    if (mimeType.startsWith('text/')) {
        return 'Text';
    }

    if (mimeType.startsWith('image/')) {
        return 'Image';
    }

    if (mimeType.startsWith('video/')) {
        return 'Video';
    }

    if (mimeType.startsWith('audio/')) {
        return 'Audio';
    }

    if (mimeType.includes('json')) {
        return 'JSON';
    }

    if (mimeType.includes('yaml')) {
        return 'YAML';
    }

    if (mimeType.includes('xml')) {
        return 'XML';
    }

    if (mimeType.includes('javascript')) {
        return 'JavaScript';
    }

    if (mimeType.includes('zip') || mimeType.includes('archive')) {
        return 'Archive';
    }

    if (mimeType.includes('pdf')) {
        return 'PDF';
    }

    if (isBinary) {
        return 'Binary';
    }

    const ext = fileName.split('.').pop()?.toUpperCase();
    return ext || 'File';
}

export function formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B';

    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

export function isPreviewable(mimeType: string): boolean {
    return (
        mimeType.startsWith('image/') ||
        mimeType.startsWith('text/') ||
        mimeType.includes('json') ||
        mimeType.includes('xml') ||
        mimeType.includes('yaml') ||
        mimeType.includes('javascript')
    );
}

export function isEditable(mimeType: string, isBinary: boolean): boolean {
    if (isBinary) return false;

    return (
        mimeType.startsWith('text/') ||
        mimeType.includes('json') ||
        mimeType.includes('xml') ||
        mimeType.includes('yaml') ||
        mimeType.includes('javascript') ||
        mimeType.includes('x-sh') ||
        mimeType.includes('x-perl') ||
        mimeType.includes('x-python') ||
        mimeType.includes('x-ruby') ||
        mimeType.includes('sql') ||
        mimeType.includes('dockerfile')
    );
}
