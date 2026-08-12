// @ts-nocheck
import { onAuthStateChanged } from 'firebase/auth';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { ThemeProvider } from '../context/ThemeContext';
import { auth } from '../../firebase';

// 📲 Import cho Widget & FCM
import { registerWidgetTaskHandler, requestWidgetUpdate } from 'react-native-android-widget';
import { widgetTaskHandler } from '../widgets/widget-task-handler';
import { LoverWidget } from '../widgets/LoverWidget';
import messaging from '@react-native-firebase/messaging';

import LoginScreen from '../screen/LoginScreen';
import MainApp from '../screen/MainApp';
import RegisterScreen from '../screen/RegisterScreen';

// 📌 1. Đăng ký Widget Task Handler ngay khi ứng dụng khởi chạy
registerWidgetTaskHandler(widgetTaskHandler);

// 📌 2. Đăng ký xử lý Push ngầm khi app bị KILL / tắt hoàn toàn
messaging().setBackgroundMessageHandler(async (remoteMessage) => {
  if (remoteMessage.data?.type === 'UPDATE_WIDGET') {
    const { imageUri, senderName } = remoteMessage.data;

    try {
      await requestWidgetUpdate({
        widgetName: 'LoverWidget',
        renderWidget: () => (
          <LoverWidget imageUri={imageUri} senderName={senderName} />
        ),
        widgetNotFound: () => {},
      });
    } catch (error) {
      console.log('Lỗi cập nhật Widget ngầm:', error);
    }
  }
});

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