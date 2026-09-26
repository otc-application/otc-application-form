function RequiredMark() {
  return (
    <span className="ml-1 text-rose-600" aria-hidden="true">
      *
    </span>
  )
}

function Hint({ children }) {
  if (!children) return null
  return <p className="mt-1.5 text-xs leading-relaxed text-stone-500">{children}</p>
}

function ErrorText({ children }) {
  if (!children) return null
  return (
    <p className="mt-1.5 flex items-start gap-1 text-xs font-medium text-rose-600">
      <span aria-hidden="true">⚠</span>
      <span>{children}</span>
    </p>
  )
}

/** 單行輸入框的原生屬性對應，讓手機選單與瀏覽器自動填寫行為正確。 */
const INPUT_ATTRS = {
  tel: { type: 'tel', inputMode: 'tel', autoComplete: 'tel' },
  email: { type: 'email', inputMode: 'email', autoComplete: 'email' },
}

function TextField({ field, value, error, onChange }) {
  const attrs = INPUT_ATTRS[field.type] ?? {
    type: 'text',
    inputMode: undefined,
    autoComplete: 'name',
  }

  return (
    <div>
      <label className="field-label" htmlFor={field.name}>
        {field.label}
        {field.required && <RequiredMark />}
      </label>
      <input
        id={field.name}
        name={field.name}
        type={attrs.type}
        inputMode={attrs.inputMode}
        autoComplete={attrs.autoComplete}
        className="field-input"
        placeholder={field.placeholder}
        value={value ?? ''}
        aria-invalid={error ? 'true' : undefined}
        data-invalid={error ? 'true' : undefined}
        onChange={(event) => onChange(field.name, event.target.value)}
      />
      {error ? <ErrorText>{error}</ErrorText> : <Hint>{field.hint}</Hint>}
    </div>
  )
}

function RadioField({ field, value, values, errors, onChange }) {
  const active = field.options.find((option) => option.value === value)

  return (
    <fieldset>
      <legend className="field-label">
        {field.label}
        {field.required && <RequiredMark />}
      </legend>
      <div className="grid gap-2">
        {field.options.map((option) => {
          const checked = value === option.value
          return (
            <label
              key={option.value}
              className={[
                'flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 transition',
                checked
                  ? 'border-rose-400 bg-rose-50 ring-2 ring-rose-200'
                  : 'border-stone-300 bg-white hover:border-stone-400',
              ].join(' ')}
            >
              <input
                type="radio"
                name={field.name}
                value={option.value}
                checked={checked}
                onChange={() => onChange(field.name, option.value)}
                className="h-5 w-5 shrink-0 accent-rose-600"
              />
              <span className="text-[15px] font-medium text-stone-800">{option.label}</span>
            </label>
          )
        })}
      </div>
      <ErrorText>{errors[field.name]}</ErrorText>

      {active?.fields?.length > 0 && (
        <div className="mt-4 space-y-4 rounded-xl border border-dashed border-stone-300 bg-stone-50 p-4">
          {active.fields.map((sub) => (
            <TextField
              key={sub.name}
              field={sub}
              value={values[sub.name]}
              error={errors[sub.name]}
              onChange={onChange}
            />
          ))}
        </div>
      )}
    </fieldset>
  )
}

function CheckboxGroupField({ field, value, error, onChange }) {
  const selected = value ?? []

  const toggle = (option) => {
    onChange(
      field.name,
      selected.includes(option) ? selected.filter((v) => v !== option) : [...selected, option],
    )
  }

  return (
    <fieldset>
      <legend className="field-label">
        {field.label}
        {field.required && <RequiredMark />}
      </legend>
      <div className="grid gap-2">
        {field.options.map((option) => {
          const checked = selected.includes(option.value)
          return (
            <label
              key={option.value}
              className={[
                'flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 transition',
                checked
                  ? 'border-rose-400 bg-rose-50 ring-2 ring-rose-200'
                  : 'border-stone-300 bg-white hover:border-stone-400',
              ].join(' ')}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => toggle(option.value)}
                className="h-5 w-5 shrink-0 accent-rose-600"
              />
              <span className="min-w-0">
                <span className="block text-[15px] font-medium text-stone-800">{option.label}</span>
                {option.sublabel && (
                  <span className="block text-xs text-stone-500">{option.sublabel}</span>
                )}
              </span>
            </label>
          )
        })}
      </div>
      {error ? <ErrorText>{error}</ErrorText> : <Hint>{field.hint}</Hint>}
    </fieldset>
  )
}

