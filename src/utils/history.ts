import type { PathData } from "../types";

export interface HistoryState {
  paths: PathData[];
  timestamp: number;
}

export class HistoryManager {
  private history: HistoryState[] = [];
  private currentIndex: number = -1;
  private maxSize: number;

  constructor(maxSize: number = 50) {
    this.maxSize = maxSize;
  }

  push(state: PathData[]): void {
    // Remove any states after current index (for redo functionality)
    this.history = this.history.slice(0, this.currentIndex + 1);

    // Add new state
    this.history.push({
      paths: JSON.parse(JSON.stringify(state)), // Deep clone
      timestamp: Date.now(),
    });

    // Limit history size
    if (this.history.length > this.maxSize) {
      this.history.shift();
    } else {
      this.currentIndex++;
    }
  }

  undo(): PathData[] | null {
    if (this.currentIndex > 0) {
      this.currentIndex--;
      return JSON.parse(JSON.stringify(this.history[this.currentIndex].paths));
    }
    return null;
  }

  redo(): PathData[] | null {
    if (this.currentIndex < this.history.length - 1) {
      this.currentIndex++;
      return JSON.parse(JSON.stringify(this.history[this.currentIndex].paths));
    }
    return null;
  }

  canUndo(): boolean {
    return this.currentIndex > 0;
  }

  canRedo(): boolean {
    return this.currentIndex < this.history.length - 1;
  }

  clear(): void {
    this.history = [];
    this.currentIndex = -1;
  }

  getSize(): number {
    return this.history.length;
  }

  getCurrentState(): PathData[] | null {
    if (this.currentIndex >= 0 && this.currentIndex < this.history.length) {
      return JSON.parse(JSON.stringify(this.history[this.currentIndex].paths));
    }
    return null;
  }
}
