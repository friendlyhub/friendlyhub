const statusColors: Record<string, string> = {
  pending_build: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-300',
  building: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300',
  build_failed: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300',
  pending_review: 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300',
  approved: 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300',
  changes_requested: 'bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300',
  published: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
};

const statusLabels: Record<string, string> = {
  pending_build: 'Pending Build',
  building: 'Building',
  build_failed: 'Build Failed',
  pending_review: 'Pending Review',
  approved: 'Approved',
  changes_requested: 'Changes Requested',
  published: 'Published',
};

export default function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColors[status] || 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300'}`}
    >
      {statusLabels[status] || status}
    </span>
  );
}
