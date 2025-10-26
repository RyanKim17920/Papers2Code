import React from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { UserDisplayList } from './UserDisplayList';
import type { PaperActionUsers } from '@/shared/services/api';

interface UpvotersPopoverProps {
    children: React.ReactNode; // trigger element
    actionUsers: PaperActionUsers | null;
    isLoading: boolean;
    error: string | null;
    upvoteCount: number;
}

export const UpvotersPopover: React.FC<UpvotersPopoverProps> = ({
    children,
    actionUsers,
    isLoading,
    error,
    upvoteCount
}) => {
    return (
        <Popover>
            <PopoverTrigger asChild>
                {children}
            </PopoverTrigger>
            <PopoverContent className="max-w-sm" align="start">
                <div className="space-y-3">
                    <h4 className="font-semibold text-sm">
                        Upvotes ({upvoteCount})
                    </h4>
                    <UserDisplayList
                        title=""
                        users={actionUsers?.upvotes}
                        isLoading={isLoading}
                        error={error}
                        emptyMessage="No upvotes yet."
                    />
                </div>
            </PopoverContent>
        </Popover>
    );
};