function ChildrenField({ field, value, errors, onChange }) {
  const byDate = value ?? {}
  const errorPrefix = `${field.name}.`

  const setDate = (dateValue, nextList) => {
    onChange(field.name, { ...byDate, [dateValue]: nextList })
  }

  const toggleDate = (dateValue, checked) => {
    setDate(dateValue, checked ? [{ name: '', age: '' }] : [])
  }

  const updateChild = (dateValue, index, key, nextValue) => {
    const list = [...(byDate[dateValue] ?? [])]
    list[index] = { ...list[index], [key]: nextValue }
    setDate(dateValue, list)
  }

  const addChild = (dateValue) => {
    setDate(dateValue, [...(byDate[dateValue] ?? []), { name: '', age: '' }])
  }

  const removeChild = (dateValue, index) => {
    setDate(
      dateValue,
      (byDate[dateValue] ?? []).filter((_, i) => i !== index),
    )
  }

  return (
    <fieldset>
      <legend className="field-label">{field.label}</legend>
      <Hint>{field.hint}</Hint>

      <div className="mt-3 grid gap-3">
        {field.dates.map((date) => {
          const list = byDate[date.value] ?? []
          const checked = list.length > 0
          const error = errors[errorPrefix + date.value]

          return (
            <div
              key={date.value}
              className={[
                'rounded-xl border transition',
                checked ? 'border-rose-300 bg-rose-50/40' : 'border-stone-300 bg-white',
              ].join(' ')}
            >
              <label className="flex min-h-12 cursor-pointer items-center gap-3 px-4 py-3">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(event) => toggleDate(date.value, event.target.checked)}
                  className="h-5 w-5 shrink-0 accent-rose-600"
                />
                <span className="text-[15px] font-medium text-stone-800">{date.label}</span>
              </label>

              {checked && (
                <div className="space-y-3 border-t border-rose-200/70 px-4 py-4">
                  {list.map((child, index) => (
                    <div
                      key={`${date.value}-${index}`}
                      className="grid grid-cols-[1fr_5rem_auto] items-end gap-2"
                    >
                      <div>
                        <label
                          className="mb-1 block text-xs font-medium text-stone-600"
                          htmlFor={`${field.name}-${date.value}-${index}-name`}
                        >
                          子女姓名
                        </label>
                        <input
                          id={`${field.name}-${date.value}-${index}-name`}
                          type="text"
                          className="field-input"
                          placeholder="姓名"
                          value={child.name}
                          data-invalid={error ? 'true' : undefined}
                          onChange={(event) =>
                            updateChild(date.value, index, 'name', event.target.value)
                          }
                        />
                      </div>
                      <div>
                        <label
                          className="mb-1 block text-xs font-medium text-stone-600"
                          htmlFor={`${field.name}-${date.value}-${index}-age`}
                        >
                          年齡
                        </label>
                        <input
                          id={`${field.name}-${date.value}-${index}-age`}
                          type="text"
                          inputMode="numeric"
                          className="field-input"
                          placeholder="歲"
                          value={child.age}
                          data-invalid={error ? 'true' : undefined}
                          onChange={(event) =>
                            updateChild(date.value, index, 'age', event.target.value)
                          }
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => removeChild(date.value, index)}
                        className="min-h-12 rounded-xl px-3 text-sm font-medium text-rose-700 transition hover:bg-rose-100"
                      >
                        移除
                      </button>
                    </div>
                  ))}

                  <ErrorText>{error}</ErrorText>

                  <button
                    type="button"
                    onClick={() => addChild(date.value)}
                    className="min-h-11 w-full rounded-xl border border-dashed border-rose-300 px-4 text-sm font-semibold text-rose-700 transition hover:bg-rose-50"
                  >
                    ＋ 再加一位子女
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </fieldset>
  )
}

/** 依 field.type 渲染對應的輸入元件。 */
export default function Field({ field, values, errors, onChange }) {
  switch (field.type) {
    case 'text':
    case 'tel':
    case 'email':
      return (
        <TextField
          field={field}
          value={values[field.name]}
          error={errors[field.name]}
          onChange={onChange}
        />
      )
    case 'radio':
      return (
        <RadioField
          field={field}
          value={values[field.name]}
          values={values}
          errors={errors}
          onChange={onChange}
        />
      )
    case 'checkboxGroup':
      return (
        <CheckboxGroupField
          field={field}
          value={values[field.name]}
          error={errors[field.name]}
          onChange={onChange}
        />
      )
    case 'childrenByDate':
      return (
        <ChildrenField
          field={field}
          value={values[field.name]}
          errors={errors}
          onChange={onChange}
        />
      )
    default:
      return null
  }
}
