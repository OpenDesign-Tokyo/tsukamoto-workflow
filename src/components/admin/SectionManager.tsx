'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Plus, Trash2, X, GripVertical } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
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
import type { FormField, FormSection } from '@/lib/types/database'

interface Props {
  sections: FormSection[]
  allFields: FormField[]
  onChange: (sections: FormSection[]) => void
}

function SortableSectionItem({
  section,
  index,
  allFields,
  assignedFieldIds,
  onUpdate,
  onDelete,
  onRemoveField,
  onAddField,
}: {
  section: FormSection
  index: number
  allFields: FormField[]
  assignedFieldIds: Set<string>
  onUpdate: (updates: Partial<FormSection>) => void
  onDelete: () => void
  onRemoveField: (fieldId: string) => void
  onAddField: (fieldId: string) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `section-${index}`,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const unassignedFields = allFields.filter(f => !assignedFieldIds.has(f.id))

  return (
    <div ref={setNodeRef} style={style} className="border rounded-md bg-white p-3 space-y-2">
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="cursor-grab text-gray-400 hover:text-gray-600 shrink-0"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="w-4 h-4" />
        </button>
        <Input
          value={section.title}
          onChange={e => onUpdate({ title: e.target.value })}
          className="h-8 text-sm font-medium flex-1"
          placeholder="セクション名"
        />
        <Button
          variant="ghost"
          size="sm"
          onClick={onDelete}
          className="h-7 w-7 p-0 text-gray-400 hover:text-red-600 shrink-0"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </Button>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {section.fields.map(fieldId => {
          const field = allFields.find(f => f.id === fieldId)
          return (
            <Badge key={fieldId} variant="secondary" className="text-xs gap-1 pr-1">
              {field?.label || fieldId}
              <button
                type="button"
                onClick={() => onRemoveField(fieldId)}
                className="text-gray-400 hover:text-red-600"
              >
                <X className="w-3 h-3" />
              </button>
            </Badge>
          )
        })}
      </div>

      {unassignedFields.length > 0 && (
        <Select onValueChange={onAddField}>
          <SelectTrigger className="h-7 text-xs w-auto">
            <SelectValue placeholder="+ フィールドを追加" />
          </SelectTrigger>
          <SelectContent>
            {unassignedFields.map(f => (
              <SelectItem key={f.id} value={f.id}>
                {f.label}（{f.id}）
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  )
}

export function SectionManager({ sections, allFields, onChange }: Props) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  // Collect all assigned field IDs
  const assignedFieldIds = new Set(sections.flatMap(s => s.fields))
  const unassignedFields = allFields.filter(f => !assignedFieldIds.has(f.id))

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (over && active.id !== over.id) {
      const oldIndex = parseInt(String(active.id).replace('section-', ''))
      const newIndex = parseInt(String(over.id).replace('section-', ''))
      onChange(arrayMove(sections, oldIndex, newIndex))
    }
  }

  const updateSection = (index: number, updates: Partial<FormSection>) => {
    const next = [...sections]
    next[index] = { ...next[index], ...updates }
    onChange(next)
  }

  const deleteSection = (index: number) => {
    onChange(sections.filter((_, i) => i !== index))
  }

  const addSection = () => {
    onChange([...sections, { title: '新規セクション', fields: [] }])
  }

  const removeFieldFromSection = (sectionIndex: number, fieldId: string) => {
    const next = [...sections]
    next[sectionIndex] = {
      ...next[sectionIndex],
      fields: next[sectionIndex].fields.filter(id => id !== fieldId),
    }
    onChange(next)
  }

  const addFieldToSection = (sectionIndex: number, fieldId: string) => {
    const next = [...sections]
    next[sectionIndex] = {
      ...next[sectionIndex],
      fields: [...next[sectionIndex].fields, fieldId],
    }
    onChange(next)
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-medium text-gray-500">セクション構成</h4>
        <Button variant="outline" size="sm" onClick={addSection} className="h-7 text-xs">
          <Plus className="w-3 h-3 mr-1" />セクション追加
        </Button>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext
          items={sections.map((_, i) => `section-${i}`)}
          strategy={verticalListSortingStrategy}
        >
          {sections.map((section, index) => (
            <SortableSectionItem
              key={`section-${index}`}
              section={section}
              index={index}
              allFields={allFields}
              assignedFieldIds={assignedFieldIds}
              onUpdate={updates => updateSection(index, updates)}
              onDelete={() => deleteSection(index)}
              onRemoveField={fieldId => removeFieldFromSection(index, fieldId)}
              onAddField={fieldId => addFieldToSection(index, fieldId)}
            />
          ))}
        </SortableContext>
      </DndContext>

      {unassignedFields.length > 0 && (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-2">
          <p className="text-xs text-amber-700 mb-1">
            未割当のフィールド（{unassignedFields.length}件）:
          </p>
          <div className="flex flex-wrap gap-1">
            {unassignedFields.map(f => (
              <Badge key={f.id} variant="outline" className="text-xs text-amber-600 border-amber-300">
                {f.label}
              </Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
