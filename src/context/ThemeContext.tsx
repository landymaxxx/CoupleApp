import React, { createContext, useContext, useEffect, useState } from 'react';
import { ref, onValue, update } from 'firebase/database';
import { auth, db } from '../../firebase';

export const PRESET_COLORS = [
  { name: 'Xám sáng', color: '#F5F5F5' },
  { name: 'Hồng nhạt', color: '#FFF0F5' },
  { name: 'Xanh dương', color: '#F0F8FF' },
  { name: 'Bạc hà', color: '#F0FFF4' },
  { name: 'Tối', color: '#222222' },
];

interface ThemeContextType {
  bgColor: string;
  changeBgColor: (color: string) => Promise<void>;
}

const ThemeContext = createContext<ThemeContextType>({
  bgColor: '#F5F5F5',
  changeBgColor: async () => {},
});

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [bgColor, setBgColor] = useState('#F5F5F5');
  const currentUser = auth.currentUser;

  useEffect(() => {
    if (!currentUser) return;
    const userRef = ref(db, `users/${currentUser.uid}`);
    const unsubscribe = onValue(userRef, (snapshot) => {
      if (snapshot.exists() && snapshot.val().bgColor) {
        setBgColor(snapshot.val().bgColor);
      }
    });
    return () => unsubscribe();
  }, [currentUser]);

  const changeBgColor = async (color: string) => {
    if (!currentUser) return;
    setBgColor(color); // Đổi giao diện ngay lập tức
    await update(ref(db, `users/${currentUser.uid}`), { bgColor: color });
  };

  return (
    <ThemeContext.Provider value={{ bgColor, changeBgColor }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);