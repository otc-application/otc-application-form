import { eventInfo } from '../data/event.js'
import { sessionDates } from '../data/formSchema.js'

function SummaryRow({ label, children }) {
  return (
    <div className="flex flex-col gap-0.5 border-b border-stone-100 py-3 last:border-b-0 sm:flex-row sm:gap-4">
      <dt className="shrink-0 text-sm font-semibold text-stone-500 sm:w-28">{label}</dt>
      <dd className="text-[15px] text-stone-800">{children}</dd>
    </div>
  )
}

function formatChildren(byDate) {
  const parts = []
  for (const date of sessionDates) {
    const list = byDate?.[date.value] ?? []
    if (list.length === 0) continue
    const text = list
      .map((child) => (child.age ? `${child.name}（${child.age}歲）` : child.name))
      .filter((name) => name && !name.startsWith('（'))
      .join('、')
    if (text) parts.push(`${date.value}：${text}`)
  }
  return parts
}

export default function SuccessScreen({ values, onReset }) {
  const sessions = values.sessions ?? []
  const children = formatChildren(values.childrenByDate)

  return (
    <section
      id="registration"
      aria-live="polite"
      className="mt-6 scroll-mt-4"
    >
      <div className="card overflow-hidden">
        <div className="flex flex-col items-center rounded-2xl bg-gradient-to-br from-rose-50 to-amber-50 px-6 py-10 text-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-rose-600 shadow-lg shadow-rose-600/30">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              className="h-8 w-8 animate-[pop-in_0.4s_ease-out] text-white"
              aria-hidden="true"
            >
              <path
                d="M5 12.5 10 17.5 19 7.5"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          <h2 className="mt-5 text-2xl font-black text-stone-900">報名成功！</h2>
          <p className="mt-2 max-w-md text-[15px] leading-relaxed text-stone-700">
            感謝您報名「{eventInfo.title}」。我們會以電話聯絡確認，請留意來電。
          </p>
        </div>

        <div className="px-1 pt-4">
          <h3 className="px-1 text-sm font-bold tracking-wide text-stone-500 uppercase">
            報名資料
          </h3>
          <dl className="mt-2">
            <SummaryRow label="參加者姓名">{values.attendeeName}</SummaryRow>
            <SummaryRow label="聯絡電話">{values.phone}</SummaryRow>
            <SummaryRow label="所屬類別">{values.category}</SummaryRow>
            {values.referrerName && (
              <SummaryRow label="介紹人">{values.referrerName}</SummaryRow>
            )}
            {(values.believerGroup || values.memberGroup) && (
              <SummaryRow label="小組名稱">
                {values.believerGroup || values.memberGroup}
              </SummaryRow>
            )}
            <SummaryRow label="參加場次">
              {sessions.length > 0 ? sessions.join('、') : '未選擇'}
            </SummaryRow>
            {children.length > 0 && (
              <SummaryRow label="兒童區">
                <ul className="space-y-1">
                  {children.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </SummaryRow>
            )}
          </dl>
        </div>

        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-relaxed text-amber-900">
          <p>
            <span className="font-semibold">請留意：</span>
            早鳥優惠截止 {eventInfo.pricing[0].deadline}，一般收費截止{' '}
            {eventInfo.pricing[1].deadline}。
          </p>
        </div>

        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
          <a
            href={`tel:${eventInfo.contact.phone}`}
            className="inline-flex min-h-12 flex-1 items-center justify-center rounded-full border border-stone-300 px-6 text-[15px] font-semibold text-stone-700 transition hover:bg-stone-50"
          >
            致電 {eventInfo.contact.phone}（{eventInfo.contact.person}）
          </a>
          <button
            type="button"
            onClick={onReset}
            className="inline-flex min-h-12 flex-1 items-center justify-center rounded-full bg-rose-600 px-6 text-[15px] font-bold text-white transition hover:bg-rose-700"
          >
            再填寫一張報名表
          </button>
        </div>

        <p className="mt-4 text-center text-xs text-stone-500">
          同一場活動每位參加者需個別填寫，若要為家人或朋友報名請再按上方按鈕。
        </p>
      </div>
    </section>
  )
}
