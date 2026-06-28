import Toast from 'react-native-toast-message';

export function showNotification(type: 'success' | 'error' | 'info', message: string, description?: string) {
  const icons = {
    success: '✅',
    error: '⚠️',
    info: 'ℹ️',
  };

  Toast.show({
    type,
    text1: `${icons[type]} ${message}`,
    text2: description,
    position: 'top',
    visibilityTime: 3000,
    topOffset: 60,
  });
}

export function showSuccess(msg: string) {
  showNotification('success', msg);
}

export function showError(msg: string) {
  showNotification('error', msg);
}

export function showInfo(msg: string) {
  showNotification('info', msg);
}
