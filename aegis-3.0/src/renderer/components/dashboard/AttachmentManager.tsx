import React, { useState, useEffect, useRef } from 'react';
import { Paperclip, Trash2, Download, Plus, FileCode, FileText, Image, File as FileIcon, Loader2, X, Eye, ZoomIn, ZoomOut } from 'lucide-react';
import { useTranslation } from '../../i18n/useTranslation';
import { motion, AnimatePresence } from 'framer-motion';

interface Attachment {
    id: string;
    filename: string;
    mimeType: string | null;
    size: number;
    createdAt: number;
}

interface AttachmentManagerProps {
    entryId: string;
}

// File Preview Modal Component
const FilePreviewModal: React.FC<{
    file: Attachment;
    data: string;
    onClose: () => void;
}> = ({ file, data, onClose }) => {
    const { t } = useTranslation();
    const [zoom, setZoom] = useState(100);

    const renderPreview = () => {
        if (!file.mimeType) return null;

        // Image preview
        if (file.mimeType.startsWith('image/')) {
            const bytes = new Uint8Array(data.length / 2);
            for (let i = 0; i < data.length; i += 2) {
                bytes[i / 2] = parseInt(data.substring(i, i + 2), 16);
            }
            const blob = new Blob([bytes], { type: file.mimeType });
            const url = URL.createObjectURL(blob);

            return (
                <div className="relative flex items-center justify-center min-h-[400px] bg-black/20 rounded-2xl overflow-hidden">
                    <img
                        src={url}
                        alt={file.filename}
                        style={{ transform: `scale(${zoom / 100})` }}
                        className="max-w-full max-h-[70vh] object-contain transition-transform duration-200"
                    />
                    <div className="absolute bottom-4 right-4 flex gap-2">
                        <button
                            onClick={() => setZoom(Math.max(50, zoom - 25))}
                            className="p-2 bg-navy-900/90 hover:bg-navy-800 rounded-lg text-white/80 hover:text-white transition-all"
                        >
                            <ZoomOut size={18} />
                        </button>
                        <button
                            onClick={() => setZoom(100)}
                            className="px-3 py-2 bg-navy-900/90 hover:bg-navy-800 rounded-lg text-white/80 hover:text-white text-xs font-bold transition-all"
                        >
                            {zoom}%
                        </button>
                        <button
                            onClick={() => setZoom(Math.min(200, zoom + 25))}
                            className="p-2 bg-navy-900/90 hover:bg-navy-800 rounded-lg text-white/80 hover:text-white transition-all"
                        >
                            <ZoomIn size={18} />
                        </button>
                    </div>
                </div>
            );
        }

        // PDF preview (basic info)
        if (file.mimeType.includes('pdf')) {
            return (
                <div className="flex flex-col items-center justify-center min-h-[400px] bg-white/5 rounded-2xl p-8">
                    <FileText className="w-24 h-24 text-red-400 mb-4" />
                    <p className="text-white/60 text-sm mb-2">{t('entry.attachments.preview')}</p>
                    <p className="text-white/40 text-xs">{file.filename}</p>
                    <p className="text-white/20 text-xs mt-4">
                        {t('entry.attachments.download')} to view full content
                    </p>
                </div>
            );
        }

        // Text/Code preview
        if (file.mimeType.includes('text') || file.mimeType.includes('json') || file.mimeType.includes('javascript')) {
            try {
                const bytes = new Uint8Array(data.length / 2);
                for (let i = 0; i < data.length; i += 2) {
                    bytes[i / 2] = parseInt(data.substring(i, i + 2), 16);
                }
                const text = new TextDecoder().decode(bytes);
                const preview = text.substring(0, 5000); // Limit preview

                return (
                    <div className="bg-navy-950/50 rounded-2xl p-6 max-h-[70vh] overflow-auto">
                        <pre className="text-xs text-white/70 font-mono whitespace-pre-wrap break-words">
                            {preview}
                            {text.length > 5000 && '\n\n... (truncated)'}
                        </pre>
                    </div>
                );
            } catch (e) {
                return <div className="text-white/40 text-sm">Unable to preview text content</div>;
            }
        }

        return (
            <div className="flex flex-col items-center justify-center min-h-[400px] bg-white/5 rounded-2xl p-8">
                <FileIcon className="w-24 h-24 text-white/20 mb-4" />
                <p className="text-white/40 text-sm">Preview not available for this file type</p>
            </div>
        );
    };

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-navy-900 rounded-3xl border border-white/10 w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
            >
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-white/5">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-500/20 rounded-xl">
                            <Eye className="w-5 h-5 text-indigo-400" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-white">{file.filename}</h3>
                            <p className="text-xs text-white/40">
                                {(file.size / 1024).toFixed(1)} KB • {file.mimeType || 'Unknown'}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-white/5 rounded-xl text-white/40 hover:text-white transition-all"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Preview Content */}
                <div className="flex-1 overflow-auto p-6">
                    {renderPreview()}
                </div>
            </motion.div>
        </div>
    );
};

