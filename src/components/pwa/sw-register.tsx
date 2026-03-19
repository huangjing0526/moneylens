'use client';

import { useEffect } from 'react';
import { toast } from 'sonner';

export function SWRegister() {
  useEffect(() => {
    // Only register in production
    if (
      typeof window === 'undefined' ||
      !('serviceWorker' in navigator) ||
      window.location.hostname === 'localhost'
    ) {
      return;
    }

    registerServiceWorker();
  }, []);

  return null;
}

async function registerServiceWorker() {
  try {
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/',
    });

    // Check for updates
    registration.addEventListener('updatefound', () => {
      const newWorker = registration.installing;
      if (!newWorker) return;

      newWorker.addEventListener('statechange', () => {
        if (
          newWorker.state === 'installed' &&
          navigator.serviceWorker.controller
        ) {
          // New version available
          toast('有新版本可用', {
            description: '点击刷新以更新到最新版本',
            action: {
              label: '刷新',
              onClick: () => {
                newWorker.postMessage({ type: 'SKIP_WAITING' });
                window.location.reload();
              },
            },
            duration: Infinity,
          });
        }
      });
    });
  } catch (error) {
    console.error('Service Worker registration failed:', error);
  }
}
