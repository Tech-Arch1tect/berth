import { useState, useCallback } from 'react';
import type { FileContent } from '../api/generated/models';
import { OpenTab } from '../types/files';

interface UseTabsReturn {
  tabs: OpenTab[];
  activeTabId: string | null;
  openTab: (file: FileContent) => void;
  refreshTab: (file: FileContent) => void;
  closeTab: (tabId: string) => void;
  closeOtherTabs: (tabId: string) => void;
  closeAllTabs: () => void;
  setActiveTab: (tabId: string) => void;
  updateTabContent: (tabId: string, content: string) => void;
  markTabClean: (tabId: string) => void;
  getActiveTab: () => OpenTab | null;
  hasUnsavedChanges: () => boolean;
  getDirtyTabs: () => OpenTab[];
}

export function useTabs(): UseTabsReturn {
  const [tabs, setTabs] = useState<OpenTab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);

  const openTab = useCallback((file: FileContent) => {
    const tabId = file.path;
    const fileName = file.path.split('/').pop() || file.path;

    setTabs((prev) => {
      const existingTab = prev.find((t) => t.id === tabId);
      if (existingTab) {
        return prev;
      }

      const newTab: OpenTab = {
        id: tabId,
        path: file.path,
        name: fileName,
        content: file.content,
        encoding: file.encoding,
        size: file.size,
        isDirty: false,
        originalContent: file.content,
      };

      return [...prev, newTab];
    });

    setActiveTabId(tabId);
  }, []);

  const refreshTab = useCallback((file: FileContent) => {
    const tabId = file.path;

    setTabs((prev) =>
      prev.map((tab) => {
        if (tab.id !== tabId) return tab;

        if (tab.isDirty) {
          return {
            ...tab,
            originalContent: file.content,
            size: file.size,
            encoding: file.encoding,
          };
        }

        return {
          ...tab,
          content: file.content,
          originalContent: file.content,
          size: file.size,
          encoding: file.encoding,
          isDirty: false,
        };
      })
    );
  }, []);

  const closeTab = useCallback((tabId: string) => {
    setTabs((prev) => {
      const index = prev.findIndex((t) => t.id === tabId);
      if (index === -1) return prev;

      const newTabs = prev.filter((t) => t.id !== tabId);

      setActiveTabId((currentActive) => {
        if (currentActive !== tabId) return currentActive;
        if (newTabs.length === 0) return null;

        const newIndex = Math.min(index, newTabs.length - 1);
        return newTabs[newIndex]?.id || null;
      });

      return newTabs;
    });
  }, []);

  const closeOtherTabs = useCallback((tabId: string) => {
    setTabs((prev) => prev.filter((t) => t.id === tabId));
    setActiveTabId(tabId);
  }, []);

  const closeAllTabs = useCallback(() => {
    setTabs([]);
    setActiveTabId(null);
  }, []);

  const setActiveTab = useCallback((tabId: string) => {
    setActiveTabId(tabId);
  }, []);

  const updateTabContent = useCallback((tabId: string, content: string) => {
    setTabs((prev) =>
      prev.map((tab) => {
        if (tab.id !== tabId) return tab;
        return {
          ...tab,
          content,
          isDirty: content !== tab.originalContent,
        };
      })
    );
  }, []);

  const markTabClean = useCallback((tabId: string) => {
    setTabs((prev) =>
      prev.map((tab) => {
        if (tab.id !== tabId) return tab;
        return {
          ...tab,
          isDirty: false,
          originalContent: tab.content,
        };
      })
    );
  }, []);

  const getActiveTab = useCallback(() => {
    if (!activeTabId) return null;
    return tabs.find((t) => t.id === activeTabId) || null;
  }, [tabs, activeTabId]);

  const hasUnsavedChanges = useCallback(() => {
    return tabs.some((t) => t.isDirty);
  }, [tabs]);

  const getDirtyTabs = useCallback(() => {
    return tabs.filter((t) => t.isDirty);
  }, [tabs]);

  return {
    tabs,
    activeTabId,
    openTab,
    refreshTab,
    closeTab,
    closeOtherTabs,
    closeAllTabs,
    setActiveTab,
    updateTabContent,
    markTabClean,
    getActiveTab,
    hasUnsavedChanges,
    getDirtyTabs,
  };
}
