import { useState, useRef } from 'react';
import { ConfirmRequest } from '../types';

export function useUI() {
    const [centerAlert, setCenterAlert] = useState<{ message: string; tone?: 'success' | 'error' } | null>(null);
    const [centerConfirm, setCenterConfirm] = useState<ConfirmRequest | null>(null);
    const confirmResolverRef = useRef<((value: boolean) => void) | null>(null);

    const showAlert = (message: string, tone: 'success' | 'error' = 'success') => {
        setCenterAlert({ message, tone });
        if (tone === 'success') {
            setTimeout(() => {
                setCenterAlert((prev) => (prev && prev.message === message ? null : prev));
            }, 2000);
        }
    };

    const requestConfirm = (request: string | ConfirmRequest) => {
        return new Promise<boolean>((resolve) => {
            confirmResolverRef.current = resolve;
            if (typeof request === 'string') {
                setCenterConfirm({ message: request });
            } else {
                setCenterConfirm(request);
            }
        });
    };

    const closeConfirm = (result: boolean) => {
        const resolver = confirmResolverRef.current;
        confirmResolverRef.current = null;
        setCenterConfirm(null);
        if (resolver) resolver(result);
    };

    return {
        centerAlert,
        setCenterAlert,
        centerConfirm,
        showAlert,
        requestConfirm,
        closeConfirm
    };
}
