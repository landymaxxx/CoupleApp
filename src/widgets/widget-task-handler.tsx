import React from 'react';
import type { WidgetTaskHandlerProps } from 'react-native-android-widget';
import { LoverWidget } from './LoverWidget';

export async function widgetTaskHandler(props: WidgetTaskHandlerProps) {
  const { widgetAction, renderWidget } = props;

  switch (widgetAction) {
    case 'WIDGET_ADDED':
    case 'WIDGET_UPDATE':
    case 'WIDGET_RESIZED':
      // Hiển thị giao diện mặc định khi vừa kéo Widget ra màn hình chính
      renderWidget(<LoverWidget />);
      break;

    case 'WIDGET_DELETED':
      // Xử lý dọn dẹp nếu cần khi người dùng xóa Widget khỏi màn hình
      break;

    default:
      break;
  }
}