export default function EmptyServerState() {
  return (
    <div className="text-center py-8">
      <div className="text-gray-400 dark:text-gray-500 mb-4">
        <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1}
            d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01"
          />
        </svg>
      </div>
      <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-1">
        No servers configured
      </h3>
      <p className="text-gray-500 dark:text-gray-400">
        Add your first server to start managing Docker Compose stacks.
      </p>
    </div>
  );
}
