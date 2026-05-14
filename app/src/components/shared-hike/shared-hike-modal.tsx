import { getFriends } from "@/api/friends";
import { BORDER_RADIUS } from "@/constants/constants";
import { Friend } from "@/data/types";
import { useQuery } from "@tanstack/react-query";
import { ActivityIndicator, Dimensions, FlatList, Pressable, StyleSheet, View } from "react-native";
import { Divider, Icon, Modal, Portal, Text, useTheme } from "react-native-paper";

interface Props {
  visible: boolean;
  onDismiss: () => void;
  onShare: (friendNickName: string) => void;
  isPending?: boolean;
}

export default function SharedHikeModal({ visible, onDismiss, onShare, isPending }: Props) {
  const theme = useTheme();

  const { data: friends, isLoading } = useQuery({
    queryKey: ["friends"],
    queryFn: getFriends,
    enabled: visible,
  });

  const renderFriend = ({ item }: { item: Friend }) => (
    <Pressable
      style={({ pressed }) => [
        s.friendItem,
        { borderColor: theme.colors.outlineVariant },
        pressed && { backgroundColor: theme.colors.surfaceVariant },
      ]}
      onPress={() => onShare(item.nickName)}
      disabled={isPending}
    >
      <Icon size={22} source="account" color={theme.colors.primary} />
      <Text style={s.nickName}>{item.nickName}</Text>
      <Icon size={20} source="share" color={theme.colors.secondary} />
    </Pressable>
  );

  return (
    <Portal>
      <Modal
        visible={visible}
        onDismiss={onDismiss}
        contentContainerStyle={[s.container, { backgroundColor: theme.colors.surface }]}
      >
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
          <FlatList
            data={friends}
            keyExtractor={(item) => item.identifier}
            renderItem={renderFriend}
            ItemSeparatorComponent={() => <Divider />}
            style={s.list}
          />
        ) : (
          <View style={s.centered}>
            <Text style={{ color: theme.colors.onSurfaceVariant }}>Du har inga vänner att dela med.</Text>
          </View>
        )}
      </Modal>
    </Portal>
  );
}

const s = StyleSheet.create({
  container: {
    marginHorizontal: 20,
    borderRadius: BORDER_RADIUS,
    overflow: "hidden",
    maxHeight: "60%",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 15,
  },
  list: {
    maxHeight: Dimensions.get("window").height * 0.45,
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
