import { useState, useEffect } from 'react';
import { fetchUserProfilesByIds } from '../services/api';
import type { UserProfile } from '../types/user';

interface UseContributorProfilesOptions {
    contributorIds: string[];
    enabled?: boolean;
}

interface UseContributorProfilesReturn {
    contributorUsers: UserProfile[] | undefined;
    isLoading: boolean;
    error: string | null;
}

export function useContributorProfiles({ 
    contributorIds, 
    enabled = true 
}: UseContributorProfilesOptions): UseContributorProfilesReturn {
    const [contributorUsers, setContributorUsers] = useState<UserProfile[] | undefined>(undefined);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!enabled || !contributorIds || contributorIds.length === 0) {
            setContributorUsers([]);
            setIsLoading(false);
            setError(null);
            return;
        }

        const fetchContributorProfiles = async () => {
            setIsLoading(true);
            setError(null);
            
            try {
                const profiles = await fetchUserProfilesByIds(contributorIds);
                setContributorUsers(profiles);
            } catch (err) {
                console.error('Failed to fetch contributor profiles:', err);
                setError(err instanceof Error ? err.message : 'Failed to fetch contributor profiles');
                setContributorUsers(undefined);
            } finally {
                setIsLoading(false);
            }
        };

        fetchContributorProfiles();
    }, [contributorIds, enabled]);

    return {
        contributorUsers,
        isLoading,
        error
    };
}
