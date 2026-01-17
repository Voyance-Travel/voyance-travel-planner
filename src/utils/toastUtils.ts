/**
 * Toast Utilities
 * Enhanced toast notifications using sonner (project's toast library)
 */

import { toast } from 'sonner';

export interface ToastOptions {
  duration?: number;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

/**
 * Toast utility functions
 */
export const toastUtils = {
  /**
   * Show success toast
   */
  success: (message: string, options?: ToastOptions) => {
    return toast.success(message, {
      duration: options?.duration ?? 4000,
      description: options?.description,
      action: options?.action,
    });
  },

  /**
   * Show error toast
   */
  error: (message: string, options?: ToastOptions) => {
    return toast.error(message, {
      duration: options?.duration ?? 5000,
      description: options?.description,
      action: options?.action,
    });
  },

  /**
   * Show warning toast
   */
  warning: (message: string, options?: ToastOptions) => {
    return toast.warning(message, {
      duration: options?.duration ?? 4000,
      description: options?.description,
      action: options?.action,
    });
  },

  /**
   * Show info toast
   */
  info: (message: string, options?: ToastOptions) => {
    return toast.info(message, {
      duration: options?.duration ?? 4000,
      description: options?.description,
      action: options?.action,
    });
  },

  /**
   * Show loading toast with promise
   */
  promise: <T>(
    promise: Promise<T>,
    messages: {
      loading: string;
      success: string | ((data: T) => string);
      error: string | ((error: Error) => string);
    }
  ) => {
    return toast.promise(promise, messages);
  },

  /**
   * Show loading toast (returns dismiss function)
   */
  loading: (message: string) => {
    return toast.loading(message);
  },

  /**
   * Dismiss a specific toast
   */
  dismiss: (toastId?: string | number) => {
    toast.dismiss(toastId);
  },

  /**
   * Dismiss all toasts
   */
  dismissAll: () => {
    toast.dismiss();
  },

  // Convenience methods for common actions

  /**
   * Show "saved" success toast
   */
  saved: (item = 'Changes') => {
    return toast.success(`${item} saved successfully`);
  },

  /**
   * Show "deleted" success toast
   */
  deleted: (item = 'Item') => {
    return toast.success(`${item} deleted`);
  },

  /**
   * Show "copied" success toast
   */
  copied: (item = 'Text') => {
    return toast.success(`${item} copied to clipboard`);
  },

  /**
   * Show network error toast
   */
  networkError: () => {
    return toast.error('Network error. Please check your connection.');
  },

  /**
   * Show generic error toast
   */
  genericError: () => {
    return toast.error('Something went wrong. Please try again.');
  },

  /**
   * Show form validation error
   */
  validationError: (message = 'Please check the form for errors') => {
    return toast.error(message);
  },

  /**
   * Show action with undo
   */
  withUndo: (message: string, onUndo: () => void, duration = 5000) => {
    return toast(message, {
      duration,
      action: {
        label: 'Undo',
        onClick: onUndo,
      },
    });
  },
};

// Default export for simple usage
export default toastUtils;
