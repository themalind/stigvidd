export default function issueTypeParser(issueType: string) {
  switch (issueType) {
    case "FallenTree":
      return "Nedfallet träd";
    case "Mud":
      return "Lerigt";
    case "Flooding":
      return "Översvämning";
    case "Shelter":
      return "Vindskydd";
    case "FirePit":
      return "Grillplats";
    case "Walkway":
      return "Spång";
    case "Signage":
      return "Skyltning";
    case "Other":
      return "Annat";
    default:
      return "Annat";
  }
}
