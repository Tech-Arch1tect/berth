import React, {
  createContext,
  useContext,
  useReducer,
  ReactNode,
  useCallback,
  useMemo,
} from 'react';
import {
  ComposeConfig,
  ComposeServiceConfig,
  ComposeNetworkConfig,
  ComposeVolumeConfig,
  ComposeSecretConfig,
  ComposeConfigConfig,
  ServiceChanges,
  NewServiceConfig,
  ComposeChanges as ApiComposeChanges,
} from '../../types/compose';

export type EditorSection = 'services' | 'networks' | 'volumes' | 'secrets' | 'configs' | 'preview';

export interface ValidationError {
  path: string;
  message: string;
}

interface PendingChanges {
  serviceChanges: Record<string, ServiceChanges>;
  networkChanges: Record<string, ComposeNetworkConfig | null>;
  volumeChanges: Record<string, ComposeVolumeConfig | null>;
  secretChanges: Record<string, ComposeSecretConfig | null>;
  configChanges: Record<string, ComposeConfigConfig | null>;
  addServices: Record<string, NewServiceConfig>;
  deleteServices: string[];
  renameServices: Record<string, string>;
}

const emptyChanges: PendingChanges = {
  serviceChanges: {},
  networkChanges: {},
  volumeChanges: {},
  secretChanges: {},
  configChanges: {},
  addServices: {},
  deleteServices: [],
  renameServices: {},
};

interface ComposeEditorState {
  composeData: ComposeConfig | null;
  originalData: ComposeConfig | null;
  pendingChanges: PendingChanges;
  validationErrors: ValidationError[];
  selectedService: string | null;
  selectedSection: EditorSection;
  isLoading: boolean;
  error: string | null;
  previewViewed: boolean;
}

type Action =
  | { type: 'SET_COMPOSE_DATA'; payload: ComposeConfig }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SELECT_SERVICE'; payload: string | null }
  | { type: 'SELECT_SECTION'; payload: EditorSection }
  | { type: 'UPDATE_SERVICE'; payload: { serviceName: string; changes: ServiceChanges } }
  | { type: 'ADD_SERVICE'; payload: { serviceName: string; config: NewServiceConfig } }
  | { type: 'DELETE_SERVICE'; payload: string }
  | { type: 'RENAME_SERVICE'; payload: { oldName: string; newName: string } }
  | {
      type: 'UPDATE_NETWORK';
      payload: { networkName: string; config: ComposeNetworkConfig | null };
    }
  | { type: 'UPDATE_VOLUME'; payload: { volumeName: string; config: ComposeVolumeConfig | null } }
  | { type: 'UPDATE_SECRET'; payload: { secretName: string; config: ComposeSecretConfig | null } }
  | { type: 'UPDATE_CONFIG'; payload: { configName: string; config: ComposeConfigConfig | null } }
  | { type: 'SET_NETWORKS'; payload: Record<string, ComposeNetworkConfig | null> }
  | { type: 'SET_VOLUMES'; payload: Record<string, ComposeVolumeConfig | null> }
  | { type: 'SET_SECRETS'; payload: Record<string, ComposeSecretConfig | null> }
  | { type: 'SET_CONFIGS'; payload: Record<string, ComposeConfigConfig | null> }
  | { type: 'ADD_VALIDATION_ERROR'; payload: ValidationError }
  | { type: 'CLEAR_VALIDATION_ERRORS' }
  | { type: 'RESET_CHANGES' }
  | { type: 'CLEAR_CHANGES_AFTER_SAVE' };

