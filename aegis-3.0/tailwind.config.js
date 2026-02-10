/** @type {import('tailwindcss').Config} */
export default {
    darkMode: 'class',
    content: [
        './index.html',
        './src/**/*.{js,ts,jsx,tsx}',
    ],
    theme: {
        extend: {
            colors: {
                navy: {
                    950: '#0a0e1a',
                    900: '#0f1420',
                    800: '#1a1f2e',
                    700: '#252b3d',
                    600: '#303750',
                    500: '#3b4363',
                },
                teal: {
                    500: '#06d6a0',
                    400: '#1de4b0',
                    300: '#34f2c0',
                },
                cyan: {
                    500: '#00d4ff',
                    400: '#1ae0ff',
                },
                purple: {
                    500: '#7c3aed',
                    400: '#8b5cf6',
                },
            },
            fontFamily: {
                sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'SF Pro Display', 'sans-serif'],
            },
            backdropBlur: {
                glass: '20px',
            },
            borderRadius: {
                '2xl': '1rem',
                '3xl': '1.5rem',
            },
            boxShadow: {
                'glass': '0 8px 32px 0 rgba(6, 214, 160, 0.1)',
                'glow': '0 0 20px rgba(6, 214, 160, 0.3)',
                'glow-strong': '0 0 40px rgba(6, 214, 160, 0.5)',
            },
            animation: {
                'fade-in': 'fadeIn 0.3s ease-in-out',
                'slide-up': 'slideUp 0.4s ease-out',
                'slide-down': 'slideDown 0.4s ease-out',
                'scale-in': 'scaleIn 0.2s ease-out',
                'pulse-glow': 'pulseGlow 2s ease-in-out infinite',
            },
            keyframes: {
                fadeIn: {
                    '0%': { opacity: '0' },
                    '100%': { opacity: '1' },
                },
                slideUp: {
                    '0%': { transform: 'translateY(20px)', opacity: '0' },
                    '100%': { transform: 'translateY(0)', opacity: '1' },
                },
                slideDown: {
                    '0%': { transform: 'translateY(-20px)', opacity: '0' },
                    '100%': { transform: 'translateY(0)', opacity: '1' },
                },
                scaleIn: {
                    '0%': { transform: 'scale(0.95)', opacity: '0' },
                    '100%': { transform: 'scale(1)', opacity: '1' },
                },
                pulseGlow: {
                    '0%, 100%': { boxShadow: '0 0 20px rgba(6, 214, 160, 0.3)' },
                    '50%': { boxShadow: '0 0 40px rgba(6, 214, 160, 0.6)' },
                },
            },
        },
    },
    plugins: [],
}
