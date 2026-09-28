/**
 * 動態報名表單欄位定義。
 *
 * 來源：同層目錄的 ../feed_prompt/Questions.md
 *
 * 這個檔案是表單的單一資料來源：欄位順序同時決定
 *   1. 畫面上的欄位順序
 *   2. 送到 Google 試算表的欄位（column）順序
 * 因此 **欄位順序不可任意更動**，GAS 會依 payload 順序 append，
 * 順序錯亂會寫錯欄。
 *
 * 每個欄位的 `column` 是試算表標題列文字。多個欄位可以共用同一個
 * column（例如「小組名稱」同時服務於新朋友與會友），buildRow 會
 * 依外觀順序去重並取第一個有值的欄位。
 */

/** 場次選項同時用於「本人參加」勾選與兒童區日期。 */
export const sessionDates = [
  { value: '10月31日', label: '10 月 31 日（六）', course: '酒精墨水治癒燈箱製作' },
  { value: '11月7日', label: '11 月 7 日（六）', course: '毛根扭花相框工作坊' },
  { value: '11月21日', label: '11 月 21 日（六）', course: '舒展拉筋班 1' },
  { value: '11月28日', label: '11 月 28 日（六）', course: '舒展拉筋班 2' },
  { value: '12月5日', label: '12 月 5 日（六）', course: '舒展拉筋班 3' },
  { value: '12月12日', label: '12 月 12 日（六）', course: '舒展拉筋班 4' },
]

/** 兒童區欄位前綴，試算表每個日期一欄。 */
export const childrenColumnPrefix = '兒童區 - '

/**
 * 電郵通知的選項值。
 *
 * 這兩個字串同時是**試算表儲存的內容**與 GAS 判斷要不要寄信的依據，
 * `gas/Code.gs` 的 `EMAIL_CONSENT_YES` 必須與 `yes` 完全相同。
 */
export const EMAIL_CONSENT = { yes: '需要', no: '不需要' }

export const formSchema = [
  {
    name: 'attendeeName',
    column: '參加者姓名',
    type: 'text',
    label: '參加者姓名',
    required: true,
    placeholder: '請填寫參加者姓名',
    hint: '每位參加者請填寫一張報名表。',
  },
  {
    name: 'phone',
    column: '聯絡電話',
    type: 'tel',
    label: '聯絡電話',
    required: true,
    placeholder: '請輸入可聯絡的電話號碼',
  },
  {
    name: 'category',
    column: '所屬類別',
    type: 'radio',
    label: '所屬類別',
    required: true,
    options: [
      {
        value: '新朋友 - 未信主',
        label: '新朋友 - 未信主',
        fields: [
          {
            name: 'referrerName',
            column: '新朋友介紹人姓名（如適用）',
            type: 'text',
            label: '新朋友介紹人姓名',
            placeholder: '如適用',
          },
          {
            name: 'referrerPhone',
            column: '新朋友介紹人聯絡電話（如適用）',
            type: 'tel',
            label: '新朋友介紹人聯絡電話',
            placeholder: '如適用',
          },
        ],
      },
      {
        value: '新朋友 - 已信主',
        label: '新朋友 - 已信主',
        fields: [
          {
            name: 'believerGroup',
            column: '小組名稱（如適用）',
            type: 'text',
            label: '小組名稱',
            placeholder: '如適用',
          },
        ],
      },
      {
        value: '本堂會友',
        label: '本堂會友',
        fields: [
          {
            name: 'memberGroup',
            column: '小組名稱（如適用）',
            type: 'text',
            label: '小組名稱',
            placeholder: '如適用',
          },
        ],
      },
    ],
  },
  {
    name: 'sessions',
    column: '本人參加',
    type: 'checkboxGroup',
    label: '本人參加',
    required: true,
    hint: '可複選。',
    options: sessionDates.map((d) => ({
      value: d.value,
      label: d.label,
      sublabel: d.course,
    })),
  },
  {
    name: 'childrenByDate',
    type: 'childrenByDate',
    label: '本人會攜同子女享用兒童區的藝術／益智遊戲',
    hint: '勾選場次後，請填寫每位子女的姓名與年齡；不帶子女請略過此區。',
    dates: sessionDates,
  },
  {
    name: 'emailNotify',
    column: '電郵通知',
    type: 'radio',
    label: '你是否需要電郵通知？',
    required: true,
    options: [
      {
        value: EMAIL_CONSENT.yes,
        label: EMAIL_CONSENT.yes,
        fields: [
          {
            name: 'email',
            column: '電郵地址',
            type: 'email',
            label: '電郵地址',
            required: true,
            placeholder: '請輸入電郵地址',
            hint: '我們會將報名確認信寄到這個地址。',
            dependsOn: { field: 'emailNotify', value: EMAIL_CONSENT.yes },
          },
        ],
      },
      {
        value: EMAIL_CONSENT.no,
        label: EMAIL_CONSENT.no,
      },
    ],
  },
]

/** 驗證訊息（比照欄位 label 產生，維持全站繁體中文）。 */
export function requiredMessage(label) {
  return `請填寫「${label}」`
}