const initialState: ComposeEditorState = {
  composeData: null,
  originalData: null,
  pendingChanges: { ...emptyChanges },
  validationErrors: [],
  selectedService: null,
  selectedSection: 'services',
  isLoading: false,
  error: null,
  previewViewed: false,
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
        pendingChanges: { ...emptyChanges },
      };
    }
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    case 'SET_ERROR':
      return { ...state, error: action.payload, isLoading: false };
    case 'SELECT_SERVICE':
      return { ...state, selectedService: action.payload };
    case 'SELECT_SECTION':
      return {
        ...state,
        selectedSection: action.payload,
        previewViewed: action.payload === 'preview' ? true : state.previewViewed,
      };

    case 'UPDATE_SERVICE': {
      const { serviceName, changes } = action.payload;
      const existingChanges = state.pendingChanges.serviceChanges[serviceName] || {};
      return {
        ...state,
        previewViewed: false,
        pendingChanges: {
          ...state.pendingChanges,
          serviceChanges: {
            ...state.pendingChanges.serviceChanges,
            [serviceName]: { ...existingChanges, ...changes },
          },
        },
      };
    }

    case 'ADD_SERVICE': {
      const { serviceName, config } = action.payload;
      return {
        ...state,
        previewViewed: false,
        pendingChanges: {
          ...state.pendingChanges,
          addServices: {
            ...state.pendingChanges.addServices,
            [serviceName]: config,
          },
        },
      };
    }

    case 'DELETE_SERVICE': {
      const serviceName = action.payload;

      if (state.pendingChanges.addServices[serviceName]) {
        const { [serviceName]: _, ...remainingAdded } = state.pendingChanges.addServices;
        return {
          ...state,
          previewViewed: false,
          pendingChanges: {
            ...state.pendingChanges,
            addServices: remainingAdded,
          },
        };
      }

      return {
        ...state,
        previewViewed: false,
        pendingChanges: {
          ...state.pendingChanges,
          deleteServices: [...state.pendingChanges.deleteServices, serviceName],

          serviceChanges: Object.fromEntries(
            Object.entries(state.pendingChanges.serviceChanges).filter(([k]) => k !== serviceName)
          ),
        },
      };
    }

    case 'RENAME_SERVICE': {
      const { oldName, newName } = action.payload;
      return {
        ...state,
        previewViewed: false,
        pendingChanges: {
          ...state.pendingChanges,
          renameServices: {
            ...state.pendingChanges.renameServices,
            [oldName]: newName,
          },
        },
      };
    }

    case 'UPDATE_NETWORK': {
      const { networkName, config } = action.payload;
      return {
        ...state,
        previewViewed: false,
        pendingChanges: {
          ...state.pendingChanges,
          networkChanges: {
            ...state.pendingChanges.networkChanges,
            [networkName]: config,
          },
        },
      };
    }

    case 'UPDATE_VOLUME': {
      const { volumeName, config } = action.payload;
      return {
        ...state,
        previewViewed: false,
        pendingChanges: {
          ...state.pendingChanges,
          volumeChanges: {
            ...state.pendingChanges.volumeChanges,
            [volumeName]: config,
          },
        },
      };
    }

    case 'UPDATE_SECRET': {
      const { secretName, config } = action.payload;
      return {
        ...state,
        previewViewed: false,
        pendingChanges: {
          ...state.pendingChanges,
          secretChanges: {
            ...state.pendingChanges.secretChanges,
            [secretName]: config,
          },
        },
      };
    }

    case 'UPDATE_CONFIG': {
      const { configName, config } = action.payload;
      return {
        ...state,
        previewViewed: false,
        pendingChanges: {
          ...state.pendingChanges,
          configChanges: {
            ...state.pendingChanges.configChanges,
            [configName]: config,
          },
        },
      };
    }

    case 'SET_NETWORKS': {
      return {
        ...state,
        previewViewed: false,
        pendingChanges: {
          ...state.pendingChanges,
          networkChanges: action.payload,
        },
      };
    }

    case 'SET_VOLUMES': {
      return {
        ...state,
        previewViewed: false,
        pendingChanges: {
          ...state.pendingChanges,
          volumeChanges: action.payload,
        },
      };
    }

    case 'SET_SECRETS': {
      return {
        ...state,
        previewViewed: false,
        pendingChanges: {
          ...state.pendingChanges,
          secretChanges: action.payload,
        },
      };
    }

    case 'SET_CONFIGS': {
      return {
        ...state,
        previewViewed: false,
        pendingChanges: {
          ...state.pendingChanges,
          configChanges: action.payload,
        },
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
        pendingChanges: { ...emptyChanges },
        validationErrors: [],
        previewViewed: false,
      };
    case 'CLEAR_CHANGES_AFTER_SAVE':
      return {
        ...state,
        pendingChanges: { ...emptyChanges },
        validationErrors: [],
        previewViewed: false,
      };
    default:
      return state;
  }
}

