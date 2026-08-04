import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import SettingsSection from "@/components/SettingsSection";
import UserManagement from "@/components/UserManagement";
import { UsersIcon } from "@/components/icons";

export default async function UsersSettingsPage() {
  const user = await getCurrentUser();
  if (user?.role !== "admin") redirect("/settings/security");

  return (
    <SettingsSection
      title="Users"
      description="Add lawyers or staff, assign roles, and manage access."
      icon={UsersIcon}
    >
      <UserManagement />
    </SettingsSection>
  );
}