const AttachmentManager: React.FC<AttachmentManagerProps> = ({ entryId }) => {
    const { t } = useTranslation();
    const [attachments, setAttachments] = useState<Attachment[]>([]);
    const [loading, setLoading] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [previewFile, setPreviewFile] = useState<{ file: Attachment; data: string } | null>(null);
    const [uploadProgress, setUploadProgress] = useState(0);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

    const loadAttachments = async () => {
        try {
            setLoading(true);
            const list = await window.aegis.database.getAttachments(entryId);
            setAttachments(list);
        } catch (error) {
            console.error('Failed to load attachments:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (entryId) {
            loadAttachments();
        }
    }, [entryId]);

    const compressImage = async (file: File): Promise<Blob> => {
        return new Promise((resolve, reject) => {
            const img = new window.Image();
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');

            img.onload = () => {
                // Calculate new dimensions (max 1920x1080)
                let width = img.width;
                let height = img.height;
                const maxWidth = 1920;
                const maxHeight = 1080;

                if (width > maxWidth || height > maxHeight) {
                    const ratio = Math.min(maxWidth / width, maxHeight / height);
                    width = width * ratio;
                    height = height * ratio;
                }

                canvas.width = width;
                canvas.height = height;
                ctx?.drawImage(img, 0, 0, width, height);

                canvas.toBlob(
                    (blob) => {
                        if (blob) {
                            resolve(blob);
                        } else {
                            reject(new Error('Compression failed'));
                        }
                    },
                    'image/jpeg',
                    0.85 // Quality
                );
            };

            img.onerror = reject;
            img.src = URL.createObjectURL(file);
        });
    };

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.size > MAX_FILE_SIZE) {
            alert(t('entry.attachments.limit'));
            return;
        }

        try {
            setUploading(true);
            setUploadProgress(0);

            let processedFile: Blob = file;

            // Compress images
            if (file.type.startsWith('image/')) {
                setUploadProgress(20);
                processedFile = await compressImage(file);
            }

            setUploadProgress(40);

            const reader = new FileReader();

            reader.onload = async () => {
                try {
                    const arrayBuffer = reader.result as ArrayBuffer;
                    const uint8Array = new Uint8Array(arrayBuffer);

                    setUploadProgress(60);

                    // Convert to hex
                    let hex = '';
                    for (let i = 0; i < uint8Array.length; i++) {
                        hex += uint8Array[i].toString(16).padStart(2, '0');
                    }

                    setUploadProgress(80);

                    await window.aegis.database.saveAttachment({
                        id: crypto.randomUUID(),
                        entryId,
                        filename: file.name,
                        mimeType: file.type || 'application/octet-stream',
                        data: hex
                    });

                    setUploadProgress(100);
                    loadAttachments();
                } catch (err) {
                    console.error('File processing error:', err);
                    alert(t('common.error'));
                } finally {
                    setUploading(false);
                    setUploadProgress(0);
                }
            };

            reader.onerror = () => {
                setUploading(false);
                setUploadProgress(0);
                alert(t('common.error'));
            };

            reader.readAsArrayBuffer(processedFile);
        } catch (error) {
            console.error('Upload initiation failed:', error);
            setUploading(false);
            setUploadProgress(0);
            alert(t('common.error'));
        } finally {
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm(t('entry.attachments.deleteConfirm'))) return;

        try {
            await window.aegis.database.deleteAttachment(id);
            loadAttachments();
        } catch (error) {
            console.error('Delete failed:', error);
        }
    };

    const handleDownload = async (attachment: Attachment) => {
        try {
            const hex = await window.aegis.database.getAttachmentData(attachment.id);

            const bytes = new Uint8Array(hex.length / 2);
            for (let i = 0; i < hex.length; i += 2) {
                bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
            }

            const blob = new Blob([bytes], { type: attachment.mimeType || 'application/octet-stream' });
            const url = URL.createObjectURL(blob);

            const a = document.createElement('a');
            a.href = url;
            a.download = attachment.filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Download failed:', error);
        }
    };

    const handlePreview = async (attachment: Attachment) => {
        try {
            const hex = await window.aegis.database.getAttachmentData(attachment.id);
            setPreviewFile({ file: attachment, data: hex });
        } catch (error) {
            console.error('Preview failed:', error);
        }
    };

    const getFileIcon = (mime: string | null) => {
        if (!mime) return <FileIcon size={20} />;
        if (mime.startsWith('image/')) return <Image size={20} />;
        if (mime.includes('pdf')) return <FileText size={20} />;
        if (mime.includes('javascript') || mime.includes('json') || mime.includes('html')) return <FileCode size={20} />;
        return <FileIcon size={20} />;
    };

    const formatSize = (bytes: number) => {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };

    const canPreview = (mime: string | null) => {
        if (!mime) return false;
        return mime.startsWith('image/') || mime.includes('pdf') || mime.includes('text') || mime.includes('json');
    };

    return (
        <>
            <div className="space-y-4 py-4 border-t border-white/5 mt-4">
                <div className="flex items-center justify-between">
                    <h3 className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em] flex items-center gap-2">
                        <Paperclip size={14} className="text-indigo-400" />
                        {t('entry.attachments.title')}
                    </h3>
                    <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploading}
                        className="flex items-center gap-2 px-3 py-1.5 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 rounded-lg border border-indigo-500/20 transition-all text-[10px] font-bold uppercase tracking-wider disabled:opacity-50"
                    >
                        {uploading ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
                        {t('entry.attachments.add')}
                    </button>
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleUpload}
                        className="hidden"
                    />
                </div>

                {/* Upload Progress */}
                {uploading && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="space-y-2"
                    >
                        <div className="flex justify-between text-xs">
                            <span className="text-white/40">{t('entry.attachments.encrypting')}</span>
                            <span className="text-indigo-400 font-bold">{uploadProgress}%</span>
                        </div>
                        <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                            <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${uploadProgress}%` }}
                                className="h-full bg-gradient-to-r from-indigo-500 to-purple-500"
                            />
                        </div>
                    </motion.div>
                )}

                {loading ? (
                    <div className="flex justify-center p-4">
                        <Loader2 className="w-6 h-6 text-indigo-500 animate-spin" />
                    </div>
                ) : attachments.length === 0 ? (
                    <div className="text-center p-6 bg-navy-950/30 border border-dashed border-white/5 rounded-2xl">
                        <p className="text-white/20 text-[10px] uppercase font-bold tracking-widest">{t('entry.attachments.empty')}</p>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {attachments.map((file) => (
                            <motion.div
                                key={file.id}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="group flex items-center justify-between p-3 bg-navy-950/50 border border-white/5 rounded-xl hover:border-indigo-500/30 transition-all"
                            >
                                <div className="flex items-center gap-3 overflow-hidden flex-1">
                                    <div className="p-2 bg-indigo-500/10 rounded-lg text-indigo-400">
                                        {getFileIcon(file.mimeType)}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="text-xs font-bold text-white truncate" title={file.filename}>
                                            {file.filename}
                                        </p>
                                        <p className="text-[9px] text-white/30 uppercase font-black tracking-tight">
                                            {formatSize(file.size)} • {new Date(file.createdAt * 1000).toLocaleDateString()}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    {canPreview(file.mimeType) && (
                                        <button
                                            type="button"
                                            onClick={() => handlePreview(file)}
                                            className="p-2 hover:bg-white/5 rounded-lg text-white/40 hover:text-indigo-400 transition-colors"
                                            title={t('entry.attachments.preview')}
                                        >
                                            <Eye size={14} />
                                        </button>
                                    )}
                                    <button
                                        type="button"
                                        onClick={() => handleDownload(file)}
                                        className="p-2 hover:bg-white/5 rounded-lg text-white/40 hover:text-white transition-colors"
                                        title={t('entry.attachments.download')}
                                    >
                                        <Download size={14} />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleDelete(file.id)}
                                        className="p-2 hover:bg-red-500/10 rounded-lg text-white/40 hover:text-red-400 transition-colors"
                                        title={t('common.delete')}
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                )}
            </div>

            {/* Preview Modal */}
            <AnimatePresence>
                {previewFile && (
                    <FilePreviewModal
                        file={previewFile.file}
                        data={previewFile.data}
                        onClose={() => setPreviewFile(null)}
                    />
                )}
            </AnimatePresence>
        </>
    );
};

export default AttachmentManager;
