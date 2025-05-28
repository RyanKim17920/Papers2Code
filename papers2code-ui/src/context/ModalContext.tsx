import React, { createContext, useContext, useState, ReactNode } from 'react';

interface ModalContextType {
  showLoginPrompt: (message?: string) => void;
  hideLoginPrompt: () => void;
  isLoginPromptOpen: boolean;
  loginPromptMessage: string | undefined;
}

const ModalContext = createContext<ModalContextType | undefined>(undefined);

export const ModalProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isLoginPromptOpen, setIsLoginPromptOpen] = useState(false);
  const [loginPromptMessage, setLoginPromptMessage] = useState<string | undefined>(undefined);

  const showLoginPrompt = (message?: string) => {
    setLoginPromptMessage(message);
    setIsLoginPromptOpen(true);
  };

  const hideLoginPrompt = () => {
    setIsLoginPromptOpen(false);
    setLoginPromptMessage(undefined);
  };

  return (
    <ModalContext.Provider value={{ showLoginPrompt, hideLoginPrompt, isLoginPromptOpen, loginPromptMessage }}>
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
