import { Message, Conversation } from './entities';

export interface IAAdapter {
  isCurrentPage(): boolean;
  getMessages(): Message[];
  injectCheckboxes(onSelectionChange: (selectedIds: string[]) => void): void;
  getSelectedMessageIds(): string[];
  getConversationTitle(): string;
}
