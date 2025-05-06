import React from 'react';
import { UserProfile } from '../../services/auth';
import LoadingSpinner from '../LoadingSpinner';
// Assuming PaperDetailPage.css contains the necessary styles for .user-display-list, .user-avatar-small etc.
// If not, create a separate CSS file for this component.
// import './UserDisplayList.css';

interface UserDisplayListProps {
    users: UserProfile[] | undefined;
    title: string;
    isLoading: boolean;
    error: string | null;
    emptyMessage?: string; // Optional custom message when list is empty
}

const UserDisplayList: React.FC<UserDisplayListProps> = ({
    users,
    title,
    isLoading,
    error,
    emptyMessage = "No users found for this action."
}) => {
    return (
        <div className="user-display-list">
            <h3>{title} ({isLoading ? '...' : users?.length ?? 0})</h3>
            {isLoading && <LoadingSpinner/>}
            {error && <p className="error-message small">Error loading users: {error}</p>}
            {!isLoading && !error && (!users || users.length === 0) && (
                <p>{emptyMessage}</p>
            )}
            {!isLoading && !error && users && users.length > 0 && (
                <ul>
                    {users.map(user => (
                        <li key={user.id}>
                            <img
                                src={user.avatarUrl || '/default-avatar.png'}
                                alt={user.username}
                                className="user-avatar-small"
                                onError={(e) => (e.currentTarget.src = '/default-avatar.png')}
                            />
                            <span>{user.username}</span>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
};

export default UserDisplayList;