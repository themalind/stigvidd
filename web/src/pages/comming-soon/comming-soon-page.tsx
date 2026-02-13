import { Link } from "react-router";
import CommingSoonImages from "./comming-soon-images";

export default function CommingSoonPage() {
  return (
    <>
      <div className="h-full flex justify-center items-center gap-4 bg-stone-900">
        <div className="flex flex-col items-center lg:gap-10 lg:flex-row lg:items-stretch">
          <div
            className="flex flex-col justify-center w-2xs pb-4
                   items-center text-center
                   lg:items-start lg:text-left lg:order-last"
          >
            <Link to={"/login"}>
              <div className="flex items-center mb-3 outline-1 outline-red-500">
                <div className="w-20 aspect-square rounded-full overflow-hidden">
                  <img src="src/assets/icon.png" />
                </div>
                <div className="pl-3">
                  <h1 className="text-3xl text-stone-200">Stigvidd</h1>
                </div>
              </div>
            </Link>

            <div className="text-stone-200">
              <p>Kommer snart!</p>
              <p>Våren 2026</p>
            </div>
          </div>

          <CommingSoonImages />
        </div>
      </div>
    </>
  );
}
