import { EMAIL_CONSENT, sessionDates } from '../data/formSchema.js'

/**
 * 組出「報名資料」摘要列。
 *
 * 成功畫面、報名成功彈窗、列印／PDF 三個地方都要顯示同一份摘要，所以資料
 * 在這裡組一次，不要各自從 values 拼。回傳 `value`（單行）或 `lines`（多行）
 * ——兒童區每個日期一列，只有用多行才不會塞成一長串。
 */
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

export function buildSummaryRows(values) {
  const sessions = values.sessions ?? []
  const rows = []

  rows.push({ label: '參加者姓名', value: values.attendeeName })
  rows.push({ label: '聯絡電話', value: values.phone })
  rows.push({ label: '所屬類別', value: values.category })

  if (values.referrerName) {
    rows.push({ label: '介紹人', value: values.referrerName })
  }
  if (values.believerGroup || values.memberGroup) {
    rows.push({ label: '小組名稱', value: values.believerGroup || values.memberGroup })
  }
  rows.push({
    label: '參加場次',
    value: sessions.length > 0 ? sessions.join('、') : '未選擇',
  })
  if (values.emailNotify) {
    rows.push({
      label: '電郵通知',
      value:
        values.emailNotify === EMAIL_CONSENT.yes
          ? `需要（${values.email}）`
          : values.emailNotify,
    })
  }

  const children = formatChildren(values.childrenByDate)
  if (children.length > 0) {
    rows.push({ label: '兒童區', lines: children })
  }

  return rows
}

/**
 * HTML 字串逸出。
 *
 * SweetAlert2 的 `htmlContent` 是直接 innerHTML，**不會**幫你消毒，官方文件
 * 自己也提醒這是 XSS 風險。雖然這裡的值是使用者剛自己填的（自己攻擊自己，
 * 危害有限），但姓名／電話／電郵是逐字塞進 innerHTML 的，照樣不能漏掉。
 */
export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
