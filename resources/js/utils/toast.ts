import toast, { Toaster } from 'react-hot-toast';

export const showToast = {
  success: (message: string) =>
    toast.success(message, {
      duration: 4000,
      position: 'bottom-right',
      style: {
        background: '#10b981',
        color: '#ffffff',
        borderRadius: '0.5rem',
        padding: '12px 16px',
        fontSize: '14px',
        fontWeight: '500',
        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
        border: 'none',
      },
      iconTheme: {
        primary: '#ffffff',
        secondary: '#10b981',
      },
    }),

  error: (message: string) =>
    toast.error(message, {
      duration: 4000,
      position: 'bottom-right',
      style: {
        background: '#ef4444',
        color: '#ffffff',
        borderRadius: '0.5rem',
        padding: '12px 16px',
        fontSize: '14px',
        fontWeight: '500',
        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
        border: 'none',
      },
      iconTheme: {
        primary: '#ffffff',
        secondary: '#ef4444',
      },
    }),

  info: (message: string) =>
    toast(message, {
      duration: 4000,
      position: 'bottom-right',
      icon: 'ℹ️',
      style: {
        background: '#3b82f6',
        color: '#ffffff',
        borderRadius: '0.5rem',
        padding: '12px 16px',
        fontSize: '14px',
        fontWeight: '500',
        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
        border: 'none',
      },
    }),

  loading: (message: string) =>
    toast.loading(message, {
      position: 'bottom-right',
      style: {
        background: '#6b7280',
        color: '#ffffff',
        borderRadius: '0.5rem',
        padding: '12px 16px',
        fontSize: '14px',
        fontWeight: '500',
        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
        border: 'none',
      },
    }),

  operation: {
    starting: (message: string) =>
      toast(message, {
        duration: 4000,
        position: 'bottom-right',
        icon: '🚀',
        style: {
          background: '#8b5cf6',
          color: '#ffffff',
          borderRadius: '0.5rem',
          padding: '12px 16px',
          fontSize: '14px',
          fontWeight: '500',
          boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
          border: 'none',
        },
      }),

    completed: (message: string) =>
      toast.success(message, {
        duration: 4000,
        position: 'bottom-right',
        icon: '✅',
        style: {
          background: '#059669',
          color: '#ffffff',
          borderRadius: '0.5rem',
          padding: '12px 16px',
          fontSize: '14px',
          fontWeight: '500',
          boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
          border: 'none',
        },
      }),
  },

  dismiss: () => toast.dismiss(),

  remove: (toastId: string) => toast.dismiss(toastId),
};

export const showToastDark = {
  success: (message: string) =>
    toast.success(message, {
      duration: 4000,
      position: 'bottom-right',
      style: {
        background: '#065f46',
        color: '#d1fae5',
        borderRadius: '0.5rem',
        padding: '12px 16px',
        fontSize: '14px',
        fontWeight: '500',
        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.3), 0 4px 6px -2px rgba(0, 0, 0, 0.15)',
        border: '1px solid #10b981',
      },
      iconTheme: {
        primary: '#d1fae5',
        secondary: '#065f46',
      },
    }),

  error: (message: string) =>
    toast.error(message, {
      duration: 4000,
      position: 'bottom-right',
      style: {
        background: '#7f1d1d',
        color: '#fecaca',
        borderRadius: '0.5rem',
        padding: '12px 16px',
        fontSize: '14px',
        fontWeight: '500',
        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.3), 0 4px 6px -2px rgba(0, 0, 0, 0.15)',
        border: '1px solid #ef4444',
      },
      iconTheme: {
        primary: '#fecaca',
        secondary: '#7f1d1d',
      },
    }),

  info: (message: string) =>
    toast(message, {
      duration: 4000,
      position: 'bottom-right',
      icon: 'ℹ️',
      style: {
        background: '#1e40af',
        color: '#dbeafe',
        borderRadius: '0.5rem',
        padding: '12px 16px',
        fontSize: '14px',
        fontWeight: '500',
        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.3), 0 4px 6px -2px rgba(0, 0, 0, 0.15)',
        border: '1px solid #3b82f6',
      },
    }),
};

export { Toaster };

export default toast;
