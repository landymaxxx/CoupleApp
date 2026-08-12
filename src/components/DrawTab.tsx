// @ts-nocheck
import React, { useEffect, useRef, useState } from 'react';
import {
  GestureResponderEvent,
  PanResponder,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { get, onValue, ref, set } from 'firebase/database';
import { auth, db } from '../../firebase';
import { useTheme } from '../context/ThemeContext';

interface DrawTabProps {
  loverId?: string;
}

const DrawTab: React.FC<DrawTabProps> = ({ loverId }) => {
  const { bgColor } = useTheme();
  const [paths, setPaths] = useState<string[]>([]);
  const [currentPath, setCurrentPath] = useState<string>('');
  const currentUser = auth.currentUser;

  const canvasRef = useRef<View>(null);
  const currentPathRef = useRef<string>('');

  // Xác định đường dẫn lưu nét vẽ Realtime
  const getDrawingPath = () => {
    if (!currentUser) return null;
    if (loverId) {
      const roomId = [currentUser.uid, loverId].sort().join('_');
      return `drawings/couples/${roomId}`;
    }
    return `drawings/personal/${currentUser.uid}`;
  };

  const drawingPath = getDrawingPath();

  // Lắng nghe dữ liệu nét vẽ Realtime từ Firebase
  useEffect(() => {
    if (!drawingPath) return;

    let isMounted = true;
    const drawingRef = ref(db, drawingPath);
    const unsubscribe = onValue(drawingRef, (snapshot) => {
      if (!isMounted) return;
      const data = snapshot.val();
      setPaths(data || []);
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [drawingPath]);

  // Khởi tạo PanResponder xử lý vuốt/vẽ trên màn hình
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
        if (finishedPath) {
          const updatedPaths = [...paths, finishedPath];
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

  // Xử lý Hoàn tác nét vẽ cuối
  const handleUndo = () => {
    if (paths.length === 0) return;
    const updatedPaths = paths.slice(0, -1);
    setPaths(updatedPaths);
    if (drawingPath) {
      set(ref(db, drawingPath), updatedPaths);
    }
  };

  // Xử lý Xóa sạch bảng vẽ
  const handleClearDraw = () => {
    setPaths([]);
    if (drawingPath) {
      set(ref(db, drawingPath), []);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: bgColor }]}>
      {/* Header thanh công cụ vẽ */}
      <View style={styles.drawHeader}>
        <Text style={styles.drawTitle}>
          {loverId ? 'Bảng Vẽ Đôi Realtime 💕' : 'Bảng Vẽ Cá Nhân 👤'}
        </Text>
        <View style={styles.actionButtons}>
          <TouchableOpacity style={[styles.btn, styles.undoBtn]} onPress={handleUndo}>
            <Text style={styles.undoBtnText}>↩ Hoàn tác</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.btn, styles.clearBtn]} onPress={handleClearDraw}>
            <Text style={styles.clearBtnText}>Xóa</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Vùng cảm ứng vẽ SVG */}
      <View
        ref={canvasRef}
        collapsable={false}
        style={styles.canvasContainer}
        {...panResponder.panHandlers}
      >
        <Svg style={styles.svg}>
          {paths.map((pathStr: string, index: number) => (
            <Path
              key={`path-${index}`}
              d={pathStr}
              stroke="#FF4B4B"
              strokeWidth={5}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}
          {currentPath !== '' && (
            <Path
              d={currentPath}
              stroke="#FF4B4B"
              strokeWidth={5}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}
        </Svg>
      </View>
    </View>
  );
};

export default DrawTab;

const styles = StyleSheet.create({
  container: { flex: 1 },
  drawHeader: {
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
  },
  drawTitle: { fontSize: 14, fontWeight: 'bold', color: '#333' },
  actionButtons: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  btn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6 },
  undoBtn: { backgroundColor: '#E0E0E0' },
  undoBtnText: { color: '#333', fontWeight: '600', fontSize: 12 },
  clearBtn: { backgroundColor: '#FF4B4B' },
  clearBtnText: { color: '#FFF', fontWeight: '600', fontSize: 12 },
  canvasContainer: { flex: 1, backgroundColor: '#FFFFFF' },
  svg: { flex: 1 },
});