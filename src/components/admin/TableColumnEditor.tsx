'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Plus, Trash2, GripVertical } from 'lucide-react'
import type { TableColumn } from '@/lib/types/database'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

const COLUMN_TYPES = [
  { value: 'text', label: 'テキスト' },
  { value: 'number', label: '数値' },
  { value: 'currency', label: '金額' },
  { value: 'date', label: '日付' },
  { value: 'formula', label: '計算式' },
]

interface Props {
  columns: TableColumn[]
  onChange: (columns: TableColumn[]) => void
}

function SortableColumnRow({
  column,
  onUpdate,
  onDelete,
}: {
  column: TableColumn
  onUpdate: (updates: Partial<TableColumn>) => void
  onDelete: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: column.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-2 py-1.5">
      <button type="button" className="cursor-grab text-gray-400 hover:text-gray-600 shrink-0" {...attributes} {...listeners}>
        <GripVertical className="w-3.5 h-3.5" />
      </button>
      <Input
        value={column.id}
        onChange={e => onUpdate({ id: e.target.value })}
        placeholder="列ID"
        className="w-24 h-8 text-xs font-mono"
      />
      <Select value={column.type} onValueChange={v => onUpdate({ type: v })}>
        <SelectTrigger className="w-24 h-8 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {COLUMN_TYPES.map(t => (
            <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Input
        value={column.label}
        onChange={e => onUpdate({ label: e.target.value })}
        placeholder="ラベル"
        className="flex-1 h-8 text-xs"
      />
      <Input
        value={column.width || ''}
        onChange={e => onUpdate({ width: e.target.value || undefined })}
        placeholder="幅"
        className="w-16 h-8 text-xs"
      />
      {column.type === 'formula' && (
        <Input
          value={column.formula || ''}
          onChange={e => onUpdate({ formula: e.target.value || undefined })}
          placeholder="計算式"
          className="w-40 h-8 text-xs font-mono"
        />
      )}
      <Button variant="ghost" size="sm" onClick={onDelete} className="h-8 w-8 p-0 text-red-400 hover:text-red-600 shrink-0">
        <Trash2 className="w-3.5 h-3.5" />
      </Button>
    </div>
  )
}

export function TableColumnEditor({ columns, onChange }: Props) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (over && active.id !== over.id) {
      const oldIndex = columns.findIndex(c => c.id === active.id)
      const newIndex = columns.findIndex(c => c.id === over.id)
      onChange(arrayMove(columns, oldIndex, newIndex))
    }
  }

  const updateColumn = (index: number, updates: Partial<TableColumn>) => {
    const next = [...columns]
    next[index] = { ...next[index], ...updates }
    onChange(next)
  }

  const addColumn = () => {
    onChange([...columns, { id: `col_${Date.now()}`, type: 'text', label: '新規列' }])
  }

  const deleteColumn = (index: number) => {
    onChange(columns.filter((_, i) => i !== index))
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-[10px] text-gray-400 uppercase tracking-wider px-7">
        <span className="w-24">列ID</span>
        <span className="w-24">タイプ</span>
        <span className="flex-1">ラベル</span>
        <span className="w-16">幅</span>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={columns.map(c => c.id)} strategy={verticalListSortingStrategy}>
          {columns.map((col, i) => (
            <SortableColumnRow
              key={`${col.id}-${i}`}
              column={col}
              onUpdate={updates => updateColumn(i, updates)}
              onDelete={() => deleteColumn(i)}
            />
          ))}
        </SortableContext>
      </DndContext>

      <Button variant="outline" size="sm" onClick={addColumn} className="h-7 text-xs">
        <Plus className="w-3 h-3 mr-1" />列を追加
      </Button>
    </div>
  )
}
