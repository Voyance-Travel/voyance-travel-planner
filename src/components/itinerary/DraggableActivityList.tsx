/**
 * Draggable Activity List
 * 
 * Desktop: drag-and-drop via @dnd-kit with visible grip handles.
 * Mobile: tap-based up/down arrow buttons (no drag — avoids scroll conflicts).
 */

import React, { useState, useMemo, useCallback } from 'react';
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
import { GripVertical, ChevronUp, ChevronDown } from 'lucide-react';
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
  index: number;
  totalItems: number;
  isHighlighted: boolean;
  disabled?: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  children: React.ReactNode;
}

function SortableItem({ id, index, totalItems, isHighlighted, disabled, onMoveUp, onMoveDown, children }: SortableItemProps) {
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

      {/* Mobile: Up/Down reorder buttons — 44px touch targets per Apple HIG */}
      {!disabled && (
        <div
          className={cn(
            "absolute right-1 top-1/2 -translate-y-1/2 z-10",
            "flex sm:hidden flex-col gap-1"
          )}
        >
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onMoveUp(); }}
            disabled={index === 0}
            className={cn(
              "flex items-center justify-center w-11 h-11 rounded-lg",
              "bg-background/95 backdrop-blur-sm border border-border/60 shadow-md",
              "active:bg-muted active:scale-95 transition-all touch-manipulation",
              "disabled:opacity-20 disabled:pointer-events-none"
            )}
            aria-label="Move up"
          >
            <ChevronUp className="h-5 w-5 text-muted-foreground" />
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onMoveDown(); }}
            disabled={index === totalItems - 1}
            className={cn(
              "flex items-center justify-center w-11 h-11 rounded-lg",
              "bg-background/95 backdrop-blur-sm border border-border/60 shadow-md",
              "active:bg-muted active:scale-95 transition-all touch-manipulation",
              "disabled:opacity-20 disabled:pointer-events-none"
            )}
            aria-label="Move down"
          >
            <ChevronDown className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>
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

  const pointerSensor = useSensor(PointerSensor, {
    activationConstraint: {
      distance: 8,
    },
  });
  
  const keyboardSensor = useSensor(KeyboardSensor, {
    coordinateGetter: sortableKeyboardCoordinates,
  });

  const sensors = useSensors(pointerSensor, keyboardSensor);

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

  const moveItem = useCallback((fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= items.length) return;
    const newItems = arrayMove(items, fromIndex, toIndex);
    onReorder(newItems);
  }, [items, onReorder]);

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
              index={index}
              totalItems={items.length}
              isHighlighted={isHighlighted}
              disabled={disabled}
              onMoveUp={() => moveItem(index, index - 1)}
              onMoveDown={() => moveItem(index, index + 1)}
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

export function DraggableActivityList<T extends { id: string }>(props: DraggableActivityListProps<T>) {
  // Guard against empty items to prevent hook issues
  if (!props.items || props.items.length === 0) {
    return null;
  }
  
  return <DraggableActivityListInner {...props} />;
}

export default DraggableActivityList;
