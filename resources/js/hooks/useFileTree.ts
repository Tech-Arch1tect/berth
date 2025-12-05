import { useState, useCallback } from 'react';
import { FileEntry } from '../types/files';

interface UseFileTreeOptions {
  onNavigate: (path: string) => void;
  onFileSelect: (entry: FileEntry) => void;
}

interface UseFileTreeReturn {
  expandedNodes: Set<string>;
  selectedNode: string | null;
  selectedEntry: FileEntry | null;
  toggleNode: (path: string) => void;
  selectNode: (entry: FileEntry) => void;
  expandNode: (path: string) => void;
  collapseNode: (path: string) => void;
  isExpanded: (path: string) => boolean;
  isSelected: (path: string) => boolean;
}

export function useFileTree({ onNavigate, onFileSelect }: UseFileTreeOptions): UseFileTreeReturn {
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [selectedEntry, setSelectedEntry] = useState<FileEntry | null>(null);

  const toggleNode = useCallback((path: string) => {
    setExpandedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  }, []);

  const expandNode = useCallback((path: string) => {
    setExpandedNodes((prev) => {
      const next = new Set(prev);
      next.add(path);
      return next;
    });
  }, []);

  const collapseNode = useCallback((path: string) => {
    setExpandedNodes((prev) => {
      const next = new Set(prev);
      next.delete(path);
      return next;
    });
  }, []);

  const selectNode = useCallback(
    (entry: FileEntry) => {
      setSelectedNode(entry.path);
      setSelectedEntry(entry);

      if (entry.is_directory) {
        toggleNode(entry.path);
        onNavigate(entry.path);
      } else {
        onFileSelect(entry);
      }
    },
    [toggleNode, onNavigate, onFileSelect]
  );

  const isExpanded = useCallback((path: string) => expandedNodes.has(path), [expandedNodes]);

  const isSelected = useCallback((path: string) => selectedNode === path, [selectedNode]);

  return {
    expandedNodes,
    selectedNode,
    selectedEntry,
    toggleNode,
    selectNode,
    expandNode,
    collapseNode,
    isExpanded,
    isSelected,
  };
}
