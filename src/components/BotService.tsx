import { useEffect, useRef } from 'react';
import { auth, db } from '../../firebase';
import { ref, onChildAdded, push, get } from 'firebase/database';

export function BotService() {
  const counterRef = useRef<number>(1);
  const currentUser = auth.currentUser;

  useEffect(() => {
    // Nếu chưa đăng nhập thì không chạy listener
    if (!currentUser) return;

    // 🔥 SỬA TẠI ĐÂY: Chỉ lắng nghe phòng chat riêng của User hiện tại
    const botMessagesRef = ref(db, `messages/bot_${currentUser.uid}`);
    const startTime = Date.now();

    // Tự động tạo tin nhắn chào mừng nếu phòng bot cá nhân chưa có dữ liệu
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
            text: `🤖 [Test Bot]: ${currentNum}`,
            createdAt: Date.now(),
            isBot: true,
          });
        }, 500);
      }
    });

    return () => unsubscribe();
  }, [currentUser]);

  return null;
}