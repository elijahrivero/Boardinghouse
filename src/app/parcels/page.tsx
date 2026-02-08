import Nav from "@/components/Nav";
import ParcelList from "@/components/ParcelList";

export default function ParcelsPage() {
  return (
    <>
      <Nav />
      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        <h1 className="mb-6 text-2xl font-semibold text-stone-900">
          Parcel Status
        </h1>
        <ParcelList />
      </main>
    </>
  );
}
