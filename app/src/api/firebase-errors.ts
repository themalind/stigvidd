import i18n from "@/i18n";

export function getRegisterErrorMessage(errorCode: string): string {
  switch (errorCode) {
    case "auth/email-already-in-use":
      return i18n.t("firebaseErrors.register.emailInUse");
    case "auth/invalid-email":
      return i18n.t("firebaseErrors.register.invalidEmail");
    case "auth/weak-password":
      return i18n.t("firebaseErrors.register.weakPassword");
    case "auth/network-request-failed":
      return i18n.t("firebaseErrors.register.networkFailed");
    default:
      return i18n.t("firebaseErrors.register.default");
  }
}

export function getPasswordResetErrorMessage(errorCode: string): string {
  switch (errorCode) {
    case "auth/invalid-email":
      return i18n.t("firebaseErrors.passwordReset.invalidEmail");
    case "auth/user-not-found":
      return i18n.t("firebaseErrors.passwordReset.userNotFound");
    case "auth/missing-email":
      return i18n.t("firebaseErrors.passwordReset.missingEmail");
    case "auth/too-many-requests":
      return i18n.t("firebaseErrors.passwordReset.tooManyRequests");
    case "auth/network-request-failed":
      return i18n.t("firebaseErrors.passwordReset.networkFailed");
    default:
      return i18n.t("firebaseErrors.passwordReset.default");
  }
}

export function getDeleteAccountErrorMessage(errorCode: string): string {
  switch (errorCode) {
    case "auth/invalid-credential":
    case "auth/wrong-password":
      return i18n.t("firebaseErrors.deleteAccount.invalidCredential");
    case "auth/user-mismatch":
      return i18n.t("firebaseErrors.deleteAccount.userMismatch");
    case "auth/user-not-found":
      return i18n.t("firebaseErrors.deleteAccount.userNotFound");
    case "auth/user-disabled":
      return i18n.t("firebaseErrors.deleteAccount.userDisabled");
    case "auth/too-many-requests":
      return i18n.t("firebaseErrors.deleteAccount.tooManyRequests");
    case "auth/network-request-failed":
      return i18n.t("firebaseErrors.deleteAccount.networkFailed");
    case "api/delete-failed":
      return i18n.t("firebaseErrors.deleteAccount.deleteFailed");
    default:
      return i18n.t("firebaseErrors.deleteAccount.default");
  }
}

export function getReauthenticateErrorMessage(errorCode: string): string {
  switch (errorCode) {
    case "auth/invalid-credential":
    case "auth/wrong-password":
      return i18n.t("firebaseErrors.reauthenticate.invalidCredential");
    case "auth/user-mismatch":
      return i18n.t("firebaseErrors.reauthenticate.userMismatch");
    case "auth/user-not-found":
      return i18n.t("firebaseErrors.reauthenticate.userNotFound");
    case "auth/user-disabled":
      return i18n.t("firebaseErrors.reauthenticate.userDisabled");
    case "auth/too-many-requests":
      return i18n.t("firebaseErrors.reauthenticate.tooManyRequests");
    case "auth/network-request-failed":
      return i18n.t("firebaseErrors.reauthenticate.networkFailed");
    case "auth/invalid-email":
      return i18n.t("firebaseErrors.reauthenticate.invalidEmail");
    default:
      return i18n.t("firebaseErrors.reauthenticate.default");
  }
}

export function getDeleteUserErrorMessage(errorCode: string): string {
  switch (errorCode) {
    case "auth/requires-recent-login":
      return i18n.t("firebaseErrors.deleteUser.requiresRecentLogin");
    case "auth/user-not-found":
      return i18n.t("firebaseErrors.deleteUser.userNotFound");
    case "auth/network-request-failed":
      return i18n.t("firebaseErrors.deleteUser.networkFailed");
    case "auth/too-many-requests":
      return i18n.t("firebaseErrors.deleteUser.tooManyRequests");
    default:
      return i18n.t("firebaseErrors.deleteUser.default");
  }
}

export function getLoginErrorMessage(errorCode: string): string {
  switch (errorCode) {
    case "auth/user-not-found":
      return i18n.t("firebaseErrors.login.userNotFound");
    case "auth/wrong-password":
      return i18n.t("firebaseErrors.login.wrongPassword");
    case "auth/invalid-email":
      return i18n.t("firebaseErrors.login.invalidEmail");
    case "auth/user-disabled":
      return i18n.t("firebaseErrors.login.userDisabled");
    case "auth/too-many-requests":
      return i18n.t("firebaseErrors.login.tooManyRequests");
    case "auth/network-request-failed":
      return i18n.t("firebaseErrors.login.networkFailed");
    case "auth/invalid-credential":
      return i18n.t("firebaseErrors.login.invalidCredential");
    case "auth/operation-not-allowed":
      return i18n.t("firebaseErrors.login.operationNotAllowed");
    case "auth/popup-closed-by-user":
      return i18n.t("firebaseErrors.login.popupClosed");
    default:
      return i18n.t("firebaseErrors.login.default");
  }
}
