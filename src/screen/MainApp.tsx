import * as ImagePicker from 'expo-image-picker';
import { signOut } from 'firebase/auth';
import { onValue, ref, remove, update } from 'firebase/database';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { auth, db } from '../../firebase';

import ChatTab from '../components/ChatTab';
import DrawTab from '../components/DrawTab';
import SearchUsersModal, { UserItem } from '../components/SearchUsersModal';

interface UserProfile {
  username?: string;
  pfp?: string;
}

interface Friend {
  id: string;
  username: string;
  pfp?: string;
  email?: string;
}

export default function MainApp() {
  const [activeTab, setActiveTab] = useState<'chat' | 'draw'>('chat');

  // State quản lý Modal Thông tin tài khoản
  const [isModalVisible, setIsModalVisible] = useState(false);

  // State quản lý Modal Tìm kiếm người dùng
  const [isSearchVisible, setIsSearchVisible] = useState(false);

  // State lưu người dùng được chọn để nhắn tin 1-1
  const [targetChatUser, setTargetChatUser] = useState<UserItem | null>(null);

  const [userData, setUserData] = useState<UserProfile | null>(null);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [updatingPfp, setUpdatingPfp] = useState(false);

  const currentUser = auth.currentUser;

  // Lấy dữ liệu cá nhân & danh sách bạn bè thực sự từ Firebase Database
  useEffect(() => {
    if (!currentUser) return;

    // 1. Lắng nghe thông tin bản thân
    const userRef = ref(db, `users/${currentUser.uid}`);
    const unsubscribeUser = onValue(userRef, (snapshot) => {
      if (snapshot.exists()) {
        setUserData(snapshot.val());
      }
    });

    // 2. Lắng nghe danh sách bạn bè từ node `friends/${currentUser.uid}`
    const friendsRef = ref(db, `friends/${currentUser.uid}`);
    const usersRef = ref(db, 'users');

    const unsubscribeFriends = onValue(friendsRef, (friendsSnap) => {
      const friendsData = friendsSnap.val() || {};
      const friendIds = Object.keys(friendsData);

      onValue(usersRef, (usersSnap) => {
        const usersData = usersSnap.val() || {};
        const list: Friend[] = friendIds
          .filter((id) => usersData[id])
          .map((id) => ({
            id,
            username: usersData[id].username || 'Người dùng',
            pfp: usersData[id].pfp,
            email: usersData[id].email,
          }));
        setFriends(list);
      });
    });

    return () => {
      unsubscribeUser();
      unsubscribeFriends();
    };
  }, [currentUser]);

  // Hàm Đổi Ảnh Đại Diện (PFP)
  const handleChangePfp = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images' as any,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.2,
      base64: true,
    });

    if (!result.canceled && result.assets[0].base64 && currentUser) {
      const base64Image = `data:image/jpeg;base64,${result.assets[0].base64}`;
      setUpdatingPfp(true);
      try {
        await update(ref(db, `users/${currentUser.uid}`), {
          pfp: base64Image,
        });
        Alert.alert('Thành công', 'Đã cập nhật ảnh đại diện mới!');
      } catch (error: any) {
        Alert.alert('Lỗi', error.message);
      } finally {
        setUpdatingPfp(false);
      }
    }
  };

  // Hàm Hủy kết bạn
  const handleUnfriend = (friend: Friend) => {
    Alert.alert(
      'Hủy kết bạn',
      `Bạn có chắc chắn muốn hủy kết bạn với ${friend.username}?`,
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Xóa bạn',
          style: 'destructive',
          onPress: async () => {
            if (!currentUser) return;
            try {
              await remove(ref(db, `friends/${currentUser.uid}/${friend.id}`));
              await remove(ref(db, `friends/${friend.id}/${currentUser.uid}`));
              Alert.alert('Thành công', `Đã hủy kết bạn với ${friend.username}`);
            } catch (error: any) {
              Alert.alert('Lỗi', error.message);
            }
          },
        },
      ]
    );
  };

  // Hàm chuyển sang chat trực tiếp với bạn bè từ trang danh sách bạn bè
  const handleChatWithFriend = (friend: Friend) => {
    setIsModalVisible(false);
    setTargetChatUser({
      id: friend.id,
      username: friend.username,
      pfp: friend.pfp,
      email: friend.email,
    });
    setActiveTab('chat');
  };

  // Hàm Đăng xuất
  const handleLogout = () => {
    Alert.alert('Xác nhận', 'Bạn có muốn đăng xuất không?', [
      { text: 'Hủy', style: 'cancel' },
      {
        text: 'Đăng xuất',
        style: 'destructive',
        onPress: () => {
          setIsModalVisible(false);
          signOut(auth);
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* 1. Header chính */}
      <View style={styles.appHeader}>
        <Text style={styles.appTitle}>Landy and Panda 💕</Text>

        <View style={styles.headerRightActions}>
          <TouchableOpacity
            style={styles.searchIconButton}
            onPress={() => setIsSearchVisible(true)}
          >
            <Text style={styles.searchIconText}>🔍</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.pfpButton}
            onPress={() => setIsModalVisible(true)}
          >
            {userData?.pfp ? (
              <Image source={{ uri: userData.pfp }} style={styles.headerAvatar} />
            ) : (
              <View style={styles.headerAvatarPlaceholder}>
                <Text style={styles.avatarLetter}>
                  {userData?.username
                    ? userData.username.charAt(0).toUpperCase()
                    : '👤'}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* 2. Thanh chuyển Tab */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[
            styles.tabButton,
            activeTab === 'chat' && styles.activeTabButton,
          ]}
          onPress={() => setActiveTab('chat')}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === 'chat' && styles.activeTabText,
            ]}
          >
            💬 Trò chuyện
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.tabButton,
            activeTab === 'draw' && styles.activeTabButton,
          ]}
          onPress={() => setActiveTab('draw')}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === 'draw' && styles.activeTabText,
            ]}
          >
            🎨 Bảng vẽ
          </Text>
        </TouchableOpacity>
      </View>

      {/* 3. Nội dung Tab đang chọn */}
      {activeTab === 'chat' ? (
        <ChatTab
          targetUser={targetChatUser}
          onClearTarget={() => setTargetChatUser(null)}
        />
      ) : (
        <DrawTab />
      )}

      {/* 4. MODAL THÔNG TIN TÀI KHOẢN & DANH SÁCH BẠN BÈ */}
      <Modal
        visible={isModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Tài Khoản</Text>
              <TouchableOpacity onPress={() => setIsModalVisible(false)}>
                <Text style={styles.closeBtn}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Profile info */}
              <View style={styles.profileSection}>
                <View style={styles.largeAvatarContainer}>
                  {userData?.pfp ? (
                    <Image
                      source={{ uri: userData.pfp }}
                      style={styles.largeAvatar}
                    />
                  ) : (
                    <View style={styles.largeAvatarPlaceholder}>
                      <Text style={styles.largeAvatarLetter}>
                        {userData?.username
                          ? userData.username.charAt(0).toUpperCase()
                          : '👤'}
                      </Text>
                    </View>
                  )}
                  {updatingPfp && (
                    <View style={styles.loadingOverlay}>
                      <ActivityIndicator size="small" color="#FFF" />
                    </View>
                  )}
                </View>

                <TouchableOpacity
                  style={styles.changePfpBtn}
                  onPress={handleChangePfp}
                >
                  <Text style={styles.changePfpText}>📷 Đổi ảnh đại diện</Text>
                </TouchableOpacity>

                <Text style={styles.usernameText}>
                  {userData?.username || 'Chưa đặt tên'}
                </Text>
              </View>

              <View style={styles.divider} />

              {/* Danh sách Bạn Bè với nút Chat & Hủy kết bạn */}
              <View style={styles.friendsSection}>
                <Text style={styles.sectionTitle}>
                  Danh sách bạn bè ({friends.length})
                </Text>
                {friends.length === 0 ? (
                  <Text style={styles.emptyText}>
                    Chưa có bạn bè nào. Hãy bấm 🔍 để kết bạn nhé!
                  </Text>
                ) : (
                  friends.map((friend) => (
                    <View key={friend.id} style={styles.friendCard}>
                      {friend.pfp ? (
                        <Image
                          source={{ uri: friend.pfp }}
                          style={styles.friendAvatar}
                        />
                      ) : (
                        <View style={styles.friendAvatarPlaceholder}>
                          <Text style={styles.friendLetter}>
                            {friend.username
                              ? friend.username.charAt(0).toUpperCase()
                              : '?'}
                          </Text>
                        </View>
                      )}
                      <Text style={styles.friendName}>{friend.username}</Text>

                      {/* Các nút Hủy kết bạn và Chat ngay cạnh bạn bè */}
                      <View style={styles.friendActions}>
                        <TouchableOpacity
                          style={styles.friendChatBtn}
                          onPress={() => handleChatWithFriend(friend)}
                        >
                          <Text style={styles.friendChatText}>💬 Chat</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={styles.friendUnfriendBtn}
                          onPress={() => handleUnfriend(friend)}
                        >
                          <Text style={styles.friendUnfriendText}>❌ Hủy</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))
                )}
              </View>

              <View style={styles.divider} />

              {/* Nút Đăng xuất */}
              <TouchableOpacity
                style={styles.logoutButton}
                onPress={handleLogout}
              >
                <Text style={styles.logoutButtonText}>🚪 Đăng xuất</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* 5. MODAL TÌM KIẾM TÀI KHOẢN */}
      <SearchUsersModal
        visible={isSearchVisible}
        onClose={() => setIsSearchVisible(false)}
        onSelectUser={(selectedUser: UserItem) => {
          setTargetChatUser(selectedUser);
          setActiveTab('chat');
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },

  appHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
  },
  appTitle: { fontSize: 20, fontWeight: 'bold', color: '#FF4B4B' },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  searchIconButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  searchIconText: { fontSize: 18 },
  pfpButton: { padding: 2 },
  headerAvatar: { width: 38, height: 38, borderRadius: 19 },
  headerAvatarPlaceholder: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#FF4B4B',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarLetter: { color: '#FFF', fontWeight: 'bold', fontSize: 16 },

  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderColor: '#EEEEEE',
  },
  tabButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderColor: 'transparent',
  },
  activeTabButton: { borderColor: '#FF4B4B' },
  tabText: { fontSize: 15, fontWeight: '600', color: '#888888' },
  activeTabText: { color: '#FF4B4B' },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  closeBtn: { fontSize: 20, color: '#888', fontWeight: 'bold', padding: 4 },

  profileSection: { alignItems: 'center', marginVertical: 10 },
  largeAvatarContainer: { position: 'relative', marginBottom: 10 },
  largeAvatar: { width: 90, height: 90, borderRadius: 45 },
  largeAvatarPlaceholder: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: '#FF4B4B',
    justifyContent: 'center',
    alignItems: 'center',
  },
  largeAvatarLetter: { color: '#FFF', fontSize: 36, fontWeight: 'bold' },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderRadius: 45,
    justifyContent: 'center',
    alignItems: 'center',
  },
  changePfpBtn: {
    backgroundColor: '#FFEAEA',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    marginBottom: 8,
  },
  changePfpText: { color: '#FF4B4B', fontWeight: '600', fontSize: 13 },
  usernameText: { fontSize: 20, fontWeight: 'bold', color: '#333' },

  divider: { height: 1, backgroundColor: '#F0F0F0', marginVertical: 15 },

  friendsSection: { marginVertical: 5 },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  emptyText: { color: '#999', fontStyle: 'italic' },
  friendCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  friendAvatar: { width: 40, height: 40, borderRadius: 20, marginRight: 10 },
  friendAvatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E0E0E0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  friendLetter: { color: '#555', fontWeight: 'bold', fontSize: 16 },
  friendName: { flex: 1, fontSize: 15, fontWeight: '500', color: '#333' },

  friendActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  friendChatBtn: {
    backgroundColor: '#FF4B4B',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 12,
    marginRight: 6,
  },
  friendChatText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  friendUnfriendBtn: {
    backgroundColor: '#FFF0F0',
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  friendUnfriendText: {
    color: '#FF4B4B',
    fontSize: 12,
    fontWeight: 'bold',
  },

  logoutButton: {
    backgroundColor: '#FFF0F0',
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 20,
  },
  logoutButtonText: { color: '#FF4B4B', fontWeight: 'bold', fontSize: 15 },
});