import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { UserDisplayList } from './UserDisplayList';
import type { PaperActionUsers } from '../../common/services/api';

interface UpvotersModalProps {
    isOpen: boolean;
    onClose: () => void;
    actionUsers: PaperActionUsers | null;
    isLoading: boolean;
    error: string | null;
    upvoteCount: number;
}

export const UpvotersModal: React.FC<UpvotersModalProps> = ({
    isOpen,
    onClose,
    actionUsers,
    isLoading,
    error,
    upvoteCount
}) => {
    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>
                        Upvotes ({upvoteCount})
                    </DialogTitle>
                </DialogHeader>
                <div className="mt-4">
                    <UserDisplayList
                        title=""
                        users={actionUsers?.upvotes}
                        isLoading={isLoading}
                        error={error}
                        emptyMessage="No upvotes yet."
                    />
                </div>
            </DialogContent>
        </Dialog>
    );
};