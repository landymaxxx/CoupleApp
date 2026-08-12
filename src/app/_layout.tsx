import * as SplashScreen from 'expo-splash-screen';
import { View } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import AppTabs from '@/components/app-tabs';
import { BotService } from '@/components/BotService';
import { UIProvider } from '@/context/UIContext';

SplashScreen.preventAutoHideAsync();

export default function TabLayout() {
  return (
    <UIProvider>
      <View style={{ flex: 1 }}>
        <BotService />
        <AnimatedSplashOverlay />
        <AppTabs />
      </View>
    </UIProvider>
  );
}