function hasAnyChanges(changes: PendingChanges): boolean {
  return (
    Object.keys(changes.serviceChanges).length > 0 ||
    Object.keys(changes.networkChanges).length > 0 ||
    Object.keys(changes.volumeChanges).length > 0 ||
    Object.keys(changes.secretChanges).length > 0 ||
    Object.keys(changes.configChanges).length > 0 ||
    Object.keys(changes.addServices).length > 0 ||
    changes.deleteServices.length > 0 ||
    Object.keys(changes.renameServices).length > 0
  );
}

function toApiChanges(changes: PendingChanges): ApiComposeChanges {
  const apiChanges: ApiComposeChanges = {};

  if (Object.keys(changes.serviceChanges).length > 0) {
    apiChanges.service_changes = changes.serviceChanges;
  }
  if (Object.keys(changes.networkChanges).length > 0) {
    apiChanges.network_changes = changes.networkChanges;
  }
  if (Object.keys(changes.volumeChanges).length > 0) {
    apiChanges.volume_changes = changes.volumeChanges;
  }
  if (Object.keys(changes.secretChanges).length > 0) {
    apiChanges.secret_changes = changes.secretChanges;
  }
  if (Object.keys(changes.configChanges).length > 0) {
    apiChanges.config_changes = changes.configChanges;
  }
  if (Object.keys(changes.addServices).length > 0) {
    apiChanges.add_services = changes.addServices;
  }
  if (changes.deleteServices.length > 0) {
    apiChanges.delete_services = changes.deleteServices;
  }
  if (Object.keys(changes.renameServices).length > 0) {
    apiChanges.rename_services = changes.renameServices;
  }

  return apiChanges;
}

interface ComposeEditorContextType {
  state: ComposeEditorState;
  isDirty: boolean;
  apiChanges: ApiComposeChanges;
  setComposeData: (data: ComposeConfig) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  selectService: (serviceName: string | null) => void;
  selectSection: (section: EditorSection) => void;
  updateService: (serviceName: string, changes: ServiceChanges) => void;
  addService: (serviceName: string, config: NewServiceConfig) => void;
  deleteService: (serviceName: string) => void;
  renameService: (oldName: string, newName: string) => void;
  updateNetwork: (networkName: string, config: ComposeNetworkConfig | null) => void;
  updateVolume: (volumeName: string, config: ComposeVolumeConfig | null) => void;
  updateSecret: (secretName: string, config: ComposeSecretConfig | null) => void;
  updateConfig: (configName: string, config: ComposeConfigConfig | null) => void;
  setNetworks: (networks: Record<string, ComposeNetworkConfig | null>) => void;
  setVolumes: (volumes: Record<string, ComposeVolumeConfig | null>) => void;
  setSecrets: (secrets: Record<string, ComposeSecretConfig | null>) => void;
  setConfigs: (configs: Record<string, ComposeConfigConfig | null>) => void;
  addValidationError: (error: ValidationError) => void;
  clearValidationErrors: () => void;
  resetChanges: () => void;
  clearChangesAfterSave: () => void;
  getServiceConfig: (serviceName: string) => ComposeServiceConfig | undefined;
  getEffectiveNetworks: () => Record<string, ComposeNetworkConfig>;
  getEffectiveVolumes: () => Record<string, ComposeVolumeConfig>;
  getEffectiveSecrets: () => Record<string, ComposeSecretConfig>;
  getEffectiveConfigs: () => Record<string, ComposeConfigConfig>;
}

