import { redirect } from "next/navigation";

export default function LocaleRootPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  // Can't await in a sync redirect, so construct path directly
  redirect("dashboard");
}
