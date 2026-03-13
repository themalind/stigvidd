export function getRegisterErrorMessage(errorCode: string): string {
  switch (errorCode) {
    case "auth/email-already-in-use":
      return "E-postadressen används redan";
    case "auth/invalid-email":
      return "Ogiltig e-postadress";
    case "auth/weak-password":
      return "Lösenordet är för svagt (minst 6 tecken)";
    case "auth/network-request-failed":
      return "Nätverksfel. Kontrollera din anslutning";
    default:
      return "Ett fel uppstod. Försök igen";
  }
}

export function getPasswordResetErrorMessage(errorCode: string): string {
  switch (errorCode) {
    case "auth/invalid-email":
      return "Ogiltig e-postadress";
    case "auth/user-not-found":
      return "Ingen användare med denna e-postadress finns";
    case "auth/missing-email":
      return "Ange en e-postadress";
    case "auth/too-many-requests":
      return "För många försök. Försök igen senare";
    case "auth/network-request-failed":
      return "Nätverksfel. Kontrollera din anslutning";
    default:
      return "Ett fel uppstod. Försök igen";
  }
}

export function getDeleteAccountErrorMessage(errorCode: string): string {
  switch (errorCode) {
    // Re-auth errors
    case "auth/invalid-credential":
    case "auth/wrong-password":
      return "Felaktigt lösenord";
    case "auth/user-mismatch":
      return "Uppgifterna matchar inte det inloggade kontot";
    case "auth/user-not-found":
      return "Kontot hittades inte";
    case "auth/user-disabled":
      return "Detta konto har inaktiverats";
    case "auth/too-many-requests":
      return "För många försök. Försök igen senare";
    case "auth/network-request-failed":
      return "Nätverksfel. Kontrollera din anslutning";
    // Backend error
    case "api/delete-failed":
      return "Kunde inte ta bort kontot. Försök igen senare";
    default:
      return "Något gick fel. Försök igen";
  }
}

export function getReauthenticateErrorMessage(errorCode: string): string {
  switch (errorCode) {
    case "auth/invalid-credential":
    case "auth/wrong-password":
      return "Felaktigt lösenord";
    case "auth/user-mismatch":
      return "Uppgifterna matchar inte det inloggade kontot";
    case "auth/user-not-found":
      return "Kontot hittades inte";
    case "auth/user-disabled":
      return "Detta konto har inaktiverats";
    case "auth/too-many-requests":
      return "För många försök. Försök igen senare";
    case "auth/network-request-failed":
      return "Nätverksfel. Kontrollera din anslutning";
    case "auth/invalid-email":
      return "Ogiltig e-postadress";
    default:
      return "Kunde inte verifiera dina uppgifter. Försök igen";
  }
}

export function getDeleteUserErrorMessage(errorCode: string): string {
  switch (errorCode) {
    case "auth/requires-recent-login":
      return "Du behöver logga in på nytt innan du kan ta bort kontot";
    case "auth/user-not-found":
      return "Kontot hittades inte";
    case "auth/network-request-failed":
      return "Nätverksfel. Kontrollera din anslutning";
    case "auth/too-many-requests":
      return "För många försök. Försök igen senare";
    default:
      return "Kunde inte ta bort kontot. Försök igen";
  }
}

export function getLoginErrorMessage(errorCode: string): string {
  switch (errorCode) {
    case "auth/user-not-found":
      return "Ingen användare med denna e-postadress finns";
    case "auth/wrong-password":
      return "Felaktigt lösenord";
    case "auth/invalid-email":
      return "Ogiltig e-postadress";
    case "auth/user-disabled":
      return "Detta konto har inaktiverats";
    case "auth/too-many-requests":
      return "För många misslyckade inloggningsförsök. Försök igen senare";
    case "auth/network-request-failed":
      return "Nätverksfel. Kontrollera din anslutning";
    case "auth/invalid-credential":
      return "Felaktig e-postadress eller lösenord";
    case "auth/operation-not-allowed":
      return "Inloggning med e-post och lösenord är inte aktiverat";
    case "auth/popup-closed-by-user":
      return "Inloggningen avbröts";
    default:
      return "Ett fel uppstod vid inloggning. Försök igen";
  }
}
