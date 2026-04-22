"use client";

import { useState } from "react";
import { MessageCircle, X } from "lucide-react";

export function HuReportWidget() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* Floating Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 h-14 w-14 rounded-full bg-blue-600 text-white shadow-lg hover:bg-blue-700 transition-colors flex items-center justify-center z-40"
        aria-label="Report bug"
      >
        {isOpen ? (
          <X className="w-6 h-6" />
        ) : (
          <MessageCircle className="w-6 h-6" />
        )}
      </button>

      {/* Widget Panel */}
      {isOpen && (
        <div className="fixed bottom-24 right-6 w-96 bg-white dark:bg-slate-900 rounded-lg shadow-2xl z-40 p-6">
          <h2 className="text-lg font-semibold mb-4">Report a Bug</h2>
          <p className="text-sm text-text-secondary mb-4">
            Help us improve by reporting bugs you encounter.
          </p>
          <form className="space-y-4">
            <input
              type="text"
              placeholder="What's the issue?"
              className="w-full px-3 py-2 border border-gray-300 dark:border-slate-700 rounded-md text-sm"
            />
            <textarea
              placeholder="Describe the bug..."
              className="w-full px-3 py-2 border border-gray-300 dark:border-slate-700 rounded-md text-sm h-24"
            />
            <button
              type="submit"
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 transition-colors"
            >
              Submit Report
            </button>
          </form>
        </div>
      )}
    </>
  );
}
