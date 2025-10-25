import React from 'react';
import type { UserProfile as User } from '../../common/types/user';
import { UserAvatar, LoadingSpinner } from '../../common/components';

interface UserDisplayListProps {
    users: User[] | undefined;
    title: string;
    isLoading: boolean;
    error: string | null;
    emptyMessage?: string;
}

export const UserDisplayList: React.FC<UserDisplayListProps> = ({
    users,
    title,
    isLoading,
    error,
    emptyMessage = "No users found for this action."
}) => {
// ... then render <UserDisplayList users={upvoterUsers} ... />
    return (
        <div className="user-display-list">
            <h3 className="mt-0 mb-3.5 text-[1.1rem] text-[var(--text-heading-color)] border-b border-[var(--border-color-light)] pb-2">{title} ({isLoading ? '...' : users?.length ?? 0})</h3>
            {isLoading && <LoadingSpinner />}
            {error && <p className="error-message small">Error loading users: {error}</p>}
            {!isLoading && !error && (!users || users.length === 0) && (
                <p>{emptyMessage}</p>
            )}
            {!isLoading && !error && users && users.length > 0 && (
                <ul className="list-none p-0 m-0 max-h-[50vh] overflow-y-auto">
                    {users.map(user => (
                        <li key={user.id} className="flex items-center py-2 px-0 border-b border-[var(--border-color-light)] last:border-b-0">
                            <UserAvatar
                                avatarUrl={user.avatarUrl}
                                username={user.username}
                                className="w-[30px] h-[30px] rounded-full mr-2.5 object-cover border border-[var(--border-color)] bg-[#eee]"
                            />
                            <span className="text-[0.95rem] text-[var(--text-color)] font-medium">{user.username}</span>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
};