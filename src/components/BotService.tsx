import { useEffect, useRef } from 'react';
import { db } from '../../firebase';
import { ref, onChildAdded, push, get } from 'firebase/database';

export function BotService() {
  const counterRef = useRef<number>(1);

  useEffect(() => {
    // Chỉ lắng nghe tin nhắn trong phòng chat riêng của Bot
    const botMessagesRef = ref(db, 'messages/bot_chat');
    const startTime = Date.now();

    // Tự động tạo tin nhắn chào mừng nếu phòng bot chưa có gì
    get(botMessagesRef).then((snapshot) => {
      if (!snapshot.exists()) {
        push(botMessagesRef, {
          text: 'Chào bạn! Mình là Test Bot 🤖. Hãy nhắn gì đó để test phản hồi 1 -> 10 nhé!',
          createdAt: Date.now(),
          isBot: true,
        });
      }
    });

    const unsubscribe = onChildAdded(botMessagesRef, (snapshot) => {
      const data = snapshot.val();
      if (!data) return;

      // Phản hồi nếu là tin nhắn mới và không phải do Bot gửi
      if (!data.isBot && data.createdAt >= startTime) {
        const currentNum = counterRef.current;
        counterRef.current = currentNum >= 10 ? 1 : currentNum + 1;

        setTimeout(() => {
          push(botMessagesRef, {
            text: `${currentNum}`,
            createdAt: Date.now(),
            isBot: true,
          });
        }, 500);
      }
    });

    return () => unsubscribe();
  }, []);

  return null;
}