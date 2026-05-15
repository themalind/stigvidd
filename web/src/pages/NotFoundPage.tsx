import { NavLink } from "react-router";

export default function NotFoundPage() {
  return (
    <div className="flex flex-col gap-2 p-4">
      <p>404 - Nothing here...</p>
      <NavLink to={"/"}>Home</NavLink>
    </div>
  );
}
