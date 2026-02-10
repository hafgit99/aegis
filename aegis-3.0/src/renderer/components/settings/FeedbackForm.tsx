import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { MessageSquare, Send, Check } from 'lucide-react';
import { useTranslation } from '../../i18n/useTranslation';

const FeedbackForm: React.FC = () => {
    const { t } = useTranslation();
    const [message, setMessage] = useState('');
    const [email, setEmail] = useState('');
    const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setStatus('sending');

        // Mock sending feedback (In real app, this sends to a backend or GitHub Issues)
        try {
            await new Promise(resolve => setTimeout(resolve, 1500));
            console.log('Feedback sent:', { email, message });
            setStatus('sent');
            setMessage('');
            setEmail('');
            setTimeout(() => setStatus('idle'), 3000);
        } catch (err) {
            setStatus('error');
        }
    };

    return (
        <div className="glass-card p-6 rounded-2xl max-w-2xl mx-auto">
            <div className="flex items-center gap-3 mb-6">
                <div className="p-3 bg-blue-500/20 rounded-xl">
                    <MessageSquare className="w-6 h-6 text-blue-400" />
                </div>
                <div>
                    <h3 className="text-xl font-bold text-white">Geri Bildirim Gönder</h3>
                    <p className="text-white/50 text-sm">Aegis 3.0 deneyiminizi iyileştirmemize yardımcı olun.</p>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-white/70 mb-1">E-posta (İsteğe bağlı)</label>
                    <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="user@example.com"
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500/50 transition-colors"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-white/70 mb-1">Mesajınız</label>
                    <textarea
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        required
                        placeholder="Önerilerinizi veya hataları bildirin..."
                        rows={4}
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500/50 transition-colors resize-none"
                    />
                </div>

                <div className="flex justify-end">
                    <button
                        type="submit"
                        disabled={status === 'sending' || status === 'sent'}
                        className={`
                            flex items-center gap-2 px-6 py-2 rounded-lg font-medium transition-all
                            ${status === 'sent'
                                ? 'bg-emerald-500/20 text-emerald-400 cursor-default'
                                : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white'}
                        `}
                    >
                        {status === 'sending' ? (
                            <span className="animate-pulse">Gönderiliyor...</span>
                        ) : status === 'sent' ? (
                            <>
                                <Check className="w-4 h-4" />
                                Gönderildi
                            </>
                        ) : (
                            <>
                                <Send className="w-4 h-4" />
                                Gönder
                            </>
                        )}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default FeedbackForm;
