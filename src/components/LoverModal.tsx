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
import { onValue, ref, remove, set, update } from 'firebase/database';
import { auth, db } from '../../firebase';

interface Friend {
  id: string;
  username: string;
  pfp?: string;
  email?: string;
}

interface LoverModalProps {
  visible: boolean;
  onClose: () => void;
  friends: Friend[];
}

export default function LoverModal({ visible, onClose, friends }: LoverModalProps) {
  const currentUser = auth.currentUser;
  const [loverId, setLoverId] = useState<string | null>(null);
  const [loverInfo, setLoverInfo] = useState<Friend | null>(null);
  const [pendingRequest, setPendingRequest] = useState<{
    senderId: string;
    senderName: string;
  } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!currentUser || !visible) return;

    setLoading(true);

    // 1. Lắng nghe thông tin bạn đời hiện tại của User
    const userRef = ref(db, `users/${currentUser.uid}`);
    const unsubUser = onValue(userRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        const currentLoverId = data.loverId || null;
        setLoverId(currentLoverId);

        if (currentLoverId) {
          // Lấy thông tin chi tiết của Bạn đời
          const loverRef = ref(db, `users/${currentLoverId}`);
          onValue(loverRef, (loverSnap) => {
            if (loverSnap.exists()) {
              setLoverInfo({
                id: currentLoverId,
                ...loverSnap.val(),
              });
            }
          }, { onlyOnce: true });
        } else {
          setLoverInfo(null);
        }
      }
      setLoading(false);
    });

    // 2. Lắng nghe lời mời kết nối Bạn đời gửi tới mình
    const requestRef = ref(db, `loverRequests/${currentUser.uid}`);
    const unsubReq = onValue(requestRef, (snapshot) => {
      if (snapshot.exists()) {
        setPendingRequest(snapshot.val());
      } else {
        setPendingRequest(null);
      }
    });

    return () => {
      unsubUser();
      unsubReq();
    };
  }, [currentUser, visible]);

  // Gửi lời mời kết nối bạn đời
  const handleSendRequest = async (friend: Friend) => {
    if (!currentUser) return;
    try {
      // Lấy tên của bản thân gửi đi
      const userRef = ref(db, `users/${currentUser.uid}`);
      onValue(userRef, async (snap) => {
        const myName = snap.exists() ? snap.val().username : 'Một người bạn';
        await set(ref(db, `loverRequests/${friend.id}`), {
          senderId: currentUser.uid,
          senderName: myName,
        });
        Alert.alert('Thành công 💌', `Đã gửi lời mời làm bạn đời tới ${friend.username}!`);
      }, { onlyOnce: true });
    } catch (err: any) {
      Alert.alert('Lỗi', err.message);
    }
  };

  // Đồng ý lời mời làm Bạn đời
  const handleAcceptRequest = async () => {
    if (!currentUser || !pendingRequest) return;
    try {
      const now = new Date().toISOString();
      // Cập nhật loverId và ngày bắt đầu cho cả 2 tài khoản
      await update(ref(db, `users/${currentUser.uid}`), {
        loverId: pendingRequest.senderId,
        loveStartDate: now,
      });
      await update(ref(db, `users/${pendingRequest.senderId}`), {
        loverId: currentUser.uid,
        loveStartDate: now,
      });

      // Xóa lời mời sau khi đồng ý
      await remove(ref(db, `loverRequests/${currentUser.uid}`));
      Alert.alert('Chúc mừng 💕', 'Hai bạn đã chính thức trở thành Bạn đời!');
    } catch (err: any) {
      Alert.alert('Lỗi', err.message);
    }
  };

  // Từ chối lời mời
  const handleRejectRequest = async () => {
    if (!currentUser) return;
    await remove(ref(db, `loverRequests/${currentUser.uid}`));
    setPendingRequest(null);
  };

  // Hủy kết nối Bạn đời
  const handleBreakUp = () => {
    Alert.alert(
      'Hủy kết nối Bạn đời 💔',
      'Bạn có chắc chắn muốn hủy không? Kỷ niệm và số ngày bên nhau sẽ bị xoá.',
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Đồng ý hủy',
          style: 'destructive',
          onPress: async () => {
            if (!currentUser || !loverId) return;
            await update(ref(db, `users/${currentUser.uid}`), { loverId: null, loveStartDate: null });
            await update(ref(db, `users/${loverId}`), { loverId: null, loveStartDate: null });
            setLoverId(null);
            setLoverInfo(null);
            Alert.alert('Đã hủy', 'Đã hủy kết nối Bạn đời.');
          },
        },
      ]
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header Modal */}
          <View style={styles.header}>
            <Text style={styles.title}>Không Gian Bạn Đời 💕</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeText}>✕</Text>
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={styles.center}>
              <ActivityIndicator size="large" color="#FF4B4B" />
              <Text style={{ marginTop: 10, color: '#888' }}>Đang tải dữ liệu...</Text>
            </View>
          ) : (
            <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
              {/* TRƯỜNG HỢP 1: Có Lời Mời Đang Chờ Duyệt */}
              {pendingRequest && (
                <View style={styles.requestBox}>
                  <Text style={styles.requestTitle}>💌 Lời mời kết nối Bạn đời!</Text>
                  <Text style={styles.requestDesc}>
                    <Text style={{ fontWeight: 'bold' }}>{pendingRequest.senderName}</Text> đã gửi cho bạn một lời mời làm Bạn đời.
                  </Text>
                  <View style={styles.requestActions}>
                    <TouchableOpacity style={styles.acceptBtn} onPress={handleAcceptRequest}>
                      <Text style={styles.btnText}>Đồng ý 💕</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.rejectBtn} onPress={handleRejectRequest}>
                      <Text style={styles.rejectText}>Từ chối</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {/* TRƯỜNG HỢP 2: Đã có Bạn Đời */}
              {loverInfo ? (
                <View style={styles.loverBox}>
                  <Text style={styles.sectionHeader}>Bạn đời hiện tại của bạn</Text>
                  <View style={styles.loverCard}>
                    {loverInfo.pfp ? (
                      <Image source={{ uri: loverInfo.pfp }} style={styles.avatar} />
                    ) : (
                      <View style={styles.avatarPlaceholder}>
                        <Text style={styles.avatarLetter}>
                          {loverInfo.username ? loverInfo.username.charAt(0).toUpperCase() : '❤️'}
                        </Text>
                      </View>
                    )}
                    <Text style={styles.loverName}>{loverInfo.username}</Text>
                  </View>

                  <TouchableOpacity style={styles.breakUpBtn} onPress={handleBreakUp}>
                    <Text style={styles.breakUpText}>💔 Hủy kết nối Bạn đời</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                /* TRƯỜNG HỢP 3: Chưa có Bạn Đời -> Hiển thị Danh sách bạn bè để gửi lời mời */
                <View style={styles.friendsBox}>
                  <Text style={styles.sectionHeader}>Chọn 1 người bạn để gửi lời mời 💌</Text>
                  {friends.length === 0 ? (
                    <Text style={styles.emptyText}>
                      Bạn chưa có bạn bè nào. Hãy kết bạn trước bằng nút 🔍 Tìm kiếm ở màn hình chính nhé!
                    </Text>
                  ) : (
                    friends.map((friend) => (
                      <View key={friend.id} style={styles.friendRow}>
                        {friend.pfp ? (
                          <Image source={{ uri: friend.pfp }} style={styles.smallAvatar} />
                        ) : (
                          <View style={styles.smallAvatarPlaceholder}>
                            <Text style={styles.smallAvatarText}>
                              {friend.username ? friend.username.charAt(0).toUpperCase() : '?'}
                            </Text>
                          </View>
                        )}
                        <Text style={styles.friendName}>{friend.username}</Text>
                        <TouchableOpacity
                          style={styles.sendBtn}
                          onPress={() => handleSendRequest(friend)}
                        >
                          <Text style={styles.sendBtnText}>💌 Mời</Text>
                        </TouchableOpacity>
                      </View>
                    ))
                  )}
                </View>
              )}
            </ScrollView>
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
  container: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '80%',
    minHeight: 380, // 🛠️ Cố định chiều cao tối thiểu để không bị trắng trơn
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#FFEAEA',
  },
  title: { fontSize: 18, fontWeight: 'bold', color: '#FF4B4B' },
  closeBtn: { padding: 5 },
  closeText: { fontSize: 20, color: '#888', fontWeight: 'bold' },
  center: { paddingVertical: 50, alignItems: 'center' },
  body: { marginTop: 15 },
  sectionHeader: { fontSize: 15, fontWeight: 'bold', color: '#333', marginBottom: 10 },
  emptyText: { color: '#888', fontStyle: 'italic', textAlign: 'center', marginVertical: 30, lineHeight: 20 },

  // Thông báo Lời mời
  requestBox: {
    backgroundColor: '#FFF0F3',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#FFCCD5',
    marginBottom: 15,
  },
  requestTitle: { fontSize: 16, fontWeight: 'bold', color: '#FF4B4B', marginBottom: 6 },
  requestDesc: { fontSize: 14, color: '#444', marginBottom: 12 },
  requestActions: { flexDirection: 'row', gap: 10 },
  acceptBtn: {
    backgroundColor: '#FF4B4B',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  rejectBtn: {
    backgroundColor: '#EEEEEE',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  btnText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 13 },
  rejectText: { color: '#666666', fontWeight: 'bold', fontSize: 13 },

  // Bạn đời hiện tại
  loverBox: { alignItems: 'center', paddingVertical: 10 },
  loverCard: { alignItems: 'center', marginVertical: 15 },
  avatar: { width: 80, height: 80, borderRadius: 40, borderWidth: 3, borderColor: '#FF4B4B' },
  avatarPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FF4B4B',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarLetter: { color: '#FFFFFF', fontSize: 32, fontWeight: 'bold' },
  loverName: { fontSize: 18, fontWeight: 'bold', color: '#333333', marginTop: 10 },
  breakUpBtn: {
    backgroundColor: '#FFF0F0',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
    marginTop: 15,
  },
  breakUpText: { color: '#FF4B4B', fontWeight: 'bold', fontSize: 13 },

  // Danh sách bạn bè gửi lời mời
  friendsBox: { marginTop: 5 },
  friendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  smallAvatar: { width: 40, height: 40, borderRadius: 20, marginRight: 12 },
  smallAvatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FF4B4B',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  smallAvatarText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 16 },
  friendName: { flex: 1, fontSize: 15, fontWeight: '600', color: '#333333' },
  sendBtn: {
    backgroundColor: '#FFEAEA',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  sendBtnText: { color: '#FF4B4B', fontWeight: 'bold', fontSize: 12 },
});