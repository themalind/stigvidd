import { getFriends } from "@/api/friends";
import { stigviddUserAtom } from "@/atoms/user-atoms";
import { BORDER_RADIUS } from "@/constants/constants";
import { Friend } from "@/data/types";
import { useQuery } from "@tanstack/react-query";
import { useAtomValue } from "jotai";
import { ActivityIndicator, Dimensions, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Divider, Icon, Modal, Portal, Text, useTheme } from "react-native-paper";
import { useTranslation } from "react-i18next";

const HEIGHT = Dimensions.get("screen").height;

interface Props {
  visible: boolean;
  onDismiss: () => void;
  onShare: (friendNickName: string) => void;
  isPending?: boolean;
  excludeNickName?: string;
}

export default function ReshareHikeModal({ visible, onDismiss, onShare, isPending, excludeNickName }: Props) {
  const theme = useTheme();
  const { t } = useTranslation();
  const currentUser = useAtomValue(stigviddUserAtom);

  const { data: friendsRaw, isLoading } = useQuery({
    queryKey: ["friends"],
    queryFn: getFriends,
    enabled: visible,
  });

  const friends = friendsRaw?.filter(
    (f) => f.nickName !== currentUser.data?.nickName && f.nickName !== excludeNickName,
  );

  return (
    <Portal>
      <Modal visible={visible} onDismiss={onDismiss} contentContainerStyle={s.container}>
        <View style={[s.inner, { backgroundColor: theme.colors.surface }]}>
          <View style={s.header}>
            <Icon source="share" size={18} color={theme.colors.primary} />
            <Text variant="titleMedium" style={{ color: theme.colors.onSurface }}>
              {t("hike.shareWithFriend")}
            </Text>
            <Pressable hitSlop={12} onPress={onDismiss}>
              <Icon size={24} source="close" color={theme.colors.onSurface} />
            </Pressable>
          </View>
          <Divider />
          {isLoading ? (
            <View style={s.centered}>
              <ActivityIndicator color={theme.colors.primary} />
            </View>
          ) : friends && friends.length > 0 ? (
            <ScrollView bounces={false} style={s.flex}>
              {friends.map((item: Friend, index: number) => (
                <View key={item.identifier}>
                  <Pressable
                    style={({ pressed }) => [s.friendItem, pressed && { backgroundColor: theme.colors.surfaceVariant }]}
                    onPress={() => onShare(item.nickName)}
                    disabled={isPending}
                  >
                    <Icon size={22} source="account" color={theme.colors.primary} />
                    <Text style={s.nickName}>{item.nickName}</Text>
                    <Icon size={20} source="share" color={theme.colors.secondary} />
                  </Pressable>
                  {index < friends.length - 1 && <Divider />}
                </View>
              ))}
            </ScrollView>
          ) : (
            <View style={s.centered}>
              <Text style={{ color: theme.colors.onSurfaceVariant }}>{t("hike.noFriendsToShare")}</Text>
            </View>
          )}
        </View>
      </Modal>
    </Portal>
  );
}

const s = StyleSheet.create({
  container: {
    marginHorizontal: 20,
    borderRadius: BORDER_RADIUS,
  },
  inner: {
    borderRadius: BORDER_RADIUS,
    overflow: "hidden",
    height: HEIGHT * 0.75,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
  },
  friendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  nickName: {
    flex: 1,
    fontSize: 16,
  },
  centered: {
    padding: 30,
    alignItems: "center",
  },
  flex: {
    flex: 1,
  },
});
