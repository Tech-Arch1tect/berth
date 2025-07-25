import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Filter, Search, SortAsc } from 'lucide-react';

interface SearchAndFiltersProps {
    searchTerm: string;
    sortOption: string;
    filterStatus: string;
    uniqueStatuses: string[];
    onSearchChange: (value: string) => void;
    onSortChange: (value: string) => void;
    onStatusFilterChange: (value: string) => void;
}

export default function SearchAndFilters({
    searchTerm,
    sortOption,
    filterStatus,
    uniqueStatuses,
    onSearchChange,
    onSortChange,
    onStatusFilterChange,
}: SearchAndFiltersProps) {
    return (
        <Card className="shadow-sm">
            <CardContent className="flex flex-wrap items-center gap-4 px-4 py-2">
                {/* Search Input */}
                <div className="relative min-w-[200px] flex-1">
                    <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        type="text"
                        placeholder="Search stacks..."
                        className="h-9 pl-10"
                        value={searchTerm}
                        onChange={(e) => onSearchChange(e.target.value)}
                    />
                </div>

                {/* Status Filter */}
                <div className="flex items-center gap-2">
                    <Filter className="h-4 w-4 text-muted-foreground" />
                    <Select value={filterStatus} onValueChange={onStatusFilterChange}>
                        <SelectTrigger className="h-9 w-[140px]">
                            <SelectValue placeholder="All Statuses" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Statuses</SelectItem>
                            {uniqueStatuses.map((status) => (
                                <SelectItem key={status} value={status}>
                                    {status.charAt(0).toUpperCase() + status.slice(1)}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                {/* Sort Options */}
                <div className="flex items-center gap-2">
                    <SortAsc className="h-4 w-4 text-muted-foreground" />
                    <Select value={sortOption} onValueChange={onSortChange}>
                        <SelectTrigger className="h-9 w-[140px]">
                            <SelectValue placeholder="Sort by" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="name">Sort by Name</SelectItem>
                            <SelectItem value="status">Sort by Status</SelectItem>
                            <SelectItem value="services">Sort by Services</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </CardContent>
        </Card>
    );
}