const ComposeEditorContext = createContext<ComposeEditorContextType | undefined>(undefined);

export interface ComposeEditorProviderProps {
  children: ReactNode;
}

export const ComposeEditorProvider: React.FC<ComposeEditorProviderProps> = ({ children }) => {
  const [state, dispatch] = useReducer(reducer, initialState);

  const isDirty = hasAnyChanges(state.pendingChanges);
  const apiChanges = useMemo(() => toApiChanges(state.pendingChanges), [state.pendingChanges]);

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

  const updateService = useCallback((serviceName: string, changes: ServiceChanges) => {
    dispatch({ type: 'UPDATE_SERVICE', payload: { serviceName, changes } });
  }, []);

  const addService = useCallback((serviceName: string, config: NewServiceConfig) => {
    dispatch({ type: 'ADD_SERVICE', payload: { serviceName, config } });
  }, []);

  const deleteService = useCallback((serviceName: string) => {
    dispatch({ type: 'DELETE_SERVICE', payload: serviceName });
  }, []);

  const renameService = useCallback((oldName: string, newName: string) => {
    dispatch({ type: 'RENAME_SERVICE', payload: { oldName, newName } });
  }, []);

  const updateNetwork = useCallback((networkName: string, config: ComposeNetworkConfig | null) => {
    dispatch({ type: 'UPDATE_NETWORK', payload: { networkName, config } });
  }, []);

  const updateVolume = useCallback((volumeName: string, config: ComposeVolumeConfig | null) => {
    dispatch({ type: 'UPDATE_VOLUME', payload: { volumeName, config } });
  }, []);

  const updateSecret = useCallback((secretName: string, config: ComposeSecretConfig | null) => {
    dispatch({ type: 'UPDATE_SECRET', payload: { secretName, config } });
  }, []);

  const updateConfig = useCallback((configName: string, config: ComposeConfigConfig | null) => {
    dispatch({ type: 'UPDATE_CONFIG', payload: { configName, config } });
  }, []);

  const setNetworks = useCallback((networks: Record<string, ComposeNetworkConfig | null>) => {
    dispatch({ type: 'SET_NETWORKS', payload: networks });
  }, []);

  const setVolumes = useCallback((volumes: Record<string, ComposeVolumeConfig | null>) => {
    dispatch({ type: 'SET_VOLUMES', payload: volumes });
  }, []);

  const setSecrets = useCallback((secrets: Record<string, ComposeSecretConfig | null>) => {
    dispatch({ type: 'SET_SECRETS', payload: secrets });
  }, []);

  const setConfigs = useCallback((configs: Record<string, ComposeConfigConfig | null>) => {
    dispatch({ type: 'SET_CONFIGS', payload: configs });
  }, []);

  const addValidationError = useCallback((error: ValidationError) => {
    dispatch({ type: 'ADD_VALIDATION_ERROR', payload: error });
  }, []);

  const clearValidationErrors = useCallback(() => {
    dispatch({ type: 'CLEAR_VALIDATION_ERRORS' });
  }, []);

  const resetChanges = useCallback(() => {
    dispatch({ type: 'RESET_CHANGES' });
  }, []);

  const clearChangesAfterSave = useCallback(() => {
    dispatch({ type: 'CLEAR_CHANGES_AFTER_SAVE' });
  }, []);

  const getServiceConfig = useCallback(
    (serviceName: string): ComposeServiceConfig | undefined => {
      if (!state.composeData?.services) return undefined;

      const addedService = state.pendingChanges.addServices[serviceName];
      if (addedService) {
        return addedService as ComposeServiceConfig;
      }

      if (state.pendingChanges.deleteServices.includes(serviceName)) {
        return undefined;
      }

      const baseConfig = state.composeData.services[serviceName];
      if (!baseConfig) return undefined;

      const changes = state.pendingChanges.serviceChanges[serviceName];
      if (!changes) return baseConfig;

      return {
        ...baseConfig,
        ...(changes.image && { image: changes.image }),
        ...(changes.ports && { ports: changes.ports }),
        ...(changes.volumes && { volumes: changes.volumes }),
        ...(changes.environment && { environment: changes.environment }),
        ...(changes.labels && { labels: changes.labels }),
        ...(changes.restart && { restart: changes.restart }),
        ...(changes.networks && { networks: changes.networks }),
        ...(changes.healthcheck && { healthcheck: changes.healthcheck }),
        ...(changes.depends_on && { depends_on: changes.depends_on }),
        ...(changes.command && { command: changes.command.values }),
        ...(changes.entrypoint && { entrypoint: changes.entrypoint.values }),
        ...(changes.deploy && { deploy: changes.deploy }),
        ...(changes.build && { build: changes.build }),
      } as ComposeServiceConfig;
    },
    [state.composeData, state.pendingChanges]
  );

  const getEffectiveNetworks = useCallback((): Record<string, ComposeNetworkConfig> => {
    const original = state.composeData?.networks || {};
    const changes = state.pendingChanges.networkChanges;

    const result: Record<string, ComposeNetworkConfig> = { ...original };

    for (const [name, config] of Object.entries(changes)) {
      if (config === null) {
        delete result[name];
      } else {
        result[name] = config;
      }
    }

    return result;
  }, [state.composeData, state.pendingChanges.networkChanges]);

  const getEffectiveVolumes = useCallback((): Record<string, ComposeVolumeConfig> => {
    const original = state.composeData?.volumes || {};
    const changes = state.pendingChanges.volumeChanges;

    const result: Record<string, ComposeVolumeConfig> = { ...original };

    for (const [name, config] of Object.entries(changes)) {
      if (config === null) {
        delete result[name];
      } else {
        result[name] = config;
      }
    }

    return result;
  }, [state.composeData, state.pendingChanges.volumeChanges]);

  const getEffectiveSecrets = useCallback((): Record<string, ComposeSecretConfig> => {
    const original = state.composeData?.secrets || {};
    const changes = state.pendingChanges.secretChanges;

    const result: Record<string, ComposeSecretConfig> = { ...original };

    for (const [name, config] of Object.entries(changes)) {
      if (config === null) {
        delete result[name];
      } else {
        result[name] = config;
      }
    }

    return result;
  }, [state.composeData, state.pendingChanges.secretChanges]);

  const getEffectiveConfigs = useCallback((): Record<string, ComposeConfigConfig> => {
    const original = state.composeData?.configs || {};
    const changes = state.pendingChanges.configChanges;

    const result: Record<string, ComposeConfigConfig> = { ...original };

    for (const [name, config] of Object.entries(changes)) {
      if (config === null) {
        delete result[name];
      } else {
        result[name] = config;
      }
    }

    return result;
  }, [state.composeData, state.pendingChanges.configChanges]);

  const value: ComposeEditorContextType = {
    state,
    isDirty,
    apiChanges,
    setComposeData,
    setLoading,
    setError,
    selectService,
    selectSection,
    updateService,
    addService,
    deleteService,
    renameService,
    updateNetwork,
    updateVolume,
    updateSecret,
    updateConfig,
    setNetworks,
    setVolumes,
    setSecrets,
    setConfigs,
    addValidationError,
    clearValidationErrors,
    resetChanges,
    clearChangesAfterSave,
    getServiceConfig,
    getEffectiveNetworks,
    getEffectiveVolumes,
    getEffectiveSecrets,
    getEffectiveConfigs,
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
