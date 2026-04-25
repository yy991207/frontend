import { useState, useRef } from 'react'
import Input from 'antd/es/input'
import type { InputRef } from 'antd/es/input'

interface EditableInputProps {
  placeholder?: string
  defaultValue?: string
  onSubmit: (value: string) => void
}

/**
 * 独立的内联编辑输入框组件。
 * value 在组件内部 state，不会因为父组件 rerender 而丢失或打断中文输入法组合态。
 */
export default function EditableInput({
  placeholder,
  defaultValue = '',
  onSubmit,
}: EditableInputProps) {
  const [value, setValue] = useState(defaultValue)
  const composingRef = useRef(false)
  const submittedRef = useRef(false)
  const inputRef = useRef<InputRef>(null)

  const submit = () => {
    if (submittedRef.current) return
    submittedRef.current = true
    onSubmit(value)
  }

  return (
    <Input
      ref={inputRef}
      size="middle"
      autoFocus
      placeholder={placeholder}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onCompositionStart={() => {
        composingRef.current = true
      }}
      onCompositionEnd={() => {
        composingRef.current = false
      }}
      onPressEnter={() => {
        if (composingRef.current) return
        submit()
      }}
      onBlur={submit}
      onClick={(e) => e.stopPropagation()}
    />
  )
}
