import { call, createActivity, createUser } from "./api.ts";

const host = await createUser("Adaeze");

await createActivity(host, {
  title: "Sunset Kayaking at Lekki",
  description: "Two hours on the lagoon at golden hour. Paddles, life jackets and a short lesson included.",
  capacity: 12,
  priceMinor: 1_500_000,
  daysAhead: 3,
});
await createActivity(host, {
  title: "Secret Speakeasy Tour",
  description: "Three hidden bars on the Island. The address arrives the morning of the tour.",
  capacity: 8,
  priceMinor: 2_500_000,
  daysAhead: 6,
});
const almostFull = await createActivity(host, {
  title: "Rooftop Jazz Supper",
  description: "Live trio, small plates and a view of the Third Mainland Bridge.",
  capacity: 4,
  priceMinor: 3_000_000,
  daysAhead: 2,
});

for (const name of ["Tobi", "Kemi", "Femi"]) {
  await call(`/activities/${almostFull}/bookings`, { method: "POST", userId: await createUser(name) });
}

console.log("Seeded 3 activities. Rooftop Jazz Supper has 1 spot left.");
