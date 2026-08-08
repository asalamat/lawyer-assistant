import { redirect } from "next/navigation";

// Help is now a single scrollable page with anchor sections rather than one
// route per item — this keeps old bookmarks to /help/<slug> working.
export default async function HelpItemRedirect({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  redirect(`/help#${slug}`);
}
