import React, { createContext, useContext, useReducer, ReactNode, useCallback } from 'react';
import { ComposeConfig, ComposeServiceConfig } from '../../types/compose';

export type EditorSection = 'services' | 'networks' | 'volumes' | 'secrets' | 'configs';

export interface ValidationError {
  path: string;
  message: string;
}

export interface ComposeChanges {
  services?: Record<string, Partial<ComposeServiceConfig>>;
  deletedServices?: string[];
  addedServices?: Record<string, ComposeServiceConfig>;
}

interface ComposeEditorState {
  composeData: ComposeConfig | null;
  originalData: ComposeConfig | null;
  changes: ComposeChanges;
  validationErrors: ValidationError[];
  selectedService: string | null;
  selectedSection: EditorSection;
  isDirty: boolean;
  isLoading: boolean;
  error: string | null;
}

type Action =
  | { type: 'SET_COMPOSE_DATA'; payload: ComposeConfig }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SELECT_SERVICE'; payload: string | null }
  | { type: 'SELECT_SECTION'; payload: EditorSection }
  | {
      type: 'UPDATE_SERVICE';
      payload: { serviceName: string; updates: Partial<ComposeServiceConfig> };
    }
  | { type: 'ADD_VALIDATION_ERROR'; payload: ValidationError }
  | { type: 'CLEAR_VALIDATION_ERRORS' }
  | { type: 'RESET_CHANGES' };

const initialState: ComposeEditorState = {
  composeData: null,
  originalData: null,
  changes: {},
  validationErrors: [],
  selectedService: null,
  selectedSection: 'services',
  isDirty: false,
  isLoading: false,
  error: null,
};

function reducer(state: ComposeEditorState, action: Action): ComposeEditorState {
  switch (action.type) {
    case 'SET_COMPOSE_DATA': {
      const serviceNames = Object.keys(action.payload.services || {});
      return {
        ...state,
        composeData: action.payload,
        originalData: action.payload,
        selectedService: serviceNames.length > 0 ? serviceNames[0] : null,
        isLoading: false,
        error: null,
        changes: {},
        isDirty: false,
      };
    }
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    case 'SET_ERROR':
      return { ...state, error: action.payload, isLoading: false };
    case 'SELECT_SERVICE':
      return { ...state, selectedService: action.payload };
    case 'SELECT_SECTION':
      return { ...state, selectedSection: action.payload };
    case 'UPDATE_SERVICE': {
      const { serviceName, updates } = action.payload;
      const existingChanges = state.changes.services?.[serviceName] || {};
      return {
        ...state,
        changes: {
          ...state.changes,
          services: {
            ...state.changes.services,
            [serviceName]: { ...existingChanges, ...updates },
          },
        },
        isDirty: true,
      };
    }
    case 'ADD_VALIDATION_ERROR':
      return {
        ...state,
        validationErrors: [...state.validationErrors, action.payload],
      };
    case 'CLEAR_VALIDATION_ERRORS':
      return { ...state, validationErrors: [] };
    case 'RESET_CHANGES':
      return {
        ...state,
        composeData: state.originalData,
        changes: {},
        isDirty: false,
        validationErrors: [],
      };
    default:
      return state;
  }
}

interface ComposeEditorContextType {
  state: ComposeEditorState;
  setComposeData: (data: ComposeConfig) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  selectService: (serviceName: string | null) => void;
  selectSection: (section: EditorSection) => void;
  updateService: (serviceName: string, updates: Partial<ComposeServiceConfig>) => void;
  addValidationError: (error: ValidationError) => void;
  clearValidationErrors: () => void;
  resetChanges: () => void;
  getServiceConfig: (serviceName: string) => ComposeServiceConfig | undefined;
}

const ComposeEditorContext = createContext<ComposeEditorContextType | undefined>(undefined);

export interface ComposeEditorProviderProps {
  children: ReactNode;
}

export const ComposeEditorProvider: React.FC<ComposeEditorProviderProps> = ({ children }) => {
  const [state, dispatch] = useReducer(reducer, initialState);

  const setComposeData = useCallback((data: ComposeConfig) => {
    dispatch({ type: 'SET_COMPOSE_DATA', payload: data });
  }, []);

  const setLoading = useCallback((loading: boolean) => {
    dispatch({ type: 'SET_LOADING', payload: loading });
  }, []);

  const setError = useCallback((error: string | null) => {
    dispatch({ type: 'SET_ERROR', payload: error });
  }, []);

  const selectService = useCallback((serviceName: string | null) => {
    dispatch({ type: 'SELECT_SERVICE', payload: serviceName });
  }, []);

  const selectSection = useCallback((section: EditorSection) => {
    dispatch({ type: 'SELECT_SECTION', payload: section });
  }, []);

  const updateService = useCallback(
    (serviceName: string, updates: Partial<ComposeServiceConfig>) => {
      dispatch({ type: 'UPDATE_SERVICE', payload: { serviceName, updates } });
    },
    []
  );

  const addValidationError = useCallback((error: ValidationError) => {
    dispatch({ type: 'ADD_VALIDATION_ERROR', payload: error });
  }, []);

  const clearValidationErrors = useCallback(() => {
    dispatch({ type: 'CLEAR_VALIDATION_ERRORS' });
  }, []);

  const resetChanges = useCallback(() => {
    dispatch({ type: 'RESET_CHANGES' });
  }, []);

  const getServiceConfig = useCallback(
    (serviceName: string): ComposeServiceConfig | undefined => {
      if (!state.composeData?.services) return undefined;
      const baseConfig = state.composeData.services[serviceName];
      const changes = state.changes.services?.[serviceName];
      if (!baseConfig) return undefined;
      return changes ? { ...baseConfig, ...changes } : baseConfig;
    },
    [state.composeData, state.changes]
  );

  const value: ComposeEditorContextType = {
    state,
    setComposeData,
    setLoading,
    setError,
    selectService,
    selectSection,
    updateService,
    addValidationError,
    clearValidationErrors,
    resetChanges,
    getServiceConfig,
  };

  return <ComposeEditorContext.Provider value={value}>{children}</ComposeEditorContext.Provider>;
};

export const useComposeEditor = (): ComposeEditorContextType => {
  const context = useContext(ComposeEditorContext);
  if (!context) {
    throw new Error('useComposeEditor must be used within ComposeEditorProvider');
  }
  return context;
};
