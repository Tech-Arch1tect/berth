import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  ReactNode,
} from 'react';

export interface TerminalTab {
  id: string;
  serverid: number;
  stackname: string;
  serviceName: string;
  containerName?: string;
  label: string;
}

interface TerminalPanelState {
  isOpen: boolean;
  height: number;
  activeTabId: string | null;
  tabs: TerminalTab[];
}

interface TerminalPanelContextValue {
  state: TerminalPanelState;
  openTerminal: (tab: Omit<TerminalTab, 'id' | 'label'>) => void;
  closeTerminal: (tabId: string) => void;
  setActiveTab: (tabId: string) => void;
  togglePanel: () => void;
  setPanelHeight: (height: number) => void;
}

const TerminalPanelContext = createContext<TerminalPanelContextValue | null>(null);

const STORAGE_KEY = 'berth_terminal_panel_state';
const DEFAULT_HEIGHT = 400;
const MAX_TERMINALS = 10;

const generateTabLabel = (tab: Omit<TerminalTab, 'id' | 'label'>): string => {
  if (tab.containerName) {
    return `${tab.serviceName}:${tab.containerName}`;
  }
  return tab.serviceName;
};

export const TerminalPanelProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [state, setState] = useState<TerminalPanelState>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        return {
          isOpen: parsed.isOpen ?? false,
          height: parsed.height ?? DEFAULT_HEIGHT,
          activeTabId: null,
          tabs: [],
        };
      } catch {}
    }
    return {
      isOpen: false,
      height: DEFAULT_HEIGHT,
      activeTabId: null,
      tabs: [],
    };
  });

  useEffect(() => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        isOpen: state.isOpen,
        height: state.height,
      })
    );
  }, [state.isOpen, state.height]);

  const openTerminal = useCallback((tab: Omit<TerminalTab, 'id' | 'label'>) => {
    setState((prev) => {
      const existingTab = prev.tabs.find(
        (t) =>
          t.serverid === tab.serverid &&
          t.stackname === tab.stackname &&
          t.serviceName === tab.serviceName &&
          t.containerName === tab.containerName
      );

      if (existingTab) {
        return {
          ...prev,
          isOpen: true,
          activeTabId: existingTab.id,
        };
      }

      if (prev.tabs.length >= MAX_TERMINALS) {
        return prev;
      }

      const newTab: TerminalTab = {
        ...tab,
        id: `terminal-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        label: generateTabLabel(tab),
      };

      return {
        ...prev,
        isOpen: true,
        activeTabId: newTab.id,
        tabs: [...prev.tabs, newTab],
      };
    });
  }, []);

  const closeTerminal = useCallback((tabId: string) => {
    setState((prev) => {
      const newTabs = prev.tabs.filter((t) => t.id !== tabId);
      let newActiveTabId = prev.activeTabId;

      if (prev.activeTabId === tabId) {
        if (newTabs.length > 0) {
          const closedIndex = prev.tabs.findIndex((t) => t.id === tabId);
          const nextIndex = closedIndex > 0 ? closedIndex - 1 : 0;
          newActiveTabId = newTabs[nextIndex]?.id ?? null;
        } else {
          newActiveTabId = null;
        }
      }

      return {
        ...prev,
        activeTabId: newActiveTabId,
        tabs: newTabs,
        isOpen: newTabs.length > 0 ? prev.isOpen : false,
      };
    });
  }, []);

  const setActiveTab = useCallback((tabId: string) => {
    setState((prev) => ({
      ...prev,
      activeTabId: tabId,
    }));
  }, []);

  const togglePanel = useCallback(() => {
    setState((prev) => ({
      ...prev,
      isOpen: !prev.isOpen,
    }));
  }, []);

  const setPanelHeight = useCallback((height: number) => {
    setState((prev) => ({
      ...prev,
      height: Math.max(200, Math.min(height, window.innerHeight - 100)),
    }));
  }, []);

  const value: TerminalPanelContextValue = {
    state,
    openTerminal,
    closeTerminal,
    setActiveTab,
    togglePanel,
    setPanelHeight,
  };

  return <TerminalPanelContext.Provider value={value}>{children}</TerminalPanelContext.Provider>;
};

export const useTerminalPanel = (): TerminalPanelContextValue => {
  const context = useContext(TerminalPanelContext);
  if (!context) {
    throw new Error('useTerminalPanel must be used within TerminalPanelProvider');
  }
  return context;
};
