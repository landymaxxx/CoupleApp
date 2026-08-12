// @ts-nocheck
import { onAuthStateChanged } from 'firebase/auth';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { ThemeProvider } from '../context/ThemeContext';
import { auth } from '../../firebase';

import LoginScreen from '../screen/LoginScreen';
import MainApp from '../screen/MainApp';
import RegisterScreen from '../screen/RegisterScreen';

export default function Page() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authScreen, setAuthScreen] = useState<'login' | 'register'>('login');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#FF4B4B" />
      </View>
    );
  }

  // Đã đăng nhập -> Vào App chính
  if (user) {
    return (
      <ThemeProvider>
        <MainApp />
      </ThemeProvider>
    );
  }

  // Chưa đăng nhập -> Hiện Đăng nhập hoặc Đăng ký
  return authScreen === 'login' ? (
    <LoginScreen onSwitch={() => setAuthScreen('register')} />
  ) : (
    <RegisterScreen onSwitch={() => setAuthScreen('login')} />
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFF' },
});