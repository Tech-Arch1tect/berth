import type { Stack } from '@/types/entities';
import { useMemo, useState } from 'react';

interface StackWithLoading extends Stack {
    isLoadingStatus?: boolean;
}

interface UseStackFilteringReturn {
    filteredAndSortedStacks: StackWithLoading[];

    runningStacks: number;
    totalServices: number;
    runningServices: number;
    uniqueStatuses: string[];

    searchTerm: string;
    sortOption: string;
    filterStatus: string;

    setSearchTerm: (term: string) => void;
    setSortOption: (option: string) => void;
    setFilterStatus: (status: string) => void;
    clearFilters: () => void;
}

export function useStackFiltering(stacks: StackWithLoading[]): UseStackFilteringReturn {
    const [searchTerm, setSearchTerm] = useState('');
    const [sortOption, setSortOption] = useState('name');
    const [filterStatus, setFilterStatus] = useState<string>('all');

    const filteredAndSortedStacks = useMemo(() => {
        return stacks
            .filter((stack) => {
                const matchesSearch =
                    stack.name.toLowerCase().includes(searchTerm.toLowerCase()) || stack.path.toLowerCase().includes(searchTerm.toLowerCase());
                const matchesStatus = filterStatus === 'all' || stack.overall_status === filterStatus;
                return matchesSearch && matchesStatus;
            })
            .sort((a, b) => {
                switch (sortOption) {
                    case 'name':
                        return a.name.localeCompare(b.name);
                    case 'status':
                        return (a.overall_status || '').localeCompare(b.overall_status || '');
                    case 'services':
                        return (b.service_count || 0) - (a.service_count || 0);
                    default:
                        return 0;
                }
            });
    }, [stacks, searchTerm, filterStatus, sortOption]);

    const loadedStacks = useMemo(() => filteredAndSortedStacks.filter((stack) => !stack.isLoadingStatus), [filteredAndSortedStacks]);

    const runningStacks = useMemo(() => loadedStacks.filter((stack) => stack.overall_status === 'running').length, [loadedStacks]);

    const totalServices = useMemo(
        () => filteredAndSortedStacks.reduce((acc, stack) => acc + (stack.service_status_summary?.total || stack.service_count), 0),
        [filteredAndSortedStacks],
    );

    const runningServices = useMemo(
        () => filteredAndSortedStacks.reduce((acc, stack) => acc + (stack.service_status_summary?.running || 0), 0),
        [filteredAndSortedStacks],
    );

    const uniqueStatuses = useMemo(() => Array.from(new Set(stacks.map((stack) => stack.overall_status).filter(Boolean))) as string[], [stacks]);

    const clearFilters = () => {
        setSearchTerm('');
        setFilterStatus('all');
        setSortOption('name');
    };

    return {
        filteredAndSortedStacks,
        runningStacks,
        totalServices,
        runningServices,
        uniqueStatuses,
        searchTerm,
        sortOption,
        filterStatus,
        setSearchTerm,
        setSortOption,
        setFilterStatus,
        clearFilters,
    };
}
