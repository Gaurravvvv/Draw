import { useEffect, useState } from 'react';

interface ToastProps {
    message: string;
    visible: boolean;
    onClose: () => void;
    duration?: number;
    type?: 'success' | 'error' | 'info';
}

export const Toast = ({ message, visible, onClose, duration = 2500, type = 'success' }: ToastProps) => {
    const [isShowing, setIsShowing] = useState(false);

    useEffect(() => {
        if (visible) {
            setIsShowing(true);
            const timer = setTimeout(() => {
                setIsShowing(false);
                setTimeout(onClose, 300); // Wait for fade-out animation
            }, duration);
            return () => clearTimeout(timer);
        }
    }, [visible, duration, onClose]);

    if (!visible) return null;

    const bgColor = type === 'error' ? 'bg-red-500' : type === 'info' ? 'bg-blue-500' : 'bg-green-500';

    return (
        <div
            className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] px-6 py-3 rounded-xl text-white text-sm font-medium shadow-lg ${bgColor} transition-all duration-300 ${isShowing ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
                }`}
        >
            {message}
        </div>
    );
};
