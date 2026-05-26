import { Message, Conversation } from './entities';

export interface IAAdapter {
  isCurrentPage(): boolean;
  getMessages(): Message[];
  injectCheckboxes(onSelectionChange: (selectedIds: string[]) => void): void;
  removeCheckboxes(): void;
  selectAll(select: boolean): void;
  getSelectedMessageIds(): string[];
  getConversationTitle(): string;
}
