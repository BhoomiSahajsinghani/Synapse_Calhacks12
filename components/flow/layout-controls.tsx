'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  GitBranch,
  Grid3x3,
  Circle,
  ArrowRight,
  ArrowDown,
  Network,
  Shuffle
} from 'lucide-react';

export type LayoutType = 'tree' | 'grid' | 'radial' | 'horizontal' | 'vertical' | 'dagre' | 'auto';

interface LayoutControlsProps {
  onLayoutChange: (layout: LayoutType) => void;
  currentLayout?: LayoutType;
  className?: string;
}

export function LayoutControls({
  onLayoutChange,
  currentLayout = 'auto',
  className = ''
}: LayoutControlsProps) {
  const layouts = [
    {
      type: 'auto' as LayoutType,
      label: 'Auto Layout',
      icon: Shuffle,
      description: 'Automatically choose best layout'
    },
    {
      type: 'tree' as LayoutType,
      label: 'Tree Layout',
      icon: GitBranch,
      description: 'Hierarchical tree structure'
    },
    {
      type: 'grid' as LayoutType,
      label: 'Grid Layout',
      icon: Grid3x3,
      description: 'Organize in a grid pattern'
    },
    {
      type: 'radial' as LayoutType,
      label: 'Radial Layout',
      icon: Circle,
      description: 'Circular, centered layout'
    },
    {
      type: 'horizontal' as LayoutType,
      label: 'Horizontal Flow',
      icon: ArrowRight,
      description: 'Left to right flow'
    },
    {
      type: 'vertical' as LayoutType,
      label: 'Vertical Flow',
      icon: ArrowDown,
      description: 'Top to bottom flow'
    },
    {
      type: 'dagre' as LayoutType,
      label: 'DAG Layout',
      icon: Network,
      description: 'Directed acyclic graph'
    },
  ];

  const currentLayoutConfig = layouts.find(l => l.type === currentLayout);
  const Icon = currentLayoutConfig?.icon || Shuffle;

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="flex items-center gap-2"
          >
            <Icon className="h-4 w-4" />
            <span className="hidden sm:inline">{currentLayoutConfig?.label}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>Choose Layout</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {layouts.map((layout) => {
            const LayoutIcon = layout.icon;
            return (
              <DropdownMenuItem
                key={layout.type}
                onClick={() => onLayoutChange(layout.type)}
                className="cursor-pointer"
              >
                <div className="flex items-start gap-3 w-full">
                  <LayoutIcon className="h-4 w-4 mt-0.5 shrink-0" />
                  <div className="flex-1">
                    <div className="font-medium text-sm">{layout.label}</div>
                    <div className="text-xs text-muted-foreground">
                      {layout.description}
                    </div>
                  </div>
                  {currentLayout === layout.type && (
                    <div className="h-2 w-2 rounded-full bg-primary mt-1.5" />
                  )}
                </div>
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}