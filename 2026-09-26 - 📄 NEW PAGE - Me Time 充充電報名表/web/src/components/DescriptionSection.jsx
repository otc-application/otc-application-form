import { courseGroups, eventInfo } from '../data/event.js'

/**
 * 外部連結：新分頁開啟，附讀屏用的提示文字。
 *
 * ⚠️ **必須用 function 宣告**（function declaration 會 hoist），不能用
 *    `const` 箭嘴：底下的 `infoItems` 是模組層級 const，在 import 階段就
 *    求值並呼叫這個元件。若改成 const 箭嘴，呼叫時會撞 TDZ → 整頁白屏
 *    （ReferenceError: Cannot access 'ExternalLink' before initialization），
 *    而且 **Vite build 照樣編譯通過**，只有執行時才爆。
 *
 * 樣式與同檔案的「查詢電話」連結同組；`tel:` 連結刻意不用這個元件
 * （撥電話不該開新分頁）。
 */
function ExternalLink({ href, hint, children }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="font-semibold text-rose-700 underline decoration-rose-300 underline-offset-4 hover:decoration-rose-600"
    >
      {children}
      <span className="sr-only">{hint}</span>
    </a>
  )
}

const infoItems = [
  {
    label: '主辦單位',
    value: eventInfo.organizerUrl ? (
      <ExternalLink href={eventInfo.organizerUrl} hint="（在教會網站開啟）">
        {eventInfo.organizer}
      </ExternalLink>
    ) : (
      eventInfo.organizer
    ),
  },
  {
    label: '地點',
    value: eventInfo.mapUrl ? (
      <ExternalLink href={eventInfo.mapUrl} hint="（在地圖中開啟）">
        {eventInfo.venue}
      </ExternalLink>
    ) : (
      eventInfo.venue
    ),
  },
  { label: '名額', value: eventInfo.quota },
  { label: '資格', value: eventInfo.eligibility.join('、') },
  {
    label: '查詢電話',
    value: (
      <a
        href={`tel:${eventInfo.contact.phone}`}
        className="font-semibold text-rose-700 underline decoration-rose-300 underline-offset-4 hover:decoration-rose-600"
      >
        {eventInfo.contact.phone}（{eventInfo.contact.person}）
      </a>
    ),
  },
]

function InfoGrid() {
  return (
    <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
      {infoItems.map((item) => (
        <div key={item.label} className="min-w-0">
          <dt className="text-xs font-semibold tracking-wide text-stone-500 uppercase">
            {item.label}
          </dt>
          <dd className="mt-1 text-[15px] leading-relaxed text-stone-800">{item.value}</dd>
        </div>
      ))}
    </dl>
  )
}

function PricingCards() {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {eventInfo.pricing.map((tier) => (
        <div
          key={tier.label}
          className={[
            'rounded-2xl border p-5',
            tier.highlight
              ? 'border-rose-200 bg-gradient-to-br from-rose-50 to-amber-50'
              : 'border-stone-200 bg-stone-50',
          ].join(' ')}
        >
          <div className="flex items-center gap-2">
            <h4 className="text-base font-bold text-stone-900">{tier.label}</h4>
            {tier.highlight && (
              <span className="rounded-full bg-rose-600 px-2 py-0.5 text-[11px] font-semibold text-white">
                最優惠
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-stone-500">{tier.deadline && `截止 ${tier.deadline}`}</p>
          <ul className="mt-3 space-y-1">
            {tier.items.map((item) => (
              <li key={item} className="text-lg font-semibold text-stone-900">
                {item}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}

function CourseGroup({ group }) {
  return (
    <div>
      <div className="flex items-start gap-3">
        <span aria-hidden="true" className="text-2xl leading-none">
          {group.icon}
        </span>
        <div>
          <h3 className="text-xl font-bold text-stone-900">{group.name}</h3>
          <p className="mt-1 text-sm text-stone-600">
            導師：<span className="font-medium text-stone-800">{group.teacher}</span>
            <br />
            <span className="text-stone-500">{group.teacherTitle}</span>
          </p>
        </div>
      </div>

      <div className="mt-4 space-y-4">
        {group.sessions.map((session) => (
          <div key={session.name} className="rounded-2xl border border-stone-200 bg-stone-50/70 p-4">
            <h4 className="text-base font-bold text-stone-900">
              {session.order && <span className="text-rose-600">{session.order}：</span>}
              {session.name}
            </h4>
            <dl className="mt-2 grid gap-x-6 gap-y-1 text-sm text-stone-700 sm:grid-cols-2">
              <div>
                <dt className="inline font-medium text-stone-500">上課日期：</dt>
                <dd className="inline">{session.date}</dd>
              </div>
              <div>
                <dt className="inline font-medium text-stone-500">上課時間：</dt>
                <dd className="inline">{session.time}</dd>
              </div>
            </dl>
            <p className="mt-2 text-sm font-medium text-rose-800">{session.theme}</p>
            <p className="mt-2 text-[15px] leading-relaxed text-stone-700">{session.intro}</p>
            <ul className="mt-3 space-y-1.5">
              {session.highlights.map((point) => (
                <li key={point} className="flex gap-2 text-sm leading-relaxed text-stone-700">
                  <span aria-hidden="true" className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-rose-400" />
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function DescriptionSection() {
  return (
    <section id="description" className="scroll-mt-4">
      <div className="rounded-3xl bg-gradient-to-br from-rose-100 via-amber-50 to-stone-50 p-6 shadow-sm sm:p-10">
        <p className="text-sm font-semibold tracking-widest text-rose-700 uppercase">
          {eventInfo.organizer}
        </p>
        <h1 className="mt-2 text-3xl font-black tracking-tight text-stone-900 sm:text-4xl">
          <span style={{ fontSize: '65%' }}>New Page 2026 - </span>Me Time 充充電報名表
        </h1>
        <p className="mt-3 max-w-2xl text-base leading-relaxed text-stone-700 sm:text-lg">
          {eventInfo.tagline}
        </p>
        <a
          href="#registration"
          className="mt-6 inline-flex min-h-12 w-full items-center justify-center rounded-full bg-rose-600 px-8 text-base font-bold text-white shadow-lg shadow-rose-600/25 transition hover:bg-rose-700 active:scale-[0.98] sm:w-auto"
        >
          立即填寫報名表
        </a>
      </div>

      <div className="card mt-6">
        <h2 className="mb-4 text-lg font-bold text-stone-900">活動資訊</h2>
        <InfoGrid />
      </div>

      <div className="card mt-6">
        <h2 className="mb-4 text-lg font-bold text-stone-900">收費</h2>
        <PricingCards />
        <p className="mt-4 text-[15px] leading-relaxed text-stone-700">
          10月19日起：$50/堂。名額有限，欲報從速！
        </p>
      </div>

      <div className="card mt-6">
        <h2 className="mb-3 text-lg font-bold text-stone-900">備註</h2>
        <ul className="space-y-2">
          {eventInfo.notes.map((note) => (
            <li key={note} className="flex gap-2 text-[15px] leading-relaxed text-stone-700">
              <span aria-hidden="true" className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-stone-400" />
              <span>{note}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="card mt-6 space-y-8">
        <h2 className="text-lg font-bold text-stone-900">課程介紹</h2>
        {courseGroups.map((group) => (
          <CourseGroup key={group.id} group={group} />
        ))}
      </div>
    </section>
  )
}
