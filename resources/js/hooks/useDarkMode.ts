import { useState, useEffect } from 'react';
import StorageManager from '../utils/storage';

export function useDarkMode() {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const initialValue = StorageManager.theme.isDark();
    setIsDark(initialValue);

    if (initialValue) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, []);

  const toggleDarkMode = () => {
    const newValue = !isDark;
    setIsDark(newValue);
    StorageManager.theme.set(newValue);

    if (newValue) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  return { isDark, toggleDarkMode };
}
