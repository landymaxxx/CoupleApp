import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  PanResponder,
  GestureResponderEvent,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { db } from '../../firebase';
import { ref, onValue, set } from 'firebase/database';

const DrawTab = () => {
  const [paths, setPaths] = useState<string[]>([]);
  const [currentPath, setCurrentPath] = useState<string[]>([]);

  useEffect(() => {
    let isMounted = true; // Cờ bảo vệ state
    const drawingRef = ref(db, 'drawings/current');
    const unsubscribe = onValue(drawingRef, (snapshot) => {
      if (!isMounted) return; // Nếu đã chuyển tab thì không setPaths nữa
      const data = snapshot.val();
      if (data) {
        setPaths(data);
      } else {
        setPaths([]);
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

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
              set(ref(db, 'drawings/current'), updated);
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
    set(ref(db, 'drawings/current'), []);
  };

  return (
    <View style={styles.container}>
      <View style={styles.drawHeader}>
        <Text style={styles.drawTitle}>Bảng Vẽ Cặp Đôi 💕</Text>
        <TouchableOpacity style={styles.clearBtn} onPress={handleClearDraw}>
          <Text style={styles.clearBtnText}>Xóa hình</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.canvasContainer} {...panResponder.panHandlers}>
        <Svg style={styles.svg}>
          {paths.map((pathStr: string, index: number) => (
            <Path
              key={index} d={pathStr} stroke="#FF4B4B" strokeWidth={5}
              fill="none" strokeLinecap="round" strokeLinejoin="round"
            />
          ))}
          {currentPath.length > 0 && (
            <Path
              d={currentPath.join(' ')} stroke="#FF4B4B" strokeWidth={5}
              fill="none" strokeLinecap="round" strokeLinejoin="round"
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
    padding: 15, flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', backgroundColor: '#FFFFFF',
  },
  drawTitle: { fontSize: 16, fontWeight: 'bold', color: '#333' },
  clearBtn: {
    backgroundColor: '#FF4B4B', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6,
  },
  clearBtnText: { color: '#FFF', fontWeight: '600', fontSize: 13 },
  canvasContainer: { flex: 1, backgroundColor: '#FFFFFF' },
  svg: { flex: 1 },
});