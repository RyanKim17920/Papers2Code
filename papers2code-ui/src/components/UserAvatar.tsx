import React, { useState, useEffect } from 'react';
import { FaUserCircle } from 'react-icons/fa';
import './UserAvatar.css'; // We'll create this for specific styles

interface UserAvatarProps {
    avatarUrl: string | null | undefined;
    username: string;
    className?: string; // For general styling (e.g., size)
    iconClassName?: string; // For specific icon styling if needed
}

const UserAvatar: React.FC<UserAvatarProps> = ({ avatarUrl, username, className, iconClassName }) => {
    const [imageError, setImageError] = useState(false);

    useEffect(() => {
        setImageError(false); // Reset error state if avatarUrl changes
    }, [avatarUrl]);

    if (avatarUrl && !imageError) {
        return (
            <img
                src={avatarUrl}
                alt={`${username}'s avatar`}
                className={className}
                onError={() => setImageError(true)}
            />
        );
    }
    // @ts-expect-error: if it works then don't fix it
    return <FaUserCircle className={`${className} ${iconClassName || 'default-avatar-icon'}`} />;
};

export default UserAvatar;