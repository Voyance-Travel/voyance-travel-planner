/**
 * Draggable Activity List
 * 
 * Wrapper component that adds drag-and-drop reordering to activity lists.
 * Uses @dnd-kit for accessibility-friendly drag and drop.
 */

import React, { useState } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DraggableActivityListProps<T extends { id: string }> {
  items: T[];
  onReorder: (items: T[]) => void;
  renderItem: (item: T, index: number, isDragging: boolean, isHighlighted: boolean) => React.ReactNode;
  highlightedIds?: string[];
  disabled?: boolean;
}

interface SortableItemProps {
  id: string;
  isHighlighted: boolean;
  disabled?: boolean;
  children: React.ReactNode;
}

function SortableItem({ id, isHighlighted, disabled, children }: SortableItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "relative group",
        isDragging && "opacity-50",
        isHighlighted && "ring-2 ring-primary ring-offset-2 rounded-lg animate-pulse"
      )}
    >
      {/* Drag Handle */}
      {!disabled && (
        <div
          {...attributes}
          {...listeners}
          className={cn(
            "absolute left-0 top-1/2 -translate-y-1/2 -translate-x-2",
            "opacity-0 group-hover:opacity-100 transition-opacity",
            "cursor-grab active:cursor-grabbing",
            "p-1.5 rounded-md bg-background border shadow-sm",
            "hover:bg-muted z-10",
            isDragging && "opacity-100"
          )}
        >
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </div>
      )}
      {children}
    </div>
  );
}

export function DraggableActivityList<T extends { id: string }>({
  items,
  onReorder,
  renderItem,
  highlightedIds = [],
  disabled = false,
}: DraggableActivityListProps<T>) {
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Require 8px of movement before starting drag
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(String(event.active.id));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (over && active.id !== over.id) {
      const oldIndex = items.findIndex((item) => item.id === active.id);
      const newIndex = items.findIndex((item) => item.id === over.id);
      
      if (oldIndex !== -1 && newIndex !== -1) {
        const newItems = arrayMove(items, oldIndex, newIndex);
        onReorder(newItems);
      }
    }
  };

  const handleDragCancel = () => {
    setActiveId(null);
  };

  const activeItem = activeId ? items.find((item) => item.id === activeId) : null;
  const activeIndex = activeId ? items.findIndex((item) => item.id === activeId) : -1;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <SortableContext items={items.map(i => i.id)} strategy={verticalListSortingStrategy}>
        {items.map((item, index) => {
          const isHighlighted = highlightedIds.includes(item.id);
          return (
            <SortableItem 
              key={item.id} 
              id={item.id} 
              isHighlighted={isHighlighted}
              disabled={disabled}
            >
              {renderItem(item, index, item.id === activeId, isHighlighted)}
            </SortableItem>
          );
        })}
      </SortableContext>

      {/* Drag Overlay - shows the item being dragged */}
      <DragOverlay>
        {activeItem && activeIndex !== -1 ? (
          <div className="opacity-90 shadow-lg rounded-lg">
            {renderItem(activeItem, activeIndex, true, false)}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

export default DraggableActivityList;
