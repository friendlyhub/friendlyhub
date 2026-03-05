const statusColors: Record<string, string> = {
  pending_build: 'bg-yellow-100 text-yellow-800',
  building: 'bg-blue-100 text-blue-800',
  build_failed: 'bg-red-100 text-red-800',
  pending_review: 'bg-purple-100 text-purple-800',
  approved: 'bg-green-100 text-green-800',
  changes_requested: 'bg-orange-100 text-orange-800',
  published: 'bg-emerald-100 text-emerald-800',
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
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColors[status] || 'bg-gray-100 text-gray-800'}`}
    >
      {statusLabels[status] || status}
    </span>
  );
}
