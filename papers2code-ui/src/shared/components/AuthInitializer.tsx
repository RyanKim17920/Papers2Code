import { useEffect } from 'react';
import { useModal } from '../context/ModalContext';
import { setLoginPromptHandler } from '../services/api';

const AuthInitializer = () => {
  const { showLoginPrompt } = useModal();

  useEffect(() => {
    setLoginPromptHandler(showLoginPrompt);
  }, [showLoginPrompt]);

  return null; // This component doesn't render anything itself
};

export default AuthInitializer;