import { useCallback } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../services/config';

interface PaperViewData {
  paperId: string;
  cameFrom?: string;
}

export const useActivityTracking = () => {
  const trackPaperView = useCallback(async (data: PaperViewData) => {
    try {
      await axios.post(`${API_BASE_URL}/activity/paper-view`, {
        paperId: data.paperId,
        metadata: {
          cameFrom: data.cameFrom || 'direct'
        }
      });
    } catch (error) {
      console.error('Failed to track paper view:', error);
      // Don't throw - activity tracking should be non-blocking
    }
  }, []);

  return {
    trackPaperView
  };
};
