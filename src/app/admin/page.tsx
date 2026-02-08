import Nav from "@/components/Nav";

// Replace these with your actual Google Form embed URLs
// To get: Open form → Send → Embed HTML → copy the src URL from the iframe
const PAYMENT_FORM_URL = process.env.NEXT_PUBLIC_PAYMENT_FORM_URL || "";
const PARCEL_FORM_URL = process.env.NEXT_PUBLIC_PARCEL_FORM_URL || "";

export default function AdminPage() {
  return (
    <>
      <Nav />
      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        <h1 className="mb-2 text-2xl font-semibold text-stone-900">
          Admin
        </h1>
        <p className="mb-8 text-sm text-stone-500">
          Record payments and update parcel status via the forms below.
        </p>

        <div className="space-y-10">
          <section>
            <h2 className="mb-4 text-lg font-medium text-stone-700">
              Record Tenant Payment
            </h2>
            {PAYMENT_FORM_URL ? (
              <div className="overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm">
                <iframe
                  src={PAYMENT_FORM_URL}
                  width="100%"
                  height="600"
                  frameBorder="0"
                  marginHeight={0}
                  marginWidth={0}
                  title="Record payment"
                  className="min-h-[400px]"
                />
              </div>
            ) : (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-amber-800">
                <p className="font-medium">Form not configured</p>
                <p className="mt-1 text-sm">
                  Add NEXT_PUBLIC_PAYMENT_FORM_URL to .env.local with your Google Form embed URL.
                </p>
                <p className="mt-2 text-sm opacity-90">
                  Create a form with: Tenant name, Room, Bed, Amount paid, Date. In the form
                  settings, enable &quot;Collect emails&quot; if needed, then Send → Embed HTML →
                  copy the iframe src.
                </p>
              </div>
            )}
          </section>

          <section>
            <h2 className="mb-4 text-lg font-medium text-stone-700">
              Update Parcel Status
            </h2>
            {PARCEL_FORM_URL ? (
              <div className="overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm">
                <iframe
                  src={PARCEL_FORM_URL}
                  width="100%"
                  height="600"
                  frameBorder="0"
                  marginHeight={0}
                  marginWidth={0}
                  title="Update parcel status"
                  className="min-h-[400px]"
                />
              </div>
            ) : (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-amber-800">
                <p className="font-medium">Form not configured</p>
                <p className="mt-1 text-sm">
                  Add NEXT_PUBLIC_PARCEL_FORM_URL to .env.local with your Google Form embed URL.
                </p>
                <p className="mt-2 text-sm opacity-90">
                  Create a form with: Tenant name, Room, Status (Incoming/Arrived/Claimed).
                  Send → Embed HTML → copy the iframe src.
                </p>
              </div>
            )}
          </section>
        </div>
      </main>
    </>
  );
}
