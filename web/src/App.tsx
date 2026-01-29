import CommingSoonImages from "./comming-soon/comming-soon";

export default function App() {
  return (
    <div className="h-full flex justify-center items-center gap-4 bg-stone-900">
<div className="flex flex-col items-center lg:flex-row lg:items-stretch">
  <div
    className="flex flex-col justify-center w-2xs pb-4
               items-center text-center
               lg:items-start lg:text-left lg:order-last"
  >
    <div className="flex items-center pb-3">
      <div className="w-20 aspect-square rounded-full overflow-hidden">
        <img src="src/assets/icon.png" />
      </div>
      <div className="pl-3">
        <h1 className="text-3xl text-stone-200">Stigvidd</h1>
      </div>
    </div>

    <div className="text-stone-200">
      <p>Kommer snart!</p>
      <p>Våren 2026</p>
    </div>
  </div>

  <CommingSoonImages />
</div>
    </div>
  )
}