// @ts-nocheck
import React, { useEffect, useRef, useState } from 'react';
import {
  GestureResponderEvent,
  PanResponder,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { onValue, ref, set } from 'firebase/database';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { auth, db } from '../../firebase';
import { useTheme } from '../context/ThemeContext';

interface StrokeItem {
  path: string;
  color: string;
  userId: string;
}

interface DrawTabProps {
  loverId?: string;
  onToggleDetail?: (isDetail: boolean) => void;
}

const COLOR_LIST = [
  '#FF4B4B', // Đỏ
  '#FF9500', // Cam
  '#FFCC00', // Vàng
  '#34C759', // Xanh lá
  '#007AFF', // Xanh dương
  '#5856D6', // Tím
  '#AF52DE', // Tím hồng
  '#000000', // Đen
  '#8E8E93', // Xám
];

const DrawTab: React.FC<DrawTabProps> = ({ loverId, onToggleDetail }) => {
  const { bgColor } = useTheme();
  const insets = useSafeAreaInsets();

  const [paths, setPaths] = useState<StrokeItem[]>([]);
  const [currentPath, setCurrentPath] = useState<string>('');
  const [selectedColor, setSelectedColor] = useState<string>('#FF4B4B');

  const currentUser = auth.currentUser;
  const canvasRef = useRef<View>(null);
  const currentPathRef = useRef<string>('');
  const pathsRef = useRef<StrokeItem[]>([]);
  const selectedColorRef = useRef<string>('#FF4B4B');

  useEffect(() => {
    selectedColorRef.current = selectedColor;
  }, [selectedColor]);

  useEffect(() => {
    if (onToggleDetail) {
      onToggleDetail(true);
    }
    return () => {
      if (onToggleDetail) {
        onToggleDetail(false);
      }
    };
  }, [onToggleDetail]);

  const getDrawingPath = () => {
    if (!currentUser) return null;
    if (loverId) {
      const roomId = [currentUser.uid, loverId].sort().join('_');
      return `drawings/couples/${roomId}`;
    }
    return `drawings/personal/${currentUser.uid}`;
  };

  const drawingPath = getDrawingPath();

  useEffect(() => {
    if (!drawingPath) return;

    let isMounted = true;
    const drawingRef = ref(db, drawingPath);
    const unsubscribe = onValue(drawingRef, (snapshot) => {
      if (!isMounted) return;
      const rawData = snapshot.val() || [];

      const normalizedData: StrokeItem[] = rawData.map((item: any) => {
        if (typeof item === 'string') {
          return { path: item, color: '#FF4B4B', userId: currentUser?.uid || '' };
        }
        return item;
      });

      setPaths(normalizedData);
      pathsRef.current = normalizedData;
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [drawingPath, currentUser]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt: GestureResponderEvent) => {
        const { locationX, locationY } = evt.nativeEvent;
        const startPoint = `M ${locationX.toFixed(1)} ${locationY.toFixed(1)}`;
        currentPathRef.current = startPoint;
        setCurrentPath(startPoint);
      },
      onPanResponderMove: (evt: GestureResponderEvent) => {
        const { locationX, locationY } = evt.nativeEvent;
        const newPoint = ` L ${locationX.toFixed(1)} ${locationY.toFixed(1)}`;
        currentPathRef.current += newPoint;
        setCurrentPath(currentPathRef.current);
      },
      onPanResponderRelease: () => {
        const finishedPath = currentPathRef.current;
        if (finishedPath && currentUser) {
          const newStroke: StrokeItem = {
            path: finishedPath,
            color: selectedColorRef.current,
            userId: currentUser.uid,
          };

          const updatedPaths = [...pathsRef.current, newStroke];
          pathsRef.current = updatedPaths;
          setPaths(updatedPaths);

          if (drawingPath) {
            set(ref(db, drawingPath), updatedPaths);
          }
        }
        currentPathRef.current = '';
        setCurrentPath('');
      },
    })
  ).current;

  // 🟢 Hoàn tác: Tìm nét vẽ cuối cùng của chính mình và xóa đi
  const handleUndo = () => {
    if (!currentUser || pathsRef.current.length === 0) return;

    const myLastIndex = [...pathsRef.current]
      .reverse()
      .findIndex((stroke) => stroke.userId === currentUser.uid);

    if (myLastIndex === -1) return;

    const actualIndex = pathsRef.current.length - 1 - myLastIndex;
    const updatedPaths = pathsRef.current.filter((_, idx) => idx !== actualIndex);

    pathsRef.current = updatedPaths;
    setPaths(updatedPaths);

    if (drawingPath) {
      set(ref(db, drawingPath), updatedPaths);
    }
  };

  // 🟢 Chỉ xóa nét vẽ của chính mình
  const handleClearMyDrawings = () => {
    if (!currentUser || pathsRef.current.length === 0) return;

    const updatedPaths = pathsRef.current.filter(
      (stroke) => stroke.userId !== currentUser.uid
    );

    pathsRef.current = updatedPaths;
    setPaths(updatedPaths);

    if (drawingPath) {
      set(ref(db, drawingPath), updatedPaths);
    }
  };

  // 🟢 MỚI: Xóa toàn bộ nét vẽ của cả hai
  const handleClearAllDrawings = () => {
    if (!drawingPath || pathsRef.current.length === 0) return;

    pathsRef.current = [];
    setPaths([]);
    set(ref(db, drawingPath), []);
  };

  return (
    <View style={[styles.container, { backgroundColor: bgColor, paddingBottom: insets.bottom }]}>
      <View style={styles.drawHeader}>
        <Text style={styles.drawTitle}>
          {loverId ? 'Bảng Vẽ Đôi Realtime 💕' : 'Bảng Vẽ Cá Nhân 👤'}
        </Text>
        <View style={styles.actionButtons}>
          <TouchableOpacity style={[styles.btn, styles.undoBtn]} onPress={handleUndo}>
            <Text style={styles.undoBtnText}>↩ Hoàn tác</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.btn, styles.clearBtn]} onPress={handleClearMyDrawings}>
            <Text style={styles.clearBtnText}>Xóa nét tôi</Text>
          </TouchableOpacity>

          {/* 🟢 Nút xóa tất cả / xóa cả 2 */}
          <TouchableOpacity style={[styles.btn, styles.clearAllBtn]} onPress={handleClearAllDrawings}>
            <Text style={styles.clearBtnText}>Xóa tất cả</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View
        ref={canvasRef}
        collapsable={false}
        style={styles.canvasContainer}
        {...panResponder.panHandlers}
      >
        <Svg style={styles.svg}>
          {paths.map((item: StrokeItem, index: number) => (
            <Path
              key={`path-${index}`}
              d={item.path}
              stroke={item.color || '#FF4B4B'}
              strokeWidth={5}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}
          {currentPath !== '' && (
            <Path
              d={currentPath}
              stroke={selectedColor}
              strokeWidth={5}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}
        </Svg>
      </View>

      <View style={styles.paletteContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.colorList}>
          {COLOR_LIST.map((color) => {
            const isSelected = selectedColor === color;
            return (
              <TouchableOpacity
                key={color}
                style={[
                  styles.colorCircle,
                  { backgroundColor: color },
                  isSelected && styles.selectedColorCircle,
                ]}
                onPress={() => setSelectedColor(color)}
              />
            );
          })}
        </ScrollView>
      </View>
    </View>
  );
};

export default DrawTab;

const styles = StyleSheet.create({
  container: { flex: 1 },
  drawHeader: {
    padding: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
  },
  drawTitle: { fontSize: 13, fontWeight: 'bold', color: '#333' },
  actionButtons: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  btn: { paddingHorizontal: 8, paddingVertical: 5, borderRadius: 6 },
  undoBtn: { backgroundColor: '#E0E0E0' },
  undoBtnText: { color: '#333', fontWeight: '600', fontSize: 11 },
  clearBtn: { backgroundColor: '#FF9500' },
  clearAllBtn: { backgroundColor: '#FF4B4B' }, // Màu đỏ đậm hơn cho nút xóa tất cả
  clearBtnText: { color: '#FFF', fontWeight: '600', fontSize: 11 },
  canvasContainer: { flex: 1, backgroundColor: '#FFFFFF' },
  svg: { flex: 1 },
  paletteContainer: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#EEEEEE',
  },
  colorList: {
    paddingHorizontal: 12,
    alignItems: 'center',
    gap: 12,
  },
  colorCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
  },
  selectedColorCircle: {
    borderWidth: 3,
    borderColor: '#333333',
    transform: [{ scale: 1.15 }],
  },
});