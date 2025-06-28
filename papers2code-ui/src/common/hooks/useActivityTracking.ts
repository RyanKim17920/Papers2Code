import { useCallback } from 'react';
import { trackPaperViewInApi, PaperViewData } from '../services/api';

export const useActivityTracking = () => {
  const trackPaperView = useCallback(async (data: PaperViewData) => {
    await trackPaperViewInApi(data);
  }, []);

  return {
    trackPaperView
  };
};
