import { CreateReviewRequest } from "@/data/types";
import uuid from "react-native-uuid";
import { IP } from "../../ipconfig";
import { getUserToken } from "./users";

export async function createReview(
  request: CreateReviewRequest,
): Promise<{ success: boolean; error?: string }> {
  const token = await getUserToken();

  if (!token) {
    throw new Error("User not authenticated");
  }

  const formData = new FormData();

  // Skapa filobjekten
  request.imageUris?.forEach((uri) => {
    const fileName = `${uuid.v4()}.jpg`;

    formData.append("images", {
      uri: uri,
      type: "image/jpeg",
      name: fileName,
    } as any); // Hittar vi ett annat sätt att typ så byter vi.
  });

  formData.append("userIdentifier", request.userIdentifier);
  formData.append("trailIdentifier", request.trailIdentifier);
  formData.append("trailReview", request.review);
  formData.append("grade", `${request.grade}`);

  try {
    const response = await fetch("http://" + IP + "/api/v1/review/create", {
      method: "POST",
      body: formData,
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    // Läs response body för att se felmeddelandet
    const responseText = await response.text();
    console.log("Server response:", responseText);

    if (!response.ok) {
      console.log(response.body);
    }

    return { success: true };
  } catch (error) {
    console.error("Fel vid uppladdning:", error);
    throw error;
  }
}
