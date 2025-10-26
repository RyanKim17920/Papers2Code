import { useState } from 'react';
import { api } from '../services/api';

interface EmailContent {
    subject: string;
    body: string;
}

interface UseAuthorOutreachEmailResult {
    emailContent: EmailContent | null;
    fetchEmailContent: () => Promise<void>;
    isFetchingEmail: boolean;
    emailError: string | null;
    clearEmailContent: () => void;
}

export const useAuthorOutreachEmail = (paperId: string): UseAuthorOutreachEmailResult => {
    const [emailContent, setEmailContent] = useState<EmailContent | null>(null);
    const [isFetchingEmail, setIsFetchingEmail] = useState(false);
    const [emailError, setEmailError] = useState<string | null>(null);

    const clearEmailContent = () => {
        setEmailContent(null);
    };

    const fetchEmailContent = async () => {
        setIsFetchingEmail(true);
        setEmailError(null);
        try {
            const response = await api.post(`/api/implementation-progress/paper/${paperId}/send-author-email`);
            const data = response.data; // Axios puts the response data in .data
            setEmailContent(data);
        } catch (err) {
            console.error('Failed to fetch email content in hook:', err);
            setEmailError('Failed to load email content. Please try again.');
        } finally {
            setIsFetchingEmail(false);
        }
    };

    return {
        emailContent,
        fetchEmailContent,
        isFetchingEmail,
        emailError,
        clearEmailContent,
    };
};
