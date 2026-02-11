import { useState, useRef, useCallback } from 'react';
import { ConfirmRequest } from '../types';

export function useUI() {
    const [centerAlert, setCenterAlert] = useState<{ message: string; tone?: 'success' | 'error' } | null>(null);
    const [centerConfirm, setCenterConfirm] = useState<ConfirmRequest | null>(null);
    const confirmResolverRef = useRef<((value: boolean) => void) | null>(null);

    // Memoize showAlert to ensure stable function reference for consumers
    const showAlert = useCallback((message: string, tone: 'success' | 'error' = 'success') => {
        setCenterAlert({ message, tone });
        if (tone === 'success') {
            setTimeout(() => {
                setCenterAlert((prev) => (prev && prev.message === message ? null : prev));
            }, 2000);
        }
    }, []);

    // Memoize requestConfirm to ensure stable function reference for consumers
    const requestConfirm = useCallback((request: string | ConfirmRequest) => {
        return new Promise<boolean>((resolve) => {
            confirmResolverRef.current = resolve;
            if (typeof request === 'string') {
                setCenterConfirm({ message: request });
            } else {
                setCenterConfirm(request);
            }
        });
    }, []);

    // Memoize closeConfirm to ensure stable function reference for consumers
    const closeConfirm = useCallback((result: boolean) => {
        const resolver = confirmResolverRef.current;
        confirmResolverRef.current = null;
        setCenterConfirm(null);
        if (resolver) resolver(result);
    }, []);

    return {
        centerAlert,
        setCenterAlert,
        centerConfirm,
        showAlert,
        requestConfirm,
        closeConfirm
    };
}
