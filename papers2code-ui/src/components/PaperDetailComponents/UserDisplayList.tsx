import React from 'react';
import { UserProfile as User} from '../../services/auth';
import UserAvatar from '../UserAvatar'; // Import the new UserAvatar component
import './UserDisplayList.css';
import LoadingSpinner from '../LoadingSpinner';

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
            <h3>{title} ({isLoading ? '...' : users?.length ?? 0})</h3>
            {isLoading && <LoadingSpinner />}
            {error && <p className="error-message small">Error loading users: {error}</p>}
            {!isLoading && !error && (!users || users.length === 0) && (
                <p>{emptyMessage}</p>
            )}
            {!isLoading && !error && users && users.length > 0 && (
                <ul>
                    {users.map(user => (
                        <li key={user.id}>
                            <UserAvatar
                                avatarUrl={user.avatarUrl}
                                username={user.username}
                                className="avatar-sm"
                            />
                            <span>{user.username}</span>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
};