export default function TailwindTest() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 p-8">
      <div className="rounded-2xl bg-white p-10 text-center shadow-2xl">
        <h1 className="text-4xl font-bold text-blue-600">
          Tailwind fonctionne !
        </h1>

        <p className="mt-4 text-lg text-gray-600">
          Fabio IA utilise correctement Tailwind CSS 4.
        </p>

        <button className="mt-6 rounded-lg bg-blue-600 px-6 py-3 font-semibold text-white hover:bg-blue-700">
          Tester le style
        </button>
      </div>
    </main>
  );
}
