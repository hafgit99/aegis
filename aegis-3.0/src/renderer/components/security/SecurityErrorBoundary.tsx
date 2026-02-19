import React, { Component, ErrorInfo } from 'react';
import { ShieldAlert } from 'lucide-react';
import { useTranslation } from '../../i18n/useTranslation';

interface Props {
    children: React.ReactNode;
}

interface State {
    hasError: boolean;
    errorName: string | null;
}

/**
 * SecurityErrorBoundary
 * Captures React component errors to prevent the entire app from crashing,
 * while securely logging the error event without exposing sensitive stack traces to the UI.
 */
class SecurityErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false, errorName: null };
    }

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, errorName: error.name };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        // Log security events safely
        console.error('[SecurityErrorBoundary] Caught error:', error.name);

        // In a real scenario, this would send a sanitized report to the backend
        // window.aegis.security.logEvent('UI_CRASH', { error: error.name, component: errorInfo.componentStack });
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="flex flex-col items-center justify-center p-8 bg-red-900/20 rounded-2xl border border-red-500/30 text-center space-y-4">
                    <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center border border-red-500/30">
                        <ShieldAlert className="w-8 h-8 text-red-500" />
                    </div>
                    <div>
                        <h3 className="text-xl font-bold text-red-400 mb-2">Güvenlik Sınırı İhlali</h3>
                        <p className="text-sm text-red-300/60 leading-relaxed max-w-md mx-auto">
                            Uygulama arayüzünde beklenmeyen bir hata oluştu. Güvenliğiniz için bu bileşen izole edildi.
                        </p>
                    </div>
                    <button
                        onClick={() => window.location.reload()}
                        className="px-6 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg text-sm font-bold transition-transform active:scale-95"
                    >
                        Uygulamayı Yeniden Başlat
                    </button>
                    <p className="text-[10px] font-mono text-red-500/40 uppercase tracking-widest mt-4">
                        ERR_SEC_BOUNDARY_VIOLATION: {this.state.errorName || 'UNKNOWN'}
                    </p>
                </div>
            );
        }

        return this.props.children;
    }
}

export default SecurityErrorBoundary;
