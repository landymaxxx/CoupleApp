import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ref, onValue, push } from 'firebase/database';
import { db, auth } from '../../firebase';
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
}

export default function ChatTab({ targetUser, onClearTarget }: ChatTabProps) {
  const [selectedRoom, setSelectedRoom] = useState<ChatRoom | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  
  // Danh sách các cuộc trò chuyện
  const [chatList, setChatList] = useState<ChatRoom[]>([]);
  
  // Lưu ảnh đại diện của bản thân
  const [myPfp, setMyPfp] = useState<string | undefined>(undefined);

  const currentUser = auth.currentUser;

  // 1. Lấy thông tin & ảnh đại diện của bản thân
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

  // 2. Tải danh sách bạn bè + Con bot để hiển thị ở trang chọn Chat
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

  // 3. Khi chuyển sang chat với targetUser từ Tìm kiếm hoặc Danh sách bạn bè
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

  // 4. Lắng nghe tin nhắn Realtime
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

  // Gửi tin nhắn
  const handleSendMessage = () => {
    if (!inputText.trim() || !selectedRoom || !currentUser) return;
    const roomRef = ref(db, `messages/${selectedRoom.id}`);

    push(roomRef, {
      text: inputText.trim(),
      createdAt: Date.now(),
      senderId: currentUser.uid,
    });

    setInputText('');
  };

  // Quay lại danh sách
  const handleBack = () => {
    setSelectedRoom(null);
    if (onClearTarget) {
      onClearTarget();
    }
  };

  // MÀN HÌNH 1: Danh sách các cuộc trò chuyện
  if (!selectedRoom) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom', 'left', 'right']}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Trò Chuyện 💬</Text>
        </View>

        <FlatList
          data={chatList}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 12 }}
          ListHeaderComponent={
            <Text style={styles.sectionHeaderTitle}>Danh sách trò chuyện</Text>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.chatListItem}
              onPress={() => setSelectedRoom(item)}
            >
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
      </SafeAreaView>
    );
  }

  // MÀN HÌNH 2: Giao diện chat 1-1
  return (
    <SafeAreaView style={styles.container} edges={['bottom', 'left', 'right']}>
      {/* Header cuộc trò chuyện (Có Avatar) */}
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

        <View style={{ width: 50 }} />
      </View>

      <KeyboardAvoidingView
        style={styles.chatContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Danh sách tin nhắn (Có Avatar từng người) */}
        <FlatList
          data={messages}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.messageList}
          renderItem={({ item }) => {
            const isMe = item.senderId === currentUser?.uid;
            return (
              <View
                style={[
                  styles.messageRow,
                  isMe ? styles.userRow : styles.otherRow,
                ]}
              >
                {/* Avatar đối phương (bên trái) */}
                {!isMe && (
                  selectedRoom.isBot ? (
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
                  )
                )}

                {/* Bong bóng tin nhắn */}
                <View
                  style={[
                    styles.messageBubble,
                    isMe ? styles.userBubble : styles.otherBubble,
                  ]}
                >
                  <Text style={isMe ? styles.userText : styles.otherText}>
                    {item.text}
                  </Text>
                </View>

                {/* Avatar của tôi (bên phải) */}
                {isMe && (
                  myPfp ? (
                    <Image source={{ uri: myPfp }} style={styles.msgAvatar} />
                  ) : (
                    <View style={styles.msgAvatarCircle}>
                      <Text style={styles.msgAvatarText}>
                        {currentUser?.displayName ? currentUser.displayName.charAt(0).toUpperCase() : 'Tôi'}
                      </Text>
                    </View>
                  )
                )}
              </View>
            );
          }}
        />

        {/* Ô nhập tin nhắn */}
        <View style={styles.inputContainer}>
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  header: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderColor: '#EEEEEE',
  },
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
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 8,
  },
  headerAvatarCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FF4B4B',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  headerAvatarText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 16,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#333333',
  },
  sectionHeaderTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#888',
    marginBottom: 10,
    marginTop: 5,
  },
  backBtn: {
    padding: 4,
  },
  backBtnText: {
    color: '#FF4B4B',
    fontSize: 16,
    fontWeight: '600',
  },
  chatListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  listAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginRight: 12,
  },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FF4B4B',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 18,
  },
  chatListItemInfo: {
    flex: 1,
  },
  chatListItemName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  chatListItemSub: {
    fontSize: 13,
    color: '#888',
    marginTop: 2,
  },
  arrowText: {
    fontSize: 22,
    color: '#CCC',
    fontWeight: 'bold',
  },
  chatContainer: {
    flex: 1,
  },
  messageList: {
    padding: 12,
  },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: 12,
  },
  userRow: {
    justifyContent: 'flex-end',
  },
  otherRow: {
    justifyContent: 'flex-start',
  },
  msgAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginHorizontal: 6,
  },
  msgAvatarCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FF4B4B',
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 6,
  },
  msgAvatarText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 13,
  },
  messageBubble: {
    padding: 12,
    borderRadius: 16,
    maxWidth: '70%',
  },
  userBubble: {
    backgroundColor: '#FF4B4B',
    borderBottomRightRadius: 2,
  },
  otherBubble: {
    backgroundColor: '#E9ECEF',
    borderBottomLeftRadius: 2,
  },
  userText: {
    color: '#FFFFFF',
    fontSize: 15,
  },
  otherText: {
    color: '#212529',
    fontSize: 15,
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 10,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderColor: '#EEEEEE',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    backgroundColor: '#F1F3F5',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    color: '#333333',
  },
  sendButton: {
    backgroundColor: '#FF4B4B',
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 10,
    marginLeft: 8,
  },
  sendButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 15,
  },
});