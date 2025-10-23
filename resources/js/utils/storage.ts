type StorageKey =
  | 'darkMode'
  | 'berth_operations_state'
  | 'sidebar_collapsed'
  | 'preferred_tab'
  | 'stacks_layout'
  | 'stacks_sort';

interface StorageValue {
  darkMode: 'true' | 'false';
  berth_operations_state: string;
  sidebar_collapsed: 'true' | 'false';
  preferred_tab: string;
  stacks_layout: 'compact' | 'normal';
  stacks_sort:
    | 'name-asc'
    | 'name-desc'
    | 'health-asc'
    | 'health-desc'
    | 'containers-asc'
    | 'containers-desc';
}

class StorageManagerClass {
  private getItem<K extends StorageKey>(key: K): StorageValue[K] | null {
    try {
      const value = localStorage.getItem(key);
      return value as StorageValue[K] | null;
    } catch (error) {
      console.error(`[StorageManager] Failed to get ${key} from localStorage:`, error);
      return null;
    }
  }

  private setItem<K extends StorageKey>(key: K, value: StorageValue[K]): void {
    try {
      localStorage.setItem(key, String(value));
    } catch (error) {
      console.error(`[StorageManager] Failed to set ${key} in localStorage:`, error);
    }
  }

  private removeItem(key: StorageKey): void {
    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.error(`[StorageManager] Failed to remove ${key} from localStorage:`, error);
    }
  }

  theme = {
    get: (): 'dark' | 'light' | null => {
      const value = this.getItem('darkMode');
      if (value === 'true') return 'dark';
      if (value === 'false') return 'light';
      return null;
    },

    set: (isDark: boolean): void => {
      this.setItem('darkMode', isDark ? 'true' : 'false');
    },

    isDark: (): boolean => {
      const value = this.getItem('darkMode');
      return value === 'true';
    },

    clear: (): void => {
      this.removeItem('darkMode');
    },
  };

  operations = {
    get: (): any => {
      const data = this.getItem('berth_operations_state');
      if (!data) return null;
      try {
        return JSON.parse(data);
      } catch (error) {
        console.error('[StorageManager] Failed to parse operations state:', error);
        return null;
      }
    },

    set: (value: any): void => {
      try {
        this.setItem('berth_operations_state', JSON.stringify(value));
      } catch (error) {
        console.error('[StorageManager] Failed to stringify operations state:', error);
      }
    },

    clear: (): void => {
      this.removeItem('berth_operations_state');
    },
  };

  sidebar = {
    isCollapsed: (): boolean => {
      const value = this.getItem('sidebar_collapsed');
      return value === 'true';
    },

    setCollapsed: (isCollapsed: boolean): void => {
      this.setItem('sidebar_collapsed', isCollapsed ? 'true' : 'false');
    },

    clear: (): void => {
      this.removeItem('sidebar_collapsed');
    },
  };

  preferredTab = {
    get: (pageKey: string): string | null => {
      const allTabs = this.getItem('preferred_tab');
      if (!allTabs) return null;
      try {
        const parsed = JSON.parse(allTabs);
        return parsed[pageKey] || null;
      } catch {
        return null;
      }
    },

    set: (pageKey: string, tabName: string): void => {
      const allTabs = this.getItem('preferred_tab');
      let parsed: Record<string, string> = {};
      if (allTabs) {
        try {
          parsed = JSON.parse(allTabs);
        } catch {
          // Ignore parse errors
        }
      }
      parsed[pageKey] = tabName;
      this.setItem('preferred_tab', JSON.stringify(parsed));
    },

    clear: (): void => {
      this.removeItem('preferred_tab');
    },
  };

  stacksLayout = {
    get: (): 'compact' | 'normal' => {
      const value = this.getItem('stacks_layout');
      return value === 'compact' ? 'compact' : 'normal';
    },

    set: (layout: 'compact' | 'normal'): void => {
      this.setItem('stacks_layout', layout);
    },

    clear: (): void => {
      this.removeItem('stacks_layout');
    },
  };

  stacksSort = {
    get: ():
      | 'name-asc'
      | 'name-desc'
      | 'health-asc'
      | 'health-desc'
      | 'containers-asc'
      | 'containers-desc' => {
      const value = this.getItem('stacks_sort');
      const validSorts = [
        'name-asc',
        'name-desc',
        'health-asc',
        'health-desc',
        'containers-asc',
        'containers-desc',
      ];
      return validSorts.includes(value || '') ? (value as any) : 'name-asc';
    },

    set: (
      sort:
        | 'name-asc'
        | 'name-desc'
        | 'health-asc'
        | 'health-desc'
        | 'containers-asc'
        | 'containers-desc'
    ): void => {
      this.setItem('stacks_sort', sort);
    },

    clear: (): void => {
      this.removeItem('stacks_sort');
    },
  };

  clearAll(): void {
    this.theme.clear();
    this.operations.clear();
    this.sidebar.clear();
    this.preferredTab.clear();
    this.stacksLayout.clear();
    this.stacksSort.clear();
  }
}

export const StorageManager = new StorageManagerClass();

export default StorageManager;
