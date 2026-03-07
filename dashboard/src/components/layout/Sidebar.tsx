import type { ReactNode } from "react";

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}

export function Sidebar({ open, onClose, title, children }: Props) {
  if (!open) return null;

  return (
    <>
      <div
        className="fixed inset-0 bg-black/20 z-40"
        onClick={onClose}
      />
      <aside className="fixed right-0 top-0 h-full w-96 bg-white border-l shadow-xl z-50 flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h2 className="font-semibold">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-lg"
          >
            x
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">{children}</div>
      </aside>
    </>
  );
}
