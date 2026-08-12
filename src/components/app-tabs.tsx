import { Tabs } from 'expo-router';
import { Image, useColorScheme } from 'react-native';

import { Colors } from '@/constants/theme';
import { useUI } from '@/context/UIContext';

export default function AppTabs() {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'unspecified' ? 'light' : scheme];
  const { isBottomBarHidden } = useUI();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.text,
        tabBarStyle: {
          backgroundColor: colors.background,
          display: isBottomBarHidden ? 'none' : 'flex',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => (
            <Image
              source={require('@/assets/images/tabIcons/home.png')}
              style={{ width: 24, height: 24, tintColor: color }}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="explore"
        options={{
          title: 'Explore',
          tabBarIcon: ({ color }) => (
            <Image
              source={require('@/assets/images/tabIcons/explore.png')}
              style={{ width: 24, height: 24, tintColor: color }}
            />
          ),
        }}
      />
    </Tabs>
  );
}