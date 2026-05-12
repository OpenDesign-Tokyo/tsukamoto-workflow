'use client'

import { useEffect, useState, useMemo } from 'react'
import { ChevronsUpDown, Check, X } from 'lucide-react'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { cn } from '@/lib/utils'
import type { FormField, Vendor } from '@/lib/types/database'

interface Props {
  field: FormField
  value: string // vendor id
  onSelect: (vendor: Vendor | null) => void
  readOnly?: boolean
}

let vendorCachePromise: Promise<Vendor[]> | null = null

async function loadVendors(): Promise<Vendor[]> {
  if (!vendorCachePromise) {
    vendorCachePromise = fetch('/api/vendors')
      .then(r => r.ok ? r.json() : { vendors: [] })
      .then((data: { vendors: Vendor[] }) => data.vendors ?? [])
      .catch(() => [])
  }
  return vendorCachePromise
}

export function VendorField({ field, value, onSelect, readOnly }: Props) {
  const [vendors, setVendors] = useState<Vendor[] | null>(null)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    let cancelled = false
    loadVendors().then(v => { if (!cancelled) setVendors(v) })
    return () => { cancelled = true }
  }, [])

  const filtered = useMemo(() => {
    if (!vendors) return []
    if (!field.vendorCategories?.length) return vendors
    return vendors.filter(v => !v.category || field.vendorCategories!.includes(v.category))
  }, [vendors, field.vendorCategories])

  const selected = filtered.find(v => v.id === value) || null

  if (readOnly) {
    return (
      <div className="space-y-1.5">
        <Label>{field.label}</Label>
        <div className="px-3 py-2 bg-gray-50 rounded-md border text-sm">
          {selected ? `${selected.name}（${selected.code}）` : '-'}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-1.5">
      <Label htmlFor={field.id}>
        {field.label}
        {field.required && <span className="text-red-500 ml-1">*</span>}
      </Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id={field.id}
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={cn('w-full justify-between font-normal', !selected && 'text-muted-foreground')}
          >
            {selected ? (
              <span className="truncate">{selected.name}（{selected.code}）</span>
            ) : (
              <span>取引先を選択</span>
            )}
            <span className="flex items-center gap-1">
              {selected && (
                <X
                  className="h-4 w-4 opacity-50 hover:opacity-100"
                  onClick={(e) => { e.stopPropagation(); onSelect(null) }}
                />
              )}
              <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
            </span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
          <Command
            filter={(itemValue, search) => {
              // itemValue is composed below; match against the full label
              return itemValue.toLowerCase().includes(search.toLowerCase()) ? 1 : 0
            }}
          >
            <CommandInput placeholder="社名・カナ・コードで検索..." />
            <CommandList>
              <CommandEmpty>
                {vendors === null ? '読み込み中...' : '該当する取引先が見つかりません'}
              </CommandEmpty>
              <CommandGroup>
                {filtered.map(v => {
                  // Use a single string that bundles searchable fields so cmdk can fuzzy-match
                  const searchable = [v.name, v.name_kana, v.code, v.short_name]
                    .filter(Boolean)
                    .join(' ')
                  return (
                    <CommandItem
                      key={v.id}
                      value={searchable}
                      onSelect={() => { onSelect(v); setOpen(false) }}
                    >
                      <Check className={cn('mr-2 h-4 w-4', value === v.id ? 'opacity-100' : 'opacity-0')} />
                      <div className="flex flex-col">
                        <span className="font-medium">{v.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {v.code}{v.category ? ` ・ ${v.category}` : ''}{v.address ? ` ・ ${v.address}` : ''}
                        </span>
                      </div>
                    </CommandItem>
                  )
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  )
}

/** Test seam: reset the in-module vendor cache. Called only from unit tests. */
export function __resetVendorCacheForTests() {
  vendorCachePromise = null
}
