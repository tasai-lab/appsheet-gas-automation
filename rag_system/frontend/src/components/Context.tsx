import type { KnowledgeItem } from "@/types/chat";

interface ContextProps {
  items: KnowledgeItem[];
}

export default function Context({ items }: ContextProps) {
  if (items.length === 0) return null;

  return (
    <div className="mb-6 bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
      <h3 className="text-sm font-semibold mb-3 text-blue-900 dark:text-blue-100">
        検索コンテキスト ({items.length}件)
      </h3>
      <div className="space-y-3">
        {items.map((item, index) => (
          <div
            key={item.id}
            className="bg-white dark:bg-gray-800 rounded p-3 text-sm"
          >
            <div className="flex items-start justify-between mb-2">
              <div className="flex-1">
                <div className="font-semibold text-gray-900 dark:text-gray-100">
                  {index + 1}. {item.title}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {item.domain} {item.source_type && `· ${item.source_type}`}{" "}
                  {item.date && `· ${item.date}`}
                </div>
              </div>
              <div className="ml-2 text-xs font-mono bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
                {item.score.toFixed(3)}
              </div>
            </div>
            <div className="text-gray-700 dark:text-gray-300 line-clamp-3">
              {item.content}
            </div>
            {item.tags && item.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {item.tags.map((tag) => (
                  <span
                    key={tag}
                    className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-0.5 rounded"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
