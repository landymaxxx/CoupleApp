import React from 'react';
import type { WidgetTaskHandlerProps } from 'react-native-android-widget';
import { LoverWidget } from './LoverWidget';

// 📌 URL Firebase Realtime Database của bạn
const FIREBASE_DB_URL = "https://YOUR_FIREBASE_DB_URL.firebasedatabase.app";

export async function widgetTaskHandler(props: WidgetTaskHandlerProps) {
  const { widgetAction, renderWidget } = props;

  if (
    widgetAction === 'WIDGET_ADDED' ||
    widgetAction === 'WIDGET_UPDATE' ||
    widgetAction === 'WIDGET_RESIZED'
  ) {
    try {
      // Gọi REST API lấy bản vẽ mới nhất từ node loverDrawings
      const response = await fetch(`${FIREBASE_DB_URL}/loverDrawings.json`);
      const data = await response.json();

      if (data) {
        const keys = Object.keys(data);
        const lastKey = keys[keys.length - 1];
        const latestDrawing = data[lastKey];

        if (latestDrawing?.imageUri) {
          renderWidget(
            <LoverWidget
              imageUri={latestDrawing.imageUri}
              senderName={latestDrawing.senderName || 'Nửa kia'}
            />
          );
          return;
        }
      }
    } catch (error) {
      console.log('Lỗi cập nhật Widget ngầm qua REST API:', error);
    }

    // Hiển thị giao diện mặc định nếu chưa có hình vẽ
    renderWidget(<LoverWidget imageUri="" senderName="" />);
  }
}