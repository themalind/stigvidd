import React, { ReactNode, useEffect, useRef, useState } from "react";
import { Modal, Pressable, StyleSheet, View } from "react-native";

// https://medium.com/@mindelias/building-a-custom-dropdown-menu-in-react-native-a-step-by-step-guide-939b5f16627b
interface DropdownMenuProps {
  visible: boolean;
  handleClose: () => void;
  handleOpen: () => void;
  trigger: React.ReactNode;
  children: React.ReactNode;
  dropdownWidth?: number;
}

export const MenuTrigger = ({ children }: { children: ReactNode }) => {
  return <>{children}</>;
};

export const MenuOption = ({ onSelect, children }: { onSelect: () => void; children: ReactNode }) => {
  return (
    <Pressable onPress={onSelect} style={styles.menuOption}>
      {children}
    </Pressable>
  );
};

export default function DropdownMenu({
  visible,
  handleOpen,
  handleClose,
  trigger,
  children,
  dropdownWidth = 150,
}: DropdownMenuProps) {
  const triggerRef = useRef<View>(null);
  const [position, setPosition] = useState({ x: 0, y: 0, width: 0 });

  useEffect(() => {
    if (triggerRef.current && visible) {
      triggerRef.current.measure((fx, fy, width, height, px, py) => {
        setPosition({
          x: px,
          y: py + height,
          width: width,
        });
      });
    }
  }, [visible]);

  return (
    <View>
      <Pressable onPress={handleOpen}>
        <View ref={triggerRef}>{trigger}</View>
      </Pressable>
      {visible && (
        <Modal transparent={true} visible={visible} animationType="fade" onRequestClose={handleClose}>
          <Pressable onPress={handleClose}>
            <View style={styles.modalOverlay}>
              <View
                style={[
                  styles.menu,
                  {
                    top: position.y,
                    left: position.x + position.width / 2 - dropdownWidth / 2,
                    width: dropdownWidth,
                  },
                ]}
              >
                {children}
              </View>
            </View>
          </Pressable>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-start",
    alignItems: "flex-start",
    backgroundColor: "transparent",
  },
  menu: {
    position: "absolute",
    width: 100,
    backgroundColor: "white",
    borderRadius: 5,
    padding: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  menuOption: {
    padding: 15,
  },
});
