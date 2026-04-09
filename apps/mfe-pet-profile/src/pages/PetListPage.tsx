export function PetListPage() {
  const storedName = localStorage.getItem("companion_ai_profile_name") || "Pet Owner";
  const firstName = storedName.trim().split(/\s+/)[0] || "Pet Owner";

  const pets = [
    { id: "max", name: "Max", details: "Golden Retriever • 3 years", emoji: "🐕" },
    { id: "luna", name: "Luna", details: "Persian Cat • 2 years", emoji: "🐈" },
  ];

  const predictions = [
    { id: "1", title: "Mild Skin Allergy", pet: "Max", age: "2 days ago", risk: "low risk", riskClass: "bg-emerald-100 text-emerald-700" },
    { id: "2", title: "Digestive Issue", pet: "Luna", age: "5 days ago", risk: "medium risk", riskClass: "bg-amber-100 text-amber-700" },
  ];

  const reminders = [
    { id: "1", vaccine: "Rabies Booster", pet: "Max", due: "March 20, 2026" },
    { id: "2", vaccine: "FVRCP", pet: "Luna", due: "March 28, 2026" },
  ];

  const bottomNavItems = [
    { id: "dashboard", label: "Dashboard", icon: "🏠", active: true },
    { id: "pets", label: "My Pets", icon: "🤍", active: false },
    { id: "analysis", label: "AI Analysis", icon: "🧠", active: false },
    { id: "clinics", label: "Clinics", icon: "📍", active: false },
    { id: "profile", label: "Profile", icon: "👤", active: false },
  ];

  return (
    <div className="min-h-full bg-slate-100">
      <section className="rounded-b-3xl bg-green-500 px-5 pb-7 pt-8 text-white">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[20px] leading-7 text-white/90">Welcome back,</p>
            <h1 className="mt-1 text-[42px] font-semibold leading-tight">{firstName}</h1>
          </div>
          <button
            type="button"
            className="h-14 w-14 rounded-full bg-white/20 text-2xl"
            aria-label="Notifications"
          >
            🔔
          </button>
        </div>
      </section>

      <section className="px-5 pb-28 pt-4 space-y-6">
        <div className="rounded-2xl border-l-4 border-red-500 bg-red-50 p-4 text-red-700">
          <p className="text-[34px] leading-none">⚠️</p>
          <h2 className="mt-2 text-3xl font-medium">Emergency Alert</h2>
          <p className="mt-2 text-xl leading-8">
            Luna&apos;s recent symptoms indicate possible high-risk condition. Consult a vet immediately.
          </p>
          <button className="mt-3 text-xl underline underline-offset-4" type="button">Find Nearby Vet</button>
        </div>

        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-4xl font-semibold text-slate-900">My Pets</h2>
            <button type="button" className="text-3xl font-medium text-green-500">View All</button>
          </div>

          <div className="space-y-3">
            {pets.map((pet) => (
              <article key={pet.id} className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 text-3xl">
                    {pet.emoji}
                  </div>
                  <div>
                    <h3 className="text-2xl font-medium text-slate-900">{pet.name}</h3>
                    <p className="text-xl text-slate-600">{pet.details}</p>
                  </div>
                </div>
                <span className="text-3xl text-slate-400">⌁</span>
              </article>
            ))}
          </div>
        </div>

        <div>
          <h2 className="mb-3 text-4xl font-semibold text-slate-900">Recent AI Predictions</h2>
          <div className="space-y-3">
            {predictions.map((item) => (
              <article key={item.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-3xl font-medium text-slate-900">{item.title}</h3>
                    <p className="mt-1 text-2xl text-slate-700">{item.pet}</p>
                    <p className="mt-2 text-xl text-slate-500">↗ {item.age}</p>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-lg font-medium ${item.riskClass}`}>{item.risk}</span>
                </div>
              </article>
            ))}
          </div>
        </div>

        <div>
          <h2 className="mb-3 text-4xl font-semibold text-slate-900">Vaccination Reminders</h2>
          <div className="space-y-3">
            {reminders.map((item) => (
              <article key={item.id} className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-100 text-2xl text-blue-600">📅</div>
                <div>
                  <h3 className="text-3xl font-medium text-slate-900">{item.vaccine}</h3>
                  <p className="text-2xl text-slate-700">{item.pet}</p>
                  <p className="mt-1 text-2xl text-green-500">Due: {item.due}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-slate-200 bg-white">
        <div className="mx-auto grid w-full max-w-5xl grid-cols-5 px-2 py-3">
          {bottomNavItems.map((item) => (
            <button key={item.id} type="button" className="flex flex-col items-center justify-center gap-1">
              <span className={`text-xl ${item.active ? "text-green-500" : "text-slate-400"}`}>{item.icon}</span>
              <span className={`text-xs font-medium ${item.active ? "text-green-500" : "text-slate-500"}`}>{item.label}</span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}
