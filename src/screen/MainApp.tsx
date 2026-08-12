// @ts-nocheck
import * as ImagePicker from 'expo-image-picker';
import React, { useEffect, useState } from 'react';
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
import { signOut } from 'firebase/auth';
import { onValue, ref, remove, update } from 'firebase/database';
import { auth, db } from '../../firebase';

// 📲 Import cho Widget & FCM Messaging
import { requestWidgetUpdate } from 'react-native-android-widget';
import { LoverWidget } from '../widgets/LoverWidget';
import messaging from '@react-native-firebase/messaging';

// Components & Context
import ThemePicker from '../components/ThemePicker';
import { useTheme } from '../context/ThemeContext';
import ChatTab from '../components/ChatTab';
import DrawTab from '../components/DrawTab';
import SearchUsersModal, { UserItem } from '../components/SearchUsersModal';
import LoverModal from '../components/LoverModal';

interface UserProfile {
  username?: string;
  pfp?: string;
  email?: string;
  loverId?: string;
  loveStartDate?: string;
  fcmToken?: string;
}

interface Friend {
  id: string;
  username: string;
  pfp?: string;
  email?: string;
}

export default function MainApp() {
  const { bgColor } = useTheme();

  const [activeTab, setActiveTab] = useState<'chat' | 'draw'>('chat');

  // State quản lý các Modal
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isSearchVisible, setIsSearchVisible] = useState(false);
  const [isLoverModalVisible, setIsLoverModalVisible] = useState(false);

  // State chat & dữ liệu
  const [targetChatUser, setTargetChatUser] = useState<UserItem | null>(null);
  const [userData, setUserData] = useState<UserProfile | null>(null);
  const [partnerData, setPartnerData] = useState<Friend | null>(null);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [updatingPfp, setUpdatingPfp] = useState(false);

  const currentUser = auth.currentUser;

  // 🧮 Hàm tính số ngày bên nhau
  const calculateDaysTogether = (startDateStr?: string) => {
    if (!startDateStr) return 0;
    const start = new Date(startDateStr).getTime();
    const now = new Date().getTime();
    const diffTime = Math.abs(now - start);
    return Math.floor(diffTime / (1000 * 60 * 60 * 24));
  };

  // 🎧 1. Lắng nghe thông tin người dùng & Bạn đời & Danh sách bạn bè
  useEffect(() => {
    if (!currentUser?.uid) return;

    // Lắng nghe thông tin bản thân
    const userRef = ref(db, `users/${currentUser.uid}`);
    let unsubscribePartner: (() => void) | null = null;

    const unsubscribeUser = onValue(userRef, (snapshot) => {
      if (snapshot.exists()) {
        const val: UserProfile = snapshot.val() || {};
        setUserData(val);

        // Nếu người dùng có loverId -> Lắng nghe thông tin Nửa kia
        if (val.loverId) {
          const partnerRef = ref(db, `users/${val.loverId}`);
          if (unsubscribePartner) unsubscribePartner();

          unsubscribePartner = onValue(partnerRef, (partnerSnap) => {
            if (partnerSnap.exists()) {
              setPartnerData({
                id: val.loverId!,
                ...partnerSnap.val(),
              });
            } else {
              setPartnerData(null);
            }
          });
        } else {
          setPartnerData(null);
          if (unsubscribePartner) {
            unsubscribePartner();
            unsubscribePartner = null;
          }
        }
      }
    });

    // Lắng nghe danh sách bạn bè
    const friendsRef = ref(db, `friends/${currentUser.uid}`);
    const usersRef = ref(db, 'users');
    let unsubscribeUsers: (() => void) | null = null;

    const unsubscribeFriends = onValue(friendsRef, (friendsSnap) => {
      const friendsData = friendsSnap.val() || {};
      const friendIds = Object.keys(friendsData);

      if (unsubscribeUsers) unsubscribeUsers();

      if (friendIds.length === 0) {
        setFriends([]);
        return;
      }

      unsubscribeUsers = onValue(usersRef, (usersSnap) => {
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
      if (unsubscribePartner) unsubscribePartner();
      if (unsubscribeUsers) unsubscribeUsers();
    };
  }, [currentUser?.uid]);

  // 🔥 2. LẮNG NGHE HÌNH VẼ ĐƯỢC GỬI TỚI ĐỂ CẬP NHẬT WIDGET KHI APP ĐANG BẬT
  useEffect(() => {
    if (!currentUser?.uid) return;

    const myLoverDrawingRef = ref(db, `loverDrawings/${currentUser.uid}`);
    const unsubscribeLoverDrawing = onValue(myLoverDrawingRef, async (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        if (data?.imageUri) {
          try {
            await requestWidgetUpdate({
              widgetName: 'LoverWidget',
              renderWidget: () => (
                <LoverWidget imageUri={data.imageUri} senderName={data.senderName} />
              ),
              widgetNotFound: () => {},
            });
          } catch (e) {
            console.log('Cập nhật widget thất bại:', e);
          }
        }
      }
    });

    return () => {
      unsubscribeLoverDrawing();
    };
  }, [currentUser?.uid]);

  // 🔔 3. XIN QUYỀN VÀ KHỞI TẠO FCM TOKEN LƯU LÊN FIREBASE
  useEffect(() => {
    if (!currentUser?.uid) return;

    const setupFcmToken = async () => {
      try {
        const authStatus = await messaging().requestPermission();
        const enabled =
          authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
          authStatus === messaging.AuthorizationStatus.PROVISIONAL;

        if (enabled) {
          const token = await messaging().getToken();
          if (token) {
            await update(ref(db, `users/${currentUser.uid}`), {
              fcmToken: token,
            });
          }
        }
      } catch (e) {
        console.log('Lỗi khởi tạo FCM Token:', e);
      }
    };

    setupFcmToken();

    // Lắng nghe tự động cập nhật khi Token bị làm mới
    const unsubscribeTokenRefresh = messaging().onTokenRefresh(async (newToken: string) => {
      if (currentUser?.uid) {
        await update(ref(db, `users/${currentUser.uid}`), {
          fcmToken: newToken,
        });
      }
    });

    return () => {
      unsubscribeTokenRefresh();
    };
  }, [currentUser?.uid]);

  // Hàm Đổi Ảnh Đại Diện (PFP)
  const handleChangePfp = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.2,
        base64: true,
      });

      if (!result.canceled && result.assets?.[0]?.base64 && currentUser) {
        const base64Image = `data:image/jpeg;base64,${result.assets[0].base64}`;
        setUpdatingPfp(true);
        await update(ref(db, `users/${currentUser.uid}`), {
          pfp: base64Image,
        });
        Alert.alert('Thành công', 'Đã cập nhật ảnh đại diện mới!');
      }
    } catch (error: any) {
      Alert.alert('Lỗi', error?.message || 'Không thể cập nhật ảnh');
    } finally {
      setUpdatingPfp(false);
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
              Alert.alert('Lỗi', error?.message || 'Không thể xóa bạn bè');
            }
          },
        },
      ]
    );
  };

  // Hàm chuyển sang chat trực tiếp
  const handleChatWithUser = (user: Friend | UserItem) => {
    setIsModalVisible(false);
    setTargetChatUser({
      id: user.id,
      username: user.username,
      pfp: user.pfp,
      email: user.email,
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

  const daysTogether = calculateDaysTogether(userData?.loveStartDate);

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: bgColor }]}
      edges={['top', 'left', 'right']}
    >
      {/* Header chính */}
      <View style={styles.appHeader}>
        <View style={styles.headerTitleGroup}>
          <Text style={styles.appTitle}>Landy & Panda 💕</Text>
          {partnerData && (
            <Text style={styles.headerDaysCount}>❤️ {daysTogether} ngày bên nhau</Text>
          )}
        </View>

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

      {/* Thanh chuyển Tab */}
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

      {/* Nội dung Tab đang chọn */}
      {activeTab === 'chat' ? (
        <ChatTab
          targetUser={targetChatUser}
          onClearTarget={() => setTargetChatUser(null)}
        />
      ) : (
        <DrawTab loverId={userData?.loverId} />
      )}

      {/* MODAL THÔNG TIN TÀI KHOẢN & BẠN ĐỜI */}
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
              {/* Profile cá nhân */}
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

              {/* KHUNG THÔNG TIN BẠN ĐỜI */}
              <View style={styles.partnerSection}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={styles.sectionTitle}>Nửa kia của tôi 💕</Text>
                  <TouchableOpacity 
                    onPress={() => {
                      setIsModalVisible(false);
                      setIsLoverModalVisible(true);
                    }}
                  >
                    <Text style={{ color: '#FF4B4B', fontSize: 12, fontWeight: 'bold' }}>⚙️ Quản lý</Text>
                  </TouchableOpacity>
                </View>

                {partnerData ? (
                  <View style={styles.partnerCard}>
                    {partnerData.pfp ? (
                      <Image
                        source={{ uri: partnerData.pfp }}
                        style={styles.partnerAvatar}
                      />
                    ) : (
                      <View style={styles.partnerAvatarPlaceholder}>
                        <Text style={styles.partnerAvatarLetter}>
                          {partnerData.username?.charAt(0).toUpperCase() || '?'}
                        </Text>
                      </View>
                    )}

                    <View style={{ flex: 1 }}>
                      <Text style={styles.partnerName}>{partnerData.username}</Text>
                      <Text style={styles.partnerDaysText}>
                        💖 Đã bên nhau {daysTogether} ngày
                      </Text>
                    </View>

                    <TouchableOpacity
                      style={styles.partnerChatBtn}
                      onPress={() => handleChatWithUser(partnerData)}
                    >
                      <Text style={styles.partnerChatText}>💬 Chat</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={styles.emptyPartnerCard}>
                    <Text style={styles.emptyText}>Chưa kết nối với nửa kia!</Text>
                    <TouchableOpacity
                      style={styles.connectPartnerBtn}
                      onPress={() => {
                        setIsModalVisible(false);
                        setIsLoverModalVisible(true);
                      }}
                    >
                      <Text style={styles.connectPartnerText}>✨ Tìm & Kết nối Nửa kia</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>

              <View style={styles.divider} />

              {/* Bộ chọn màu nền */}
              <ThemePicker />

              <View style={styles.divider} />

              {/* Danh sách Bạn Bè */}
              <View style={styles.friendsSection}>
                <Text style={styles.sectionTitle}>
                  Danh sách bạn bè ({friends.length})
                </Text>
                {friends.length === 0 ? (
                  <Text style={styles.emptyText}>
                    Chưa có bạn bè nào. Hãy bấm 🔍 để kết bạn nhé!
                  </Text>
                ) : (
                  friends.map((friend) => {
                    const avatarLetter = friend.username
                      ? friend.username.charAt(0).toUpperCase()
                      : '?';

                    return (
                      <View key={friend.id} style={styles.friendCard}>
                        {friend.pfp ? (
                          <Image
                            source={{ uri: friend.pfp }}
                            style={styles.friendAvatar}
                          />
                        ) : (
                          <View style={styles.friendAvatarPlaceholder}>
                            <Text style={styles.friendLetter}>{avatarLetter}</Text>
                          </View>
                        )}

                        <Text style={styles.friendName}>{friend.username}</Text>

                        <View style={styles.friendActions}>
                          <TouchableOpacity
                            style={styles.friendChatBtn}
                            onPress={() => handleChatWithUser(friend)}
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
                    );
                  })
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

      {/* MODAL TÌM KIẾM TÀI KHOẢN */}
      <SearchUsersModal
        visible={isSearchVisible}
        onClose={() => setIsSearchVisible(false)}
        onSelectUser={(selectedUser: UserItem) => {
          setTargetChatUser(selectedUser);
          setActiveTab('chat');
        }}
      />

      {/* MODAL BẠN ĐỜI 💕 */}
      <LoverModal
        visible={isLoverModalVisible}
        onClose={() => setIsLoverModalVisible(false)}
        friends={friends}
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
  headerTitleGroup: { flexDirection: 'column' },
  appTitle: { fontSize: 18, fontWeight: 'bold', color: '#FF4B4B' },
  headerDaysCount: { fontSize: 12, fontWeight: '600', color: '#FF4B4B' },

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

  partnerSection: {
    backgroundColor: '#FFF0F3',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#FFCCD5',
  },
  partnerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  partnerAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 12,
    borderWidth: 2,
    borderColor: '#FF4B4B',
  },
  partnerAvatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FF4B4B',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  partnerAvatarLetter: { color: '#FFF', fontWeight: 'bold', fontSize: 18 },
  partnerName: { fontSize: 16, fontWeight: 'bold', color: '#333' },
  partnerDaysText: {
    fontSize: 12,
    color: '#FF4B4B',
    fontWeight: '600',
    marginTop: 2,
  },
  partnerChatBtn: {
    backgroundColor: '#FF4B4B',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 14,
  },
  partnerChatText: { color: '#FFF', fontSize: 12, fontWeight: 'bold' },
  emptyPartnerCard: { alignItems: 'center', paddingVertical: 8 },
  connectPartnerBtn: {
    backgroundColor: '#FF4B4B',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginTop: 8,
  },
  connectPartnerText: { color: '#FFF', fontWeight: 'bold', fontSize: 13 },

  friendsSection: { marginVertical: 5 },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  emptyText: { color: '#999', fontStyle: 'italic', fontSize: 13 },
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
  friendActions: { flexDirection: 'row', alignItems: 'center' },
  friendChatBtn: {
    backgroundColor: '#FF4B4B',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 12,
    marginRight: 6,
  },
  friendChatText: { color: '#FFF', fontSize: 12, fontWeight: 'bold' },
  friendUnfriendBtn: {
    backgroundColor: '#FFF0F0',
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  friendUnfriendText: { color: '#FF4B4B', fontSize: 12, fontWeight: 'bold' },

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