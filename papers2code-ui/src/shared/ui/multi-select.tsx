import * as React from "react"
import { X } from "lucide-react"
import { Badge } from "@/shared/ui/badge";
import { Input } from "@/shared/ui/input";
import { cn } from "@/shared/utils/utils";

interface MultiSelectProps {
  options: string[]
  selected: string[]
  onChange: (selected: string[]) => void
  placeholder?: string
  emptyMessage?: string
  className?: string
  onSearch?: (query: string) => void
}

export function MultiSelect({
  options,
  selected,
  onChange,
  placeholder = "Type to search...",
  emptyMessage = "No items found.",
  className,
  onSearch,
}: MultiSelectProps) {
  const [inputValue, setInputValue] = React.useState("")
  const [showDropdown, setShowDropdown] = React.useState(false)
  const inputRef = React.useRef<HTMLInputElement>(null)
  const dropdownRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    if (onSearch) {
      const timer = setTimeout(() => {
        if (inputValue) {
          onSearch(inputValue)
        }
      }, 300)
      return () => clearTimeout(timer)
    }
  }, [inputValue, onSearch])

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setShowDropdown(false)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const handleUnselect = (item: string) => {
    onChange(selected.filter((i) => i !== item))
  }

  const handleSelect = (item: string) => {
    if (!selected.includes(item)) {
      onChange([...selected, item])
    }
    setInputValue("")
    setShowDropdown(false)
    inputRef.current?.focus()
  }

  const filteredOptions = options.filter((option) =>
    option.toLowerCase().includes(inputValue.toLowerCase()) &&
    !selected.includes(option)
  )

  return (
    <div className={cn("relative flex flex-col gap-2", className)}>
      {/* Selected items */}
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {selected.map((item) => (
            <Badge
              key={item}
              variant="secondary"
              className="px-2 py-1 text-xs"
            >
              {item}
              <button
                className="ml-1 rounded-full outline-none hover:bg-muted"
                onMouseDown={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                }}
                onClick={() => handleUnselect(item)}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
      
      {/* Input */}
      <Input
        ref={inputRef}
        placeholder={placeholder}
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onFocus={() => setShowDropdown(true)}
      />

      {/* Dropdown */}
      {showDropdown && inputValue.length > 0 && (
        <div
          ref={dropdownRef}
          className="absolute top-full left-0 right-0 z-50 mt-1 max-h-[200px] overflow-auto rounded-md border bg-popover text-popover-foreground shadow-md"
        >
          {filteredOptions.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              {emptyMessage}
            </div>
          ) : (
            <div className="p-1">
              {filteredOptions.map((option) => (
                <div
                  key={option}
                  className="relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground"
                  onClick={() => handleSelect(option)}
                >
                  {option}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

