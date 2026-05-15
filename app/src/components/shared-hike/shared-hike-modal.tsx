import { getFriends } from "@/api/friends";
import { BORDER_RADIUS } from "@/constants/constants";
import { Friend } from "@/data/types";
import { stigviddUserAtom } from "@/atoms/user-atoms";
import { useAtomValue } from "jotai";
import { useQuery } from "@tanstack/react-query";
import { ActivityIndicator, Dimensions, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Divider, Icon, Modal, Portal, Text, useTheme } from "react-native-paper";

const ITEM_HEIGHT = 52;
const HEADER_HEIGHT = 54;
const DIVIDER_HEIGHT = 1;
const MAX_HEIGHT = Dimensions.get("window").height * 0.6;

interface Props {
  visible: boolean;
  onDismiss: () => void;
  onShare: (friendNickName: string) => void;
  isPending?: boolean;
  excludeNickName?: string;
}

export default function SharedHikeModal({ visible, onDismiss, onShare, isPending, excludeNickName }: Props) {
  const theme = useTheme();

  const currentUser = useAtomValue(stigviddUserAtom);

  const { data: friendsRaw, isLoading } = useQuery({
    queryKey: ["friends"],
    queryFn: getFriends,
    enabled: visible,
  });

  const friends = friendsRaw?.filter(
    (f) => f.nickName !== currentUser.data?.nickName && f.nickName !== excludeNickName,
  );

  const listHeight = friends
    ? Math.min(
        friends.length * ITEM_HEIGHT + (friends.length - 1) * DIVIDER_HEIGHT,
        MAX_HEIGHT - HEADER_HEIGHT - DIVIDER_HEIGHT,
      )
    : ITEM_HEIGHT;

  return (
    <Portal>
      <Modal visible={visible} onDismiss={onDismiss} contentContainerStyle={s.container}>
        <View style={[s.inner, { backgroundColor: theme.colors.surface }]}>
          <View style={s.header}>
            <Text variant="titleMedium" style={{ color: theme.colors.onSurface }}>
              Dela med vän
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
            <ScrollView bounces={false} style={{ height: listHeight }}>
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
              <Text style={{ color: theme.colors.onSurfaceVariant }}>Du har inga vänner att dela med.</Text>
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
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 15,
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
});
