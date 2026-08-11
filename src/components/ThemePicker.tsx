import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useTheme, PRESET_COLORS } from '../context/ThemeContext';

export default function ThemePicker() {
  const { bgColor, changeBgColor } = useTheme();

  const handleSelectColor = async (color: string) => {
    try {
      await changeBgColor(color);
    } catch (error: any) {
      Alert.alert('Lỗi', error.message);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>🎨 Màu nền ứng dụng (Cá nhân)</Text>
      <View style={styles.colorPalette}>
        {PRESET_COLORS.map((item) => {
          const isSelected = bgColor === item.color;
          return (
            <TouchableOpacity
              key={item.color}
              style={[
                styles.colorCircle,
                { backgroundColor: item.color },
                isSelected && styles.colorCircleSelected,
              ]}
              onPress={() => handleSelectColor(item.color)}
            >
              {isSelected && <Text style={styles.checkMark}>✓</Text>}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginVertical: 5 },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: '#333', marginBottom: 10 },
  colorPalette: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 5 },
  colorCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    borderColor: '#DDD',
    justifyContent: 'center',
    alignItems: 'center',
  },
  colorCircleSelected: {
    borderWidth: 3,
    borderColor: '#FF4B4B',
  },
  checkMark: { color: '#FF4B4B', fontWeight: 'bold', fontSize: 18 },
});