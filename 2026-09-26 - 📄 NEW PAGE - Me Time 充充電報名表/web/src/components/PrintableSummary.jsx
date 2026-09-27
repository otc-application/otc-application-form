import { createPortal } from 'react-dom'
import { eventInfo, paymentNotice } from '../data/event.js'
import { buildSummaryRows } from '../lib/summary.js'

/**
 * 列印／存成 PDF 用的區塊。
 *
 * 為什麼用 window.print()，而不是在前端用 jsPDF 直接生檔？
 * jsPDF 內建字型只含 Latin-1，**中文字會全部變成空白方塊（豆腐字）**。要
 * 修就得內嵌 CJK 字型檔，那是 5～10 MB 的 base64，會把 bundle 撐大一個
 * 數量級，而且為了幾個中文字去背整份 Noto Sans TC 不划算。
 *
 * 瀏覽器自己的「另存為 PDF」本來就會用系統 CJK 字型排版，結果正確、檔案
 * 也真的是 PDF，代價只是使用者要自己在列印視窗按一下「儲存為 PDF」。
 * 對報名表這種一次性的確認用途，這個取捨是划算的。
 *
 * 這個區塊平常用 hidden 藏起來，只有 @media print 才會顯示；index.css 的
 * 列印規則會把畫面上其他東西（表單、成功畫面、彈窗）全部藏掉，只留這一塊。
 *
 * ⚠️ 必須用 portal 掛到 document.body 底下，不能放在 App 的 root 裡。
 *    index.css 的規則是 `body > *:not(#print-area) { display: none }` ——
 *    root 被藏掉的時候，藏在 root 裡面的 #print-area 會跟著一起消失，
 *    結果就是「按了匯出，PDF 全白」。App 裡的 `<div class="min-h-screen">`
 *    是 body 的直接子層，所以整棵 App 樹都會被這個規則蓋掉。
 */
export default function PrintableSummary({ values }) {
  const rows = buildSummaryRows(values)

  return createPortal(
    <div id="print-area" aria-hidden="true">
      <h1 className="m-0 text-xl font-bold">報名成功！</h1>
      <p className="mt-2">
        感謝您報名「{eventInfo.title}」。我們會以電話聯絡確認，請留意來電。
      </p>

      <h2 className="mt-6 mb-2 text-base font-bold">報名資料</h2>
      <table className="w-full border-collapse">
        <tbody>
          {rows.map((row) => (
            <tr key={row.label} className="align-top">
              <th
                scope="row"
                className="w-28 border-b border-stone-300 py-1.5 pr-3 text-left align-top text-sm font-semibold"
              >
                {row.label}
              </th>
              <td className="border-b border-stone-300 py-1.5 text-sm">
                {row.lines ? (
                  <ul className="m-0 list-none p-0">
                    {row.lines.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                ) : (
                  row.value
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <p className="mt-4 rounded border border-stone-400 p-2 text-sm">
        <span className="font-semibold">請留意：</span>
        {paymentNotice}
      </p>

      <p className="mt-4 text-xs">
        {eventInfo.organizer}　{eventInfo.venue}
        <br />
        如有疑問請致電 {eventInfo.contact.phone}（{eventInfo.contact.person}）
      </p>
    </div>,
    document.body
  )
}
