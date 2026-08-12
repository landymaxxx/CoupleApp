import React, { createContext, useContext, useState } from 'react';

interface UIContextType {
  isBottomBarHidden: boolean;
  setBottomBarHidden: (hidden: boolean) => void;
}

const UIContext = createContext<UIContextType>({
  isBottomBarHidden: false,
  setBottomBarHidden: () => {},
});

export const UIProvider = ({ children }: { children: React.ReactNode }) => {
  const [isBottomBarHidden, setBottomBarHidden] = useState(false);

  return (
    <UIContext.Provider value={{ isBottomBarHidden, setBottomBarHidden }}>
      {children}
    </UIContext.Provider>
  );
};

export const useUI = () => useContext(UIContext);