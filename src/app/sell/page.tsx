import { SellForm } from "@/components/sell-form";

export default async function SellPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string }>;
}) {
  const { edit } = await searchParams;
  return <SellForm editId={edit} />;
}
