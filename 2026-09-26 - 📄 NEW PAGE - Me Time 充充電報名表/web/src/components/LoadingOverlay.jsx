export default function LoadingOverlay() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/50 backdrop-blur-sm"
    >
      <div className="mx-4 w-full max-w-xs rounded-2xl bg-white p-8 text-center shadow-2xl">
        <span
          aria-hidden="true"
          className="mx-auto block h-12 w-12 animate-spin rounded-full border-4 border-rose-100 border-t-rose-600"
        />
        <p className="mt-5 text-base font-bold text-stone-900">正在送出報名資料…</p>
        <p className="mt-1 text-sm text-stone-500">請稍候，請勿關閉此頁面</p>
      </div>
    </div>
  )
}
