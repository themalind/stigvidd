import { getFriends } from "@/api/friends";
import { stigviddUserAtom } from "@/atoms/user-atoms";
import { BORDER_RADIUS } from "@/constants/constants";
import { SearchFriendResult } from "@/data/types";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { useAtomValue } from "jotai";
import { useState } from "react";
import { Control, Controller, FieldError, SubmitHandler, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Dimensions, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import { Button, Divider, Icon, Modal, Portal, Text, TextInput, useTheme } from "react-native-paper";
import { z } from "zod";

const HEIGHT = Dimensions.get("screen").height;

const additionalHikeFields = z.object({
  gettingThere: z.string().max(200, "Max 500 tecken").optional(),
  parkingInfo: z.string().max(200, "Max 500 tecken").optional(),
  description: z.string().max(500, "Max 500 tecken").optional(),
});

export type ShareHikeFormFields = z.infer<typeof additionalHikeFields>;

interface FormFieldProps {
  name: keyof ShareHikeFormFields;
  label: string;
  control: Control<ShareHikeFormFields>;
  error?: FieldError;
}

function FormField({ name, label, control, error }: FormFieldProps) {
  const theme = useTheme();
  return (
    <>
      <Controller
        control={control}
        name={name}
        render={({ field: { onChange, onBlur, value } }) => (
          <TextInput
            error={!!error}
            style={[s.textInput, { backgroundColor: theme.colors.surfaceVariant }]}
            onBlur={onBlur}
            onChangeText={(text) => onChange(text || undefined)}
            value={value}
            label={label}
            autoCapitalize="sentences"
            keyboardType="default"
            textAlignVertical="top"
            multiline
            theme={{ colors: { onSurfaceVariant: theme.colors.primary } }}
          />
        )}
      />
      <View style={s.errorContainer}>
        {error && (
          <Text
            style={[
              s.errorText,
              { color: theme.colors.onErrorContainer, backgroundColor: theme.colors.errorContainer },
            ]}
          >
            {error.message}
          </Text>
        )}
      </View>
    </>
  );
}

interface Props {
  visible: boolean;
  onDismiss: () => void;
  onShare: (friendNickName: string, formData: ShareHikeFormFields) => void;
  isPending?: boolean;
  excludeNickName?: string;
  defaultValues?: ShareHikeFormFields;
}

export default function ShareHikeModal({
  visible,
  onDismiss,
  onShare,
  isPending,
  excludeNickName,
  defaultValues,
}: Props) {
  const theme = useTheme();
  const { t } = useTranslation();
  const [step, setStep] = useState<"form" | "friends">("form");
  const [formData, setFormData] = useState<ShareHikeFormFields>({});
  const currentUser = useAtomValue(stigviddUserAtom);

  const { data: friendsRaw, isLoading } = useQuery({
    queryKey: ["friends"],
    queryFn: getFriends,
    enabled: visible,
  });

  const friends = friendsRaw?.filter(
    (f) => f.nickName !== currentUser.data?.nickName && f.nickName !== excludeNickName,
  );

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<ShareHikeFormFields>({ resolver: zodResolver(additionalHikeFields), defaultValues });

  const onSubmit: SubmitHandler<ShareHikeFormFields> = (data) => {
    setFormData(data);
    setStep("friends");
  };

  const handleDismiss = () => {
    setStep("form");
    onDismiss();
  };

  return (
    <Portal>
      <Modal visible={visible} onDismiss={handleDismiss} contentContainerStyle={s.container}>
        <View style={[s.inner, { backgroundColor: theme.colors.surface }]}>
          <View style={s.header}>
            <Icon source="share" size={18} color={theme.colors.primary} />
            <Text variant="titleMedium" style={{ color: theme.colors.onSurface }}>
              {t("hike.shareWithFriend")}
            </Text>
            <Pressable hitSlop={12} onPress={handleDismiss}>
              <Icon size={24} source="close" color={theme.colors.onSurface} />
            </Pressable>
          </View>
          <Divider />
          {step === "form" ? (
            <>
              <KeyboardAwareScrollView
                style={s.flex}
                contentContainerStyle={s.formContent}
                keyboardShouldPersistTaps="handled"
                enableOnAndroid
              >
                <Text style={s.infoLabel}>{t("hike.gettingThereHeading")}</Text>
                <Text style={s.infoBody}>{t("hike.gettingThereHelp")}</Text>
                <FormField
                  name="gettingThere"
                  label={t("hike.gettingThereOptional")}
                  control={control}
                  error={errors.gettingThere}
                />
                <Text style={s.infoLabel}>{t("hike.parkingHeading")}</Text>
                <Text style={s.infoBody}>{t("hike.parkingHelp")}</Text>
                <FormField
                  name="parkingInfo"
                  label={t("hike.parkingOptional")}
                  control={control}
                  error={errors.parkingInfo}
                />
                <Text style={s.infoLabel}>{t("hike.descriptionHeading")}</Text>
                <Text style={s.infoBody}>{t("hike.descriptionHelp")}</Text>
                <FormField
                  name="description"
                  label={t("hike.descriptionOptional")}
                  control={control}
                  error={errors.description}
                />
              </KeyboardAwareScrollView>
              <View style={s.buttonContainer}>
                <Button
                  mode="contained"
                  icon="arrow-right"
                  contentStyle={s.buttonContent}
                  onPress={handleSubmit(onSubmit)}
                >
                  {t("common.next")}
                </Button>
              </View>
            </>
          ) : isLoading ? (
            <View style={s.centered}>
              <ActivityIndicator color={theme.colors.primary} />
            </View>
          ) : friends && friends.length > 0 ? (
            <>
              <Pressable hitSlop={12} style={s.backButton} onPress={() => setStep("form")}>
                <Icon size={18} source="arrow-left" color={theme.colors.onSurface} />
                <Text style={{ color: theme.colors.onSurface }}>{t("hike.back")}</Text>
              </Pressable>
              <Divider />
              <ScrollView bounces={false} style={s.flex}>
                {friends.map((item: SearchFriendResult, index: number) => (
                  <View key={item.identifier}>
                    <Pressable
                      style={({ pressed }) => [
                        s.friendItem,
                        pressed && { backgroundColor: theme.colors.surfaceVariant },
                      ]}
                      onPress={() => onShare(item.nickName, formData)}
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
            </>
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
  formContent: {
    padding: 16,
    gap: 5,
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  buttonContainer: {
    padding: 16,
    alignItems: "center",
  },
  buttonContent: {
    flexDirection: "row-reverse",
  },
  flex: {
    flex: 1,
  },
  textInput: {
    width: "100%",
  },
  errorContainer: {
    height: 30,
  },
  errorText: {
    fontWeight: "600",
  },
  infoLabel: {
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  infoBody: {
    fontSize: 13,
    lineHeight: 20,
  },
});
