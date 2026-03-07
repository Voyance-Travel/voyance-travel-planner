/**
 * Draggable Activity List
 * 
 * Desktop: drag-and-drop via pointer with grip handle on hover.
 * Mobile: long-press (500ms) on the entire card to initiate drag.
 * No up/down buttons — reordering is drag-only (menu fallback exists in ⋯).
 */

import React, { useState, useMemo, useCallback } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
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
        isDragging && "opacity-50 scale-[1.02] shadow-lg rounded-lg",
        isHighlighted && "ring-2 ring-primary ring-offset-2 rounded-lg animate-pulse"
      )}
    >
      {/* Desktop: Drag Handle — visible on hover */}
      {!disabled && (
        <div
          {...attributes}
          {...listeners}
          className={cn(
            "absolute left-0 top-1/2 -translate-y-1/2 -translate-x-3",
            "hidden sm:flex",
            "opacity-0 group-hover:opacity-100 transition-opacity",
            "cursor-grab active:cursor-grabbing",
            "items-center justify-center w-7 h-10 rounded-md bg-background border shadow-sm",
            "hover:bg-muted z-10",
            isDragging && "opacity-100"
          )}
          style={{ touchAction: 'none' }}
        >
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </div>
      )}

      {/* Mobile: entire card is the drag target via TouchSensor long-press */}
      {!disabled && (
        <div
          {...attributes}
          {...listeners}
          className="sm:hidden absolute inset-0 z-[5]"
          style={{ touchAction: 'auto' }}
        />
      )}

      {children}
    </div>
  );
}

function DraggableActivityListInner<T extends { id: string }>({
  items,
  onReorder,
  renderItem,
  highlightedIds = [],
  disabled = false,
}: DraggableActivityListProps<T>) {
  const [activeId, setActiveId] = useState<string | null>(null);

  // Desktop: pointer with small distance threshold
  const pointerSensor = useSensor(PointerSensor, {
    activationConstraint: {
      distance: 8,
    },
  });

  // Mobile: long-press (500ms delay) to distinguish from scrolling
  const touchSensor = useSensor(TouchSensor, {
    activationConstraint: {
      delay: 500,
      tolerance: 5,
    },
  });
  
  const keyboardSensor = useSensor(KeyboardSensor, {
    coordinateGetter: sortableKeyboardCoordinates,
  });

  const sensors = useSensors(pointerSensor, touchSensor, keyboardSensor);

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

  const itemIds = useMemo(() => items.map(i => i.id), [items]);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
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
          <div className="opacity-90 shadow-xl rounded-lg scale-[1.02]">
            {renderItem(activeItem, activeIndex, true, false)}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

export function DraggableActivityList<T extends { id: string }>(props: DraggableActivityListProps<T>) {
  // Guard against empty items to prevent hook issues
  if (!props.items || props.items.length === 0) {
    return null;
  }
  
  return <DraggableActivityListInner {...props} />;
}

export default DraggableActivityList;
