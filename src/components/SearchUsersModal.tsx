import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { ref, onValue, set } from 'firebase/database';
import { db, auth } from '../../firebase';

export interface UserItem {
  id: string;
  username: string;
  email?: string;
  pfp?: string;
}

interface SearchUsersModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectUser?: (user: UserItem) => void;
}

export default function SearchUsersModal({
  visible,
  onClose,
  onSelectUser,
}: SearchUsersModalProps) {
  const [searchText, setSearchText] = useState('');
  const [users, setUsers] = useState<UserItem[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<UserItem[]>([]);
  const [friendsMap, setFriendsMap] = useState<{ [key: string]: boolean }>({});
  const [loading, setLoading] = useState(false);

  const currentUser = auth.currentUser;

  // Lắng nghe danh sách bạn bè hiện tại của user
  useEffect(() => {
    if (!currentUser || !visible) return;

    const myFriendsRef = ref(db, `friends/${currentUser.uid}`);
    const unsubscribeFriends = onValue(myFriendsRef, (snapshot) => {
      setFriendsMap(snapshot.val() || {});
    });

    return () => unsubscribeFriends();
  }, [currentUser, visible]);

  // Lấy danh sách toàn bộ người dùng từ Firebase Realtime Database
  useEffect(() => {
    if (!visible) return;

    setLoading(true);
    const usersRef = ref(db, 'users');

    const unsubscribe = onValue(
      usersRef,
      (snapshot) => {
        const data = snapshot.val();
        if (data) {
          const list: UserItem[] = Object.keys(data)
            .filter((key) => key !== currentUser?.uid) // Bỏ qua tài khoản hiện tại
            .map((key) => ({
              id: key,
              username: data[key].username || 'Người dùng',
              email: data[key].email || '',
              pfp: data[key].pfp || '',
            }));
          setUsers(list);
          setFilteredUsers(list);
        } else {
          setUsers([]);
          setFilteredUsers([]);
        }
        setLoading(false);
      },
      (error) => {
        console.error('Lỗi lấy danh sách người dùng:', error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [visible, currentUser]);

  // Lọc người dùng theo từ khóa tìm kiếm
  useEffect(() => {
    if (!searchText.trim()) {
      setFilteredUsers(users);
    } else {
      const keyword = searchText.toLowerCase().trim();
      const filtered = users.filter(
        (user) =>
          user.username.toLowerCase().includes(keyword) ||
          (user.email && user.email.toLowerCase().includes(keyword))
      );
      setFilteredUsers(filtered);
    }
  }, [searchText, users]);

  // Nút Kết bạn riêng biệt
  const handleAddFriend = async (user: UserItem) => {
    if (!currentUser) return;
    try {
      // Lưu bạn bè 2 chiều
      await set(ref(db, `friends/${currentUser.uid}/${user.id}`), true);
      await set(ref(db, `friends/${user.id}/${currentUser.uid}`), true);
      Alert.alert('Thành công', `Đã thêm ${user.username} vào danh sách bạn bè!`);
    } catch (error: any) {
      Alert.alert('Lỗi', error.message);
    }
  };

  // Nút Nhắn tin riêng biệt
  const handleSelectUserToChat = (user: UserItem) => {
    if (onSelectUser) {
      onSelectUser(user);
    }
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={true}>
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Tìm Kiếm Người Dùng 🔍</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Input Tìm kiếm */}
          <View style={styles.searchBox}>
            <TextInput
              style={styles.input}
              placeholder="Nhập tên hoặc email..."
              placeholderTextColor="#999"
              value={searchText}
              onChangeText={setSearchText}
              autoCapitalize="none"
            />
          </View>

          {/* Danh sách người dùng */}
          {loading ? (
            <View style={styles.centerContainer}>
              <ActivityIndicator size="large" color="#FF4B4B" />
              <Text style={styles.loadingText}>Đang tải danh sách...</Text>
            </View>
          ) : (
            <FlatList
              data={filteredUsers}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.listContent}
              ListEmptyComponent={
                <View style={styles.centerContainer}>
                  <Text style={styles.emptyText}>
                    Không tìm thấy người dùng phù hợp.
                  </Text>
                </View>
              }
              renderItem={({ item }) => {
                const isFriend = !!friendsMap[item.id];
                return (
                  <View style={styles.userCard}>
                    <View style={styles.avatarCircle}>
                      <Text style={styles.avatarText}>
                        {item.username ? item.username.charAt(0).toUpperCase() : 'U'}
                      </Text>
                    </View>
                    <View style={styles.userInfo}>
                      <Text style={styles.userName}>{item.username}</Text>
                      {item.email ? (
                        <Text style={styles.userEmail}>{item.email}</Text>
                      ) : null}
                    </View>

                    {/* Hàng nút chức năng riêng biệt */}
                    <View style={styles.actionRow}>
                      <TouchableOpacity
                        style={[
                          styles.addFriendBtn,
                          isFriend && styles.addedFriendBtn,
                        ]}
                        disabled={isFriend}
                        onPress={() => handleAddFriend(item)}
                      >
                        <Text
                          style={[
                            styles.addFriendText,
                            isFriend && styles.addedFriendText,
                          ]}
                        >
                          {isFriend ? '✓ Bạn bè' : '➕ Kết bạn'}
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.chatBtn}
                        onPress={() => handleSelectUserToChat(item)}
                      >
                        <Text style={styles.chatBtnText}>💬 Chat</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              }}
            />
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    height: '80%',
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333333',
  },
  closeBtn: {
    padding: 6,
  },
  closeBtnText: {
    fontSize: 20,
    color: '#888888',
    fontWeight: 'bold',
  },
  searchBox: {
    marginBottom: 12,
  },
  input: {
    backgroundColor: '#F1F3F5',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    color: '#333333',
  },
  listContent: {
    paddingBottom: 20,
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
  },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FF4B4B',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  avatarText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 18,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333333',
  },
  userEmail: {
    fontSize: 12,
    color: '#777777',
    marginTop: 2,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  addFriendBtn: {
    backgroundColor: '#FFEAEA',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 14,
    marginRight: 6,
  },
  addedFriendBtn: {
    backgroundColor: '#E8F5E9',
  },
  addFriendText: {
    color: '#FF4B4B',
    fontSize: 12,
    fontWeight: 'bold',
  },
  addedFriendText: {
    color: '#2E7D32',
  },
  chatBtn: {
    backgroundColor: '#FF4B4B',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 14,
  },
  chatBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  centerContainer: {
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 10,
    color: '#666666',
    fontSize: 14,
  },
  emptyText: {
    color: '#888888',
    fontSize: 14,
    textAlign: 'center',
  },
});