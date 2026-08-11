'use no memo';
import React from 'react';
import { FlexWidget, ImageWidget, TextWidget } from 'react-native-android-widget';

interface LoverWidgetProps {
  imageUri?: string;
  senderName?: string;
}

export function LoverWidget({ imageUri, senderName }: LoverWidgetProps) {
  return (
    <FlexWidget
      style={{
        height: 'match_parent',
        width: 'match_parent',
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 8,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {imageUri ? (
        <FlexWidget
          style={{
            height: 'match_parent',
            width: 'match_parent',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <TextWidget
            text={`🎨 Hình vẽ từ ${senderName || 'Bạn đời'}`}
            style={{
              color: '#FF4B4B',
              fontSize: 11,
              fontWeight: 'bold',
            }}
          />
          <ImageWidget
            image={imageUri as any}
            imageWidth={280}
            imageHeight={280}
            radius={12}
            style={{
              marginTop: 4,
            }}
          />
        </FlexWidget>
      ) : (
        <TextWidget
          text="Chưa có hình vẽ mới từ bạn đời 💕"
          style={{
            color: '#888888',
            fontSize: 12,
            textAlign: 'center',
          }}
        />
      )}
    </FlexWidget>
  );
}