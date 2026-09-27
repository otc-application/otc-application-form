import Swal from 'sweetalert2'
import { eventInfo, paymentNotice } from '../data/event.js'
import { buildSummaryRows, escapeHtml } from '../lib/summary.js'

/**
 * 成功圖示（inline SVG）。
 *
 * 用 inline SVG 而非外部圖片或 emoji：SweetAlert2 預設的 `.swal2-icon`
 * 會畫自己的動畫圖示，會跟報名成功畫面打架，所以自己放一個 SVG，
 * 樣式跟 SuccessScreen 的勾勾圈一致。
 */
const successIcon = `
  <span class="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-rose-600 shadow-lg shadow-rose-600/30">
    <svg viewBox="0 0 24 24" fill="none" class="h-7 w-7 text-white" aria-hidden="true">
      <path d="M5 12.5 10 17.5 19 7.5" stroke="currentColor" stroke-width="2.5"
        stroke-linecap="round" stroke-linejoin="round" />
    </svg>
  </span>`

function renderRows(values) {
  return buildSummaryRows(values)
    .map((row) => {
      const body = row.lines
        ? `<ul class="m-0 list-none space-y-1 p-0">${row.lines
            .map((line) => `<li>${escapeHtml(line)}</li>`)
            .join('')}</ul>`
        : escapeHtml(row.value)
      return `
        <div class="flex flex-col gap-0.5 border-b border-stone-100 py-2.5 last:border-b-0 sm:flex-row sm:gap-4">
          <dt class="shrink-0 text-sm font-semibold text-stone-500 sm:w-28">${escapeHtml(row.label)}</dt>
          <dd class="text-[15px] text-stone-800">${body}</dd>
        </div>`
    })
    .join('')
}

/**
 * 報名成功彈窗。
 *
 * 內容與成功畫面完全同源（都吃 buildSummaryRows / paymentNotice），
 * 避免兩邊日後改到不同步。底部兩個按鈕：匯出 PDF、完成。
 *
 * 「匯出報名資料」走 window.print() 而不是前端產生 PDF 檔 —— 原因見
 * PrintableSummary.jsx 的說明（jsPDF 預設無法排中文字）。
 */
export function showSuccessPopup(values) {
  return Swal.fire({
    html: `
      <div class="text-left">
        ${successIcon}
        <h3 class="m-0 text-xl font-black text-stone-900">報名成功！</h3>
        <p class="mx-0 mt-2 mb-4 text-[15px] leading-relaxed text-stone-700">
          感謝您報名<span class="font-semibold text-rose-600 underline">「${escapeHtml(eventInfo.title)}」</span>。我們會以電話聯絡確認，請留意來電。
        </p>

        <h3 class="mt-0 mb-1 text-left text-sm font-bold tracking-wide text-stone-500 uppercase">報名資料</h3>
        <dl class="m-0">${renderRows(values)}</dl>

        <p class="mt-4 mb-0 rounded-xl border border-amber-200 bg-amber-50 p-3 text-left text-sm leading-relaxed text-amber-900">
          <span class="font-semibold">請留意：</span>${escapeHtml(paymentNotice)}
        </p>
      </div>`,
    showConfirmButton: true,
    confirmButtonText: '匯出報名資料（PDF）',
    showCancelButton: true,
    cancelButtonText: '完成',
    customClass: {
      popup: 'rounded-2xl',
      confirmButton:
        'rounded-full bg-rose-600 font-semibold shadow-none hover:bg-rose-700 focus:ring-rose-200',
      cancelButton:
        'rounded-full border border-stone-300 font-semibold text-stone-700 shadow-none hover:bg-stone-50',
    },
    buttonsStyling: false,
    reverseButtons: true,
    allowOutsideClick: true,
  }).then((result) => {
    // 只有按「匯出報名資料」才跳列印；按「完成」或按空白處關閉都不要跳，
    // 免得使用者只是想關掉視窗卻被拉進列印畫面。
    if (result.isConfirmed) window.print()
  })
}
