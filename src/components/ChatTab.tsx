// @ts-nocheck
import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { onValue, push, ref, remove } from 'firebase/database';
import { auth, db } from '../../firebase';
import { useTheme } from '../context/ThemeContext';
import { useUI } from '../context/UIContext';
import { UserItem } from './SearchUsersModal';

interface Message {
  id: string;
  text: string;
  createdAt: number;
  senderId?: string;
  isBot?: boolean;
}

interface ChatRoom {
  id: string;
  name: string;
  isBot?: boolean;
  pfp?: string;
}

interface ChatTabProps {
  targetUser?: UserItem | null;
  onClearTarget?: () => void;
  onToggleDetail?: (isDetail: boolean) => void;
}

export default function ChatTab({ targetUser, onClearTarget, onToggleDetail }: ChatTabProps) {
  const { bgColor } = useTheme();
  const uiContext = useUI();
  
  const setBottomBarHidden = uiContext?.setBottomBarHidden || uiContext?.setIsBottomBarHidden;
  const insets = useSafeAreaInsets();

  const [selectedRoom, setSelectedRoom] = useState<ChatRoom | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [chatList, setChatList] = useState<ChatRoom[]>([]);
  const [myPfp, setMyPfp] = useState<string | undefined>(undefined);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

  const flatListRef = useRef<FlatList>(null);
  const currentUser = auth.currentUser;

  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => setIsKeyboardVisible(true)
    );
    const hideSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setIsKeyboardVisible(false)
    );
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  useEffect(() => {
    const isDetail = !!selectedRoom;
    if (setBottomBarHidden) {
      setBottomBarHidden(isDetail);
    }
    if (onToggleDetail) {
      onToggleDetail(isDetail);
    }
    return () => {
      if (setBottomBarHidden) {
        setBottomBarHidden(false);
      }
    };
  }, [selectedRoom, setBottomBarHidden, onToggleDetail]);

  const formatTime = (timestamp: number) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  useEffect(() => {
    if (!currentUser) return;
    const myUserRef = ref(db, `users/${currentUser.uid}`);
    const unsubscribeMyUser = onValue(myUserRef, (snapshot) => {
      if (snapshot.exists()) {
        setMyPfp(snapshot.val().pfp);
      }
    });
    return () => unsubscribeMyUser();
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser) return;

    const botRoom: ChatRoom = {
      id: 'bot_chat',
      name: 'Test Bot 🤖',
      isBot: true,
    };

    const friendsRef = ref(db, `friends/${currentUser.uid}`);
    const usersRef = ref(db, 'users');

    const unsubscribeFriends = onValue(friendsRef, (friendsSnap) => {
      const friendsData = friendsSnap.val() || {};
      const friendIds = Object.keys(friendsData);

      onValue(usersRef, (usersSnap) => {
        const usersData = usersSnap.val() || {};
        const friendsList: ChatRoom[] = friendIds
          .filter((id) => usersData[id])
          .map((id) => {
            const roomId = [currentUser.uid, id].sort().join('_');
            return {
              id: roomId,
              name: usersData[id].username || 'Người dùng',
              pfp: usersData[id].pfp,
            };
          });

        setChatList([botRoom, ...friendsList]);
      });
    });

    return () => unsubscribeFriends();
  }, [currentUser]);

  useEffect(() => {
    if (targetUser && currentUser) {
      const roomId = [currentUser.uid, targetUser.id].sort().join('_');
      setSelectedRoom({
        id: roomId,
        name: targetUser.username,
        pfp: targetUser.pfp,
      });
    }
  }, [targetUser, currentUser]);

  useEffect(() => {
    if (!selectedRoom) return;

    const roomRef = ref(db, `messages/${selectedRoom.id}`);
    const unsubscribe = onValue(roomRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const list: Message[] = Object.keys(data).map((key) => ({
          id: key,
          ...data[key],
        }));
        list.sort((a, b) => a.createdAt - b.createdAt);
        setMessages(list);
      } else {
        setMessages([]);
      }
    });

    return () => unsubscribe();
  }, [selectedRoom]);

  const handleSendMessage = () => {
    if (!inputText.trim() || !selectedRoom || !currentUser) return;
    const roomRef = ref(db, `messages/${selectedRoom.id}`);
    const textToSend = inputText.trim();

    setInputText('');

    push(roomRef, {
      text: textToSend,
      createdAt: Date.now(),
      senderId: currentUser.uid,
    });

    if (selectedRoom.isBot) {
      setTimeout(() => {
        push(roomRef, {
          text: `🤖 Tôi đã nhận được tin nhắn: "${textToSend}"`,
          createdAt: Date.now(),
          senderId: 'bot_id',
          isBot: true,
        });
      }, 800);
    }
  };

  const handleClearHistory = () => {
    if (!selectedRoom) return;

    Alert.alert(
      'Xóa cuộc trò chuyện',
      `Bạn có chắc muốn xóa tất cả tin nhắn với ${selectedRoom.name}?`,
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Xóa sạch',
          style: 'destructive',
          onPress: async () => {
            try {
              await remove(ref(db, `messages/${selectedRoom.id}`));
            } catch (error: any) {
              Alert.alert('Lỗi', error.message);
            }
          },
        },
      ]
    );
  };

  const handleBack = () => {
    setSelectedRoom(null);
    if (setBottomBarHidden) {
      setBottomBarHidden(false);
    }
    if (onClearTarget) onClearTarget();
    if (onToggleDetail) onToggleDetail(false);
  };

  if (!selectedRoom) {
    return (
      <View style={[styles.container, { backgroundColor: bgColor }]}>
        <FlatList
          data={chatList}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 12, paddingBottom: insets.bottom + 12 }}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.chatListItem} onPress={() => setSelectedRoom(item)}>
              {item.isBot ? (
                <View style={[styles.avatarCircle, { backgroundColor: '#4A90E2' }]}>
                  <Text style={styles.avatarText}>🤖</Text>
                </View>
              ) : item.pfp ? (
                <Image source={{ uri: item.pfp }} style={styles.listAvatar} />
              ) : (
                <View style={styles.avatarCircle}>
                  <Text style={styles.avatarText}>
                    {item.name ? item.name.charAt(0).toUpperCase() : 'U'}
                  </Text>
                </View>
              )}

              <View style={styles.chatListItemInfo}>
                <Text style={styles.chatListItemName}>{item.name}</Text>
                <Text style={styles.chatListItemSub}>
                  {item.isBot ? 'Bot tự động phản hồi' : 'Nhấn để trò chuyện'}
                </Text>
              </View>
              <Text style={styles.arrowText}>›</Text>
            </TouchableOpacity>
          )}
        />
      </View>
    );
  }

  // Tính toán khoảng offset chuẩn xác cho Android khi bật/tắt phím
  const androidOffset = insets.top + 60; 

  return (
    <View style={[styles.container, { backgroundColor: bgColor, paddingTop: insets.top }]}>
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={handleBack} style={styles.backBtn}>
          <Text style={styles.backBtnText}>‹ Quay lại</Text>
        </TouchableOpacity>

        <View style={styles.headerTitleContainer}>
          {selectedRoom.isBot ? (
            <View style={[styles.headerAvatarCircle, { backgroundColor: '#4A90E2' }]}>
              <Text style={styles.headerAvatarText}>🤖</Text>
            </View>
          ) : selectedRoom.pfp ? (
            <Image source={{ uri: selectedRoom.pfp }} style={styles.headerAvatar} />
          ) : (
            <View style={styles.headerAvatarCircle}>
              <Text style={styles.headerAvatarText}>
                {selectedRoom.name ? selectedRoom.name.charAt(0).toUpperCase() : 'U'}
              </Text>
            </View>
          )}
          <Text style={styles.headerTitle}>{selectedRoom.name}</Text>
        </View>

        <TouchableOpacity onPress={handleClearHistory} style={styles.clearBtn}>
          <Text style={{ fontSize: 16 }}>🗑️</Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : androidOffset}
      >
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          style={{ flex: 1 }}
          contentContainerStyle={styles.messageList}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
          onLayout={() => flatListRef.current?.scrollToEnd({ animated: true })}
          renderItem={({ item }) => {
            const isMe = item.senderId === currentUser?.uid;
            return (
              <View style={[styles.messageRow, isMe ? styles.userRow : styles.otherRow]}>
                {!isMe &&
                  (selectedRoom.isBot ? (
                    <View style={[styles.msgAvatarCircle, { backgroundColor: '#4A90E2' }]}>
                      <Text style={styles.msgAvatarText}>🤖</Text>
                    </View>
                  ) : selectedRoom.pfp ? (
                    <Image source={{ uri: selectedRoom.pfp }} style={styles.msgAvatar} />
                  ) : (
                    <View style={styles.msgAvatarCircle}>
                      <Text style={styles.msgAvatarText}>
                        {selectedRoom.name ? selectedRoom.name.charAt(0).toUpperCase() : 'U'}
                      </Text>
                    </View>
                  ))}

                <View style={{ maxWidth: '78%' }}>
                  <View style={[styles.messageBubble, isMe ? styles.userBubble : styles.otherBubble]}>
                    <Text style={isMe ? styles.userText : styles.otherText}>{item.text}</Text>
                  </View>
                  <Text style={[styles.timeText, isMe ? { textAlign: 'right' } : { textAlign: 'left' }]}>
                    {formatTime(item.createdAt)}
                  </Text>
                </View>

                {isMe &&
                  (myPfp ? (
                    <Image source={{ uri: myPfp }} style={styles.msgAvatar} />
                  ) : (
                    <View style={styles.msgAvatarCircle}>
                      <Text style={styles.msgAvatarText}>
                        {currentUser?.displayName ? currentUser.displayName.charAt(0).toUpperCase() : 'Tôi'}
                      </Text>
                    </View>
                  ))}
              </View>
            );
          }}
        />

        <View
          style={[
            styles.inputContainer,
            {
              paddingBottom: isKeyboardVisible
                ? 8
                : Math.max(insets.bottom, 12),
            },
          ]}
        >
          <TextInput
            style={styles.input}
            placeholder="Nhập tin nhắn..."
            placeholderTextColor="#999"
            value={inputText}
            onChangeText={setInputText}
          />
          <TouchableOpacity style={styles.sendButton} onPress={handleSendMessage}>
            <Text style={styles.sendButtonText}>Gửi</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  keyboardView: { flex: 1 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderColor: '#EEEEEE',
  },
  headerTitleContainer: { flexDirection: 'row', alignItems: 'center' },
  headerAvatar: { width: 28, height: 28, borderRadius: 14, marginRight: 8 },
  headerAvatarCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FF4B4B',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  headerAvatarText: { color: '#FFF', fontWeight: 'bold', fontSize: 13 },
  headerTitle: { fontSize: 15, fontWeight: 'bold', color: '#333' },
  backBtn: { paddingVertical: 4, paddingRight: 8 },
  backBtnText: { color: '#FF4B4B', fontSize: 14, fontWeight: '600' },
  clearBtn: { padding: 4 },
  chatListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
  },
  listAvatar: { width: 40, height: 40, borderRadius: 20, marginRight: 12 },
  avatarCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FF4B4B',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: { color: '#FFF', fontWeight: 'bold', fontSize: 16 },
  chatListItemInfo: { flex: 1 },
  chatListItemName: { fontSize: 15, fontWeight: 'bold', color: '#333' },
  chatListItemSub: { fontSize: 12, color: '#888', marginTop: 2 },
  arrowText: { fontSize: 18, color: '#CCC' },
  messageList: { paddingHorizontal: 12, paddingVertical: 8 },
  messageRow: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: 8 },
  userRow: { justifyContent: 'flex-end' },
  otherRow: { justifyContent: 'flex-start' },
  msgAvatar: { width: 26, height: 26, borderRadius: 13, marginHorizontal: 4 },
  msgAvatarCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#FF4B4B',
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 4,
  },
  msgAvatarText: { color: '#FFF', fontWeight: 'bold', fontSize: 11 },
  messageBubble: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16 },
  userBubble: { backgroundColor: '#FF4B4B', borderBottomRightRadius: 2 },
  otherBubble: {
    backgroundColor: '#FFFFFF',
    borderBottomLeftRadius: 2,
    borderWidth: 1,
    borderColor: '#EFEFEF',
  },
  userText: { color: '#FFFFFF', fontSize: 14, lineHeight: 18 },
  otherText: { color: '#212529', fontSize: 14, lineHeight: 18 },
  timeText: { fontSize: 9, color: '#A0A0A0', marginTop: 2, marginHorizontal: 2 },
  inputContainer: {
    flexDirection: 'row',
    paddingHorizontal: 10,
    paddingTop: 8,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderColor: '#EEEEEE',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    backgroundColor: '#F3F3F3',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 6,
    minHeight: 38,
    maxHeight: 100,
    fontSize: 14,
    color: '#333',
  },
  sendButton: {
    backgroundColor: '#FF4B4B',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginLeft: 6,
  },
  sendButtonText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 13 },
});