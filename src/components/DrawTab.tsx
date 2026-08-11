import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  GestureResponderEvent,
  PanResponder,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { captureRef } from 'react-native-view-shot'; // 👈 Dùng captureRef thay vì import ViewShot component
import { get, onValue, ref, set } from 'firebase/database';
import { auth, db } from '../../firebase';
import { useTheme } from '../context/ThemeContext';

interface DrawTabProps {
  loverId?: string;
}

const DrawTab: React.FC<DrawTabProps> = ({ loverId }) => {
  const { bgColor } = useTheme();
  const [paths, setPaths] = useState<string[]>([]);
  const [currentPath, setCurrentPath] = useState<string[]>([]);
  const currentUser = auth.currentUser;

  // 🎯 Ref gán trực tiếp cho View canvas (Dùng type View chuẩn của React Native)
  const canvasRef = useRef<View>(null);

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
      const data = snapshot.val();
      setPaths(data || []);
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [drawingPath]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt: GestureResponderEvent) => {
        const { locationX, locationY } = evt.nativeEvent;
        setCurrentPath([`M ${locationX} ${locationY}`]);
      },
      onPanResponderMove: (evt: GestureResponderEvent) => {
        const { locationX, locationY } = evt.nativeEvent;
        setCurrentPath((prev) => [...prev, `L ${locationX} ${locationY}`]);
      },
      onPanResponderRelease: () => {
        setCurrentPath((prevCurrent) => {
          if (prevCurrent.length > 0) {
            const pathString = prevCurrent.join(' ');
            setPaths((prevPaths) => {
              const updated = [...prevPaths, pathString];
              if (drawingPath) {
                set(ref(db, drawingPath), updated);
              }
              return updated;
            });
          }
          return [];
        });
      },
    })
  ).current;

  const handleClearDraw = () => {
    setPaths([]);
    if (drawingPath) {
      set(ref(db, drawingPath), []);
    }
  };

  // 🔥 HÀM CHỤP VÀ GỬI HÌNH VẼ NÉN BASE64
  const handleSendToLoverLockscreen = async () => {
    if (!currentUser) return;
    if (paths.length === 0) {
      Alert.alert('Thông báo', 'Bạn chưa vẽ hình nào để gửi!');
      return;
    }

    try {
      const myUserSnap = await get(ref(db, `users/${currentUser.uid}`));
      const currentLoverId = myUserSnap.val()?.loverId;

      if (!currentLoverId) {
        Alert.alert('Chưa có Bạn Đời', 'Bạn cần kết bạn đời trước để dùng tính năng này!');
        return;
      }

      // 📸 Chụp vùng vẽ bằng captureRef
      let imageBase64 = '';
      if (canvasRef.current) {
        imageBase64 = await captureRef(canvasRef, {
          format: 'jpg',
          quality: 0.5,
          result: 'base64',
        });
      }

      const imageUri = `data:image/jpeg;base64,${imageBase64}`;

      // 💾 Lưu hình chụp dạng Base64 sang node của bạn đời
      await set(ref(db, `loverDrawings/${currentLoverId}`), {
        imageUri: imageUri,
        senderName: myUserSnap.val()?.username || 'Bạn đời',
        timestamp: Date.now(),
      });

      Alert.alert('Thành công 💕', 'Hình vẽ đã được gửi tới Widget của bạn đời!');
    } catch (error: any) {
      Alert.alert('Lỗi', error.message);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: bgColor }]}>
      <View style={styles.drawHeader}>
        <Text style={styles.drawTitle}>
          {loverId ? 'Bảng Vẽ Đôi Realtime 💕' : 'Bảng Vẽ Cá Nhân 👤'}
        </Text>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          <TouchableOpacity style={styles.sendLoverBtn} onPress={handleSendToLoverLockscreen}>
            <Text style={styles.sendLoverText}>📲 Gửi bạn đời</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.clearBtn} onPress={handleClearDraw}>
            <Text style={styles.clearBtnText}>Xóa</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* 📸 GẮN REF VÀO CANVAS VIEW VÀ THÊM collapsable={false} CHO ANDROID */}
      <View
        ref={canvasRef}
        collapsable={false}
        style={styles.canvasContainer}
        {...panResponder.panHandlers}
      >
        <Svg style={styles.svg}>
          {paths.map((pathStr: string, index: number) => (
            <Path
              key={index}
              d={pathStr}
              stroke="#FF4B4B"
              strokeWidth={5}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}
          {currentPath.length > 0 && (
            <Path
              d={currentPath.join(' ')}
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
  drawTitle: { fontSize: 15, fontWeight: 'bold', color: '#333' },
  sendLoverBtn: { backgroundColor: '#FFEAEA', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6 },
  sendLoverText: { color: '#FF4B4B', fontWeight: 'bold', fontSize: 12 },
  clearBtn: { backgroundColor: '#FF4B4B', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6 },
  clearBtnText: { color: '#FFF', fontWeight: '600', fontSize: 12 },
  canvasContainer: { flex: 1, backgroundColor: '#FFFFFF' },
  svg: { flex: 1 },
});