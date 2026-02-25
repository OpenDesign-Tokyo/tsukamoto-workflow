'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { GripVertical, ChevronDown, ChevronRight, Trash2, Plus } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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
import { FIELD_TYPE_LABELS, FIELD_TYPE_COLORS, FIELD_TYPES, createDefaultField } from './schema-validation'
import { FieldEditor } from './FieldEditor'
import type { FormField } from '@/lib/types/database'

interface Props {
  fields: FormField[]
  onFieldsChange: (fields: FormField[]) => void
}

function SortableFieldItem({
  field,
  isExpanded,
  onToggle,
  onUpdate,
  onDelete,
}: {
  field: FormField
  isExpanded: boolean
  onToggle: () => void
  onUpdate: (updated: FormField) => void
  onDelete: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: field.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div ref={setNodeRef} style={style} className="border rounded-md bg-white">
      <div className="flex items-center gap-2 px-3 py-2">
        <button
          type="button"
          className="cursor-grab text-gray-400 hover:text-gray-600 shrink-0"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={onToggle}
          className="shrink-0 text-gray-400 hover:text-gray-600"
        >
          {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>

        <Badge className={`text-[10px] px-1.5 py-0 shrink-0 ${FIELD_TYPE_COLORS[field.type]}`}>
          {FIELD_TYPE_LABELS[field.type]}
        </Badge>

        <span className="text-sm font-medium truncate flex-1">{field.label}</span>

        <span className="text-[10px] text-gray-400 font-mono shrink-0">{field.id}</span>

        {field.required && (
          <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" title="必須" />
        )}

        <Button
          variant="ghost"
          size="sm"
          onClick={onDelete}
          className="h-7 w-7 p-0 text-gray-400 hover:text-red-600 shrink-0"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </Button>
      </div>

      {isExpanded && (
        <div className="px-3 pb-3">
          <FieldEditor field={field} onChange={onUpdate} />
        </div>
      )}
    </div>
  )
}

export function FieldList({ fields, onFieldsChange }: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (over && active.id !== over.id) {
      const oldIndex = fields.findIndex(f => f.id === active.id)
      const newIndex = fields.findIndex(f => f.id === over.id)
      onFieldsChange(arrayMove(fields, oldIndex, newIndex))
    }
  }

  const updateField = (index: number, updated: FormField) => {
    const next = [...fields]
    next[index] = updated
    onFieldsChange(next)
  }

  const deleteField = (index: number) => {
    onFieldsChange(fields.filter((_, i) => i !== index))
  }

  const addField = (type: FormField['type']) => {
    const newField = createDefaultField(type)
    onFieldsChange([...fields, newField])
    setExpandedId(newField.id)
  }

  return (
    <div className="space-y-2">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={fields.map(f => f.id)} strategy={verticalListSortingStrategy}>
          {fields.map((field, index) => (
            <SortableFieldItem
              key={field.id}
              field={field}
              isExpanded={expandedId === field.id}
              onToggle={() => setExpandedId(expandedId === field.id ? null : field.id)}
              onUpdate={updated => updateField(index, updated)}
              onDelete={() => deleteField(index)}
            />
          ))}
        </SortableContext>
      </DndContext>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="w-full">
            <Plus className="w-4 h-4 mr-1" />フィールドを追加
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="center" className="w-48">
          {FIELD_TYPES.map(type => (
            <DropdownMenuItem key={type} onClick={() => addField(type)}>
              <Badge className={`text-[10px] px-1.5 py-0 mr-2 ${FIELD_TYPE_COLORS[type]}`}>
                {FIELD_TYPE_LABELS[type]}
              </Badge>
              {FIELD_TYPE_LABELS[type]}フィールド
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
