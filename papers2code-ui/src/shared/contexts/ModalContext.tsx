import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { setLoginPromptHandler } from '../services/api';

interface ModalAction {
  label: string;
  onClick: () => void;
  color?: 'primary' | 'secondary' | 'error' | 'warning' | 'info' | 'success';
  variant?: 'text' | 'outlined' | 'contained';
}

interface ModalOptions {
  title: string;
  message: string;
  actions: ModalAction[];
}

interface ModalContextType {
  showLoginPrompt: (message?: string) => void;
  hideLoginPrompt: () => void;
  isLoginPromptOpen: boolean;
  loginPromptMessage: string | undefined;
  showModal: (options: ModalOptions) => void;
  hideModal: () => void;
  isModalOpen: boolean;
  modalOptions: ModalOptions | null;
}

const ModalContext = createContext<ModalContextType | undefined>(undefined);

export const ModalProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isLoginPromptOpen, setIsLoginPromptOpen] = useState(false);
  const [loginPromptMessage, setLoginPromptMessage] = useState<string | undefined>(undefined);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalOptions, setModalOptions] = useState<ModalOptions | null>(null);

  const showLoginPrompt = (message?: string) => {
    setLoginPromptMessage(message);
    setIsLoginPromptOpen(true);
  };

  const hideLoginPrompt = () => {
    setIsLoginPromptOpen(false);
    setLoginPromptMessage(undefined);
  };

  const showModal = (options: ModalOptions) => {
    setModalOptions(options);
    setIsModalOpen(true);
  };

  const hideModal = () => {
    setIsModalOpen(false);
    setModalOptions(null);
  };

  // Register the showLoginPrompt with the API service on mount
  useEffect(() => {
    setLoginPromptHandler(showLoginPrompt);
  }, []);

  return (
    <ModalContext.Provider value={{ 
      showLoginPrompt, 
      hideLoginPrompt, 
      isLoginPromptOpen, 
      loginPromptMessage,
      showModal,
      hideModal,
      isModalOpen,
      modalOptions
    }}>
      {children}
    </ModalContext.Provider>
  );
};

export const useModal = () => {
  const context = useContext(ModalContext);
  if (context === undefined) {
    throw new Error('useModal must be used within a ModalProvider');
  }
  return context;
};
