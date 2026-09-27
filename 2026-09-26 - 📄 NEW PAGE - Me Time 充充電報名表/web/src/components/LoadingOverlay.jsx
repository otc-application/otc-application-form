/**
 * 送出期間的全屏遮罩。
 *
 * `notice` 用來在「後端忙碌、正自動重試」時取代主標題：沒有它，使用者只會
 * 對著「正在送出報名資料…」等待最壞 11 秒，無法分辨是在運作還是卡死。
 * 第二行的「請勿關閉此頁面」兩種情況都適用，因此不隨 notice 改變。
 */
export default function LoadingOverlay({ notice = '' }) {
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
        <p className="mt-5 text-base font-bold text-stone-900">
          {notice || '正在送出報名資料…'}
        </p>
        <p className="mt-1 text-sm text-stone-500">請稍候，請勿關閉此頁面</p>
      </div>
    </div>
  )
}
