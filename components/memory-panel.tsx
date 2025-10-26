'use client';

import { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Brain,
  Search,
  Plus,
  X,
  Clock,
  Tag,
  Trash2,
  Download,
  Upload,
  Filter,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export interface Memory {
  id: string;
  content: string;
  createdAt: Date;
  updatedAt?: Date;
  tags?: string[];
  source?: string;
  confidence?: number;
}

interface MemoryPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onAddMemory?: (memory: string) => Promise<void>;
  onSearchMemories?: (query: string) => Promise<Memory[]>;
  onDeleteMemory?: (id: string) => Promise<void>;
  userId?: string;
}

export function MemoryPanel({
  isOpen,
  onClose,
  onAddMemory,
  onSearchMemories,
  onDeleteMemory,
  userId,
}: MemoryPanelProps) {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [newMemory, setNewMemory] = useState('');
  const [selectedTab, setSelectedTab] = useState('all');
  const [filterTags, setFilterTags] = useState<string[]>([]);

  // Load memories on open
  useEffect(() => {
    if (isOpen && onSearchMemories) {
      handleSearch('');
    }
  }, [isOpen]);

  const handleSearch = async (query: string) => {
    if (!onSearchMemories) return;

    setIsSearching(true);
    try {
      const results = await onSearchMemories(query);
      setMemories(results);
    } catch (error) {
      console.error('Failed to search memories:', error);
    } finally {
      setIsSearching(false);
    }
  };

  const handleAddMemory = async () => {
    if (!onAddMemory || !newMemory.trim()) return;

    setIsAdding(true);
    try {
      await onAddMemory(newMemory);
      setNewMemory('');
      // Refresh memories list
      await handleSearch(searchQuery);
    } catch (error) {
      console.error('Failed to add memory:', error);
    } finally {
      setIsAdding(false);
    }
  };

  const handleDeleteMemory = async (id: string) => {
    if (!onDeleteMemory) return;

    try {
      await onDeleteMemory(id);
      setMemories(memories.filter(m => m.id !== id));
    } catch (error) {
      console.error('Failed to delete memory:', error);
    }
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  const filteredMemories = memories.filter(memory => {
    if (filterTags.length === 0) return true;
    return memory.tags?.some(tag => filterTags.includes(tag)) ?? false;
  });

  const allTags = Array.from(
    new Set(memories.flatMap(m => m.tags || []))
  );

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent side="right" className="w-full sm:w-[540px] sm:max-w-[540px]">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            Memory System
          </SheetTitle>
          <SheetDescription>
            View and manage stored memories from your conversations
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          {/* Search Bar */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleSearch(searchQuery);
                  }
                }}
                placeholder="Search memories..."
                className="pl-9"
              />
            </div>
            <Button
              onClick={() => handleSearch(searchQuery)}
              disabled={isSearching}
              size="sm"
            >
              Search
            </Button>
          </div>

          {/* Add Memory */}
          <div className="flex gap-2">
            <Input
              value={newMemory}
              onChange={(e) => setNewMemory(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  handleAddMemory();
                }
              }}
              placeholder="Add a new memory..."
              disabled={isAdding}
            />
            <Button
              onClick={handleAddMemory}
              disabled={isAdding || !newMemory.trim()}
              size="sm"
              variant="outline"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          {/* Filter Tags */}
          {allTags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              <span className="text-sm text-gray-500">Filter:</span>
              {allTags.map(tag => (
                <Badge
                  key={tag}
                  variant={filterTags.includes(tag) ? 'default' : 'outline'}
                  className="cursor-pointer"
                  onClick={() => {
                    if (filterTags.includes(tag)) {
                      setFilterTags(filterTags.filter(t => t !== tag));
                    } else {
                      setFilterTags([...filterTags, tag]);
                    }
                  }}
                >
                  <Tag className="mr-1 h-3 w-3" />
                  {tag}
                </Badge>
              ))}
              {filterTags.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setFilterTags([])}
                  className="h-6 px-2 text-xs"
                >
                  Clear
                </Button>
              )}
            </div>
          )}

          {/* Memories List */}
          <ScrollArea className="h-[calc(100vh-320px)]">
            <div className="space-y-3 pr-4">
              <AnimatePresence mode="popLayout">
                {isSearching ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-gray-600" />
                      Searching memories...
                    </div>
                  </div>
                ) : filteredMemories.length === 0 ? (
                  <div className="py-8 text-center text-sm text-gray-500">
                    {memories.length === 0
                      ? 'No memories stored yet'
                      : 'No memories match your filters'}
                  </div>
                ) : (
                  filteredMemories.map((memory) => (
                    <motion.div
                      key={memory.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="group rounded-lg border border-gray-200 p-3 transition-all hover:border-gray-300 hover:shadow-sm dark:border-gray-700 dark:hover:border-gray-600"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 space-y-2">
                          <p className="text-sm text-gray-700 dark:text-gray-300">
                            {memory.content}
                          </p>
                          <div className="flex items-center gap-2">
                            <span className="flex items-center gap-1 text-xs text-gray-400">
                              <Clock className="h-3 w-3" />
                              {formatDate(memory.createdAt)}
                            </span>
                            {memory.confidence && (
                              <span className="text-xs text-gray-400">
                                {Math.round(memory.confidence * 100)}% confidence
                              </span>
                            )}
                          </div>
                          {memory.tags && memory.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {memory.tags.map((tag) => (
                                <Badge key={tag} variant="secondary" className="text-xs">
                                  {tag}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => handleDeleteMemory(memory.id)}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    </motion.div>
                  ))
                )}
              </AnimatePresence>
            </div>
          </ScrollArea>

          {/* Actions */}
          <div className="flex justify-between border-t pt-4">
            <div className="flex gap-2">
              <Button variant="outline" size="sm">
                <Download className="mr-2 h-4 w-4" />
                Export
              </Button>
              <Button variant="outline" size="sm">
                <Upload className="mr-2 h-4 w-4" />
                Import
              </Button>
            </div>
            <div className="text-xs text-gray-500">
              {memories.length} {memories.length === 1 ? 'memory' : 'memories'} stored
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}