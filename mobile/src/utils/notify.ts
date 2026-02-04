import { showMessage } from 'react-native-flash-message';

export const showSuccess = (title: string, message?: string) => {
  showMessage({ message: title, description: message, type: 'success', icon: 'success' });
};

export const showError = (title: string, message?: string) => {
  showMessage({ message: title, description: message, type: 'danger', icon: 'danger' });
};

export const showInfo = (title: string, message?: string) => {
  showMessage({ message: title, description: message, type: 'info', icon: 'auto' });
